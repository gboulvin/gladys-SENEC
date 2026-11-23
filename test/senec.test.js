import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identifySystem,
  MODES,
  modeOfState,
  normalizeSerial,
  readForm,
  readSnapshot,
  setSafeCharge,
  setWallboxMode,
  SYSTEM_STATE_NAMES,
  wallboxModeOf,
} from '../src/senec.js';
import { MODE_LABELS } from '../src/i18n.js';
import { createFakeSenec, fakeNetwork, v21Recent } from './helpers/fakeSenec.js';

const clientOf = (senec, host = '192.168.1.40') => fakeNetwork({ [host]: senec })({ host });

test('identifySystem reads the serial number, the model and the wallboxes', async () => {
  const profile = await identifySystem(clientOf(createFakeSenec()));
  assert.deepEqual(profile, {
    serial: '1234567',
    host: '192.168.1.40',
    model: 'SENEC.Home V3 hybrid',
    sysType: 19,
    firmware: '0826',
    npuImage: 2400,
    hasStatistics: true,
    wallboxes: 1,
  });
});

test('identifySystem of a recent V2.1 without statistics nor wallbox', async () => {
  const profile = await identifySystem(clientOf(createFakeSenec(v21Recent())));
  assert.equal(profile.serial, 'DE-0042');
  assert.equal(profile.model, 'SENEC.Home V2.1 1ph Lithium');
  assert.equal(profile.hasStatistics, false);
  assert.equal(profile.wallboxes, 0);
});

test('identifySystem refuses an answer without serial number', async () => {
  const senec = createFakeSenec();
  senec.raw.FACTORY.DEVICE_ID = 'VARIABLE_NOT_FOUND';
  await assert.rejects(identifySystem(clientOf(senec)), /without a SENEC serial number/);
});

test('normalizeSerial keeps the serial usable in an external id', () => {
  assert.equal(normalizeSerial(' AB 12/3 '), 'AB-12-3');
  assert.equal(normalizeSerial(0), null);
  assert.equal(normalizeSerial(null), null);
});

test('readSnapshot turns the raw values into Gladys values', async () => {
  const senec = createFakeSenec();
  const client = clientOf(senec);
  const profile = await identifySystem(client);
  const snapshot = await readSnapshot(client, profile);
  assert.deepEqual(snapshot, {
    stateCode: 14,
    stateName: 'CHARGE',
    mode: 'charging',
    batteryLevel: 76.4,
    batteryChargePower: 1501,
    batteryDischargePower: 0,
    solarPower: 4200,
    housePower: 900,
    gridImportPower: 0,
    gridExportPower: 1800,
    safeCharge: 0,
    batteryTemperature: 24.5,
    caseTemperature: 31.3,
    solarIndex: 12345.5,
    houseIndex: 9876.25,
    gridImportIndex: 3210,
    gridExportIndex: 6543,
    batteryChargeIndex: 2000,
    batteryDischargeIndex: 1800,
    wallboxes: [
      {
        chargePower: 7400,
        plugged: 1,
        stateCode: 178,
        stateName: 'EV has the permission to charge',
        mode: 'optimized',
      },
    ],
  });
});

test('readSnapshot of a discharging system without statistics', async () => {
  const senec = createFakeSenec(v21Recent());
  const client = clientOf(senec);
  const profile = await identifySystem(client);
  assert.equal(readForm(profile).STATISTIC, undefined);
  assert.equal(readForm(profile).WALLBOX, undefined);
  const snapshot = await readSnapshot(client, profile);
  assert.equal(snapshot.mode, 'discharging');
  assert.equal(snapshot.batteryDischargePower, 800);
  assert.equal(snapshot.batteryChargePower, 0);
  assert.equal(snapshot.gridImportPower, 150);
  assert.equal(snapshot.gridExportPower, 0);
  assert.equal(snapshot.solarIndex, null);
  assert.deepEqual(snapshot.wallboxes, []);
});

test('every raw state belongs to a mode that has a label', () => {
  for (const code of Object.keys(SYSTEM_STATE_NAMES)) {
    const mode = modeOfState(Number(code));
    assert.ok(MODES.includes(mode), `state ${code}`);
    assert.ok(MODE_LABELS[mode], `label of ${mode}`);
  }
  assert.equal(modeOfState(13), 'full');
  assert.equal(modeOfState(15), 'empty');
  assert.equal(modeOfState(8), 'safety_charge');
  assert.equal(modeOfState(250), 'other');
  assert.equal(modeOfState(null), 'unknown');
});

test('wallboxModeOf reads the lock and smart-charge flags', () => {
  assert.equal(wallboxModeOf(1, 3), 'locked');
  assert.equal(wallboxModeOf(0, 3), 'optimized');
  assert.equal(wallboxModeOf(0, 4), 'optimized');
  assert.equal(wallboxModeOf(0, 0), 'fast');
  assert.equal(wallboxModeOf(null, null), 'unknown');
});

test('setSafeCharge sends the order only when needed', async () => {
  const senec = createFakeSenec();
  const client = clientOf(senec);
  await setSafeCharge(client, true);
  assert.deepEqual(
    senec.writes.map((write) => write.key),
    ['SAFE_CHARGE_FORCE'],
  );
  assert.equal(senec.writes[0].value, 'u8_01');
  await setSafeCharge(client, true);
  assert.equal(senec.writes.length, 1, 'already running: nothing sent');
  await setSafeCharge(client, false);
  assert.equal(senec.writes[1].key, 'SAFE_CHARGE_PROHIBIT');
});

test('setWallboxMode writes the slot of the wallbox only', async () => {
  const senec = createFakeSenec();
  const client = clientOf(senec);
  await setWallboxMode(client, 0, 'locked');
  assert.deepEqual(senec.writes, [
    { section: 'WALLBOX', key: 'PROHIBIT_USAGE', value: ['u8_01', '', '', ''] },
    { section: 'WALLBOX', key: 'SMART_CHARGE_ACTIVE', value: ['u8_00', '', '', ''] },
  ]);
  await setWallboxMode(client, 0, 'optimized');
  assert.deepEqual(senec.writes.slice(2), [
    { section: 'WALLBOX', key: 'PROHIBIT_USAGE', value: ['u8_00', '', '', ''] },
    { section: 'WALLBOX', key: 'SMART_CHARGE_ACTIVE', value: ['u8_03', '', '', ''] },
  ]);
  await assert.rejects(setWallboxMode(client, 0, 'turbo'), /Unknown wallbox mode/);
  await assert.rejects(setWallboxMode(client, 4, 'fast'), /Invalid wallbox index/);
});
