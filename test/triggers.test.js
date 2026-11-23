import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents, TRIGGERS } from '../src/triggers.js';

const context = {
  device: 'ext:x:senec:1',
  deviceName: 'SENEC.Home V3 hybrid 1',
  threshold: 500,
  wallboxes: [{ device: 'ext:x:senec-wallbox:1-1', deviceName: 'SENEC.Wallbox 1 (1)' }],
};

const reading = (values = {}, wallbox = {}) => ({
  reachable: true,
  snapshot: {
    mode: 'charging',
    stateName: 'CHARGE',
    batteryLevel: 50,
    gridExportPower: 0,
    wallboxes: [{ plugged: 0, ...wallbox }],
    ...values,
  },
});

// Feed readings one after the other, return the keys fired by each.
function run(readings) {
  let tracking = {};
  return readings.map((next) => {
    const result = detectEvents(tracking, next, context);
    tracking = result.tracking;
    return result.events;
  });
}

test('the first reading only records the state', () => {
  const [events] = run([reading({ batteryLevel: 100, gridExportPower: 3000 }, { plugged: 1 })]);
  assert.deepEqual(events, []);
});

test('battery_full fires once at 100 %, again only after falling below 95 %', () => {
  const fired = run([
    reading({ batteryLevel: 98 }),
    reading({ batteryLevel: 100, mode: 'full', stateName: 'BATTERY FULL' }),
    reading({ batteryLevel: 99 }),
    reading({ batteryLevel: 100 }),
    reading({ batteryLevel: 94 }),
    reading({ batteryLevel: 100 }),
  ]).map((events) => events.filter((e) => e.key === TRIGGERS.BATTERY_FULL).length);
  assert.deepEqual(fired, [0, 1, 0, 0, 0, 1]);
});

test('battery_empty fires on 0 % or the empty state', () => {
  const events = run([
    reading({ batteryLevel: 3 }),
    reading({ batteryLevel: 2, mode: 'empty' }),
    reading({ batteryLevel: 1, mode: 'empty' }),
    reading({ batteryLevel: 10, mode: 'charging' }),
    reading({ batteryLevel: 0, mode: 'idle' }),
  ]).map((list) => list.filter((e) => e.key === TRIGGERS.BATTERY_EMPTY));
  assert.deepEqual(
    events.map((list) => list.length),
    [0, 1, 0, 0, 1],
  );
  assert.deepEqual(events[1][0].data, {
    device: context.device,
    device_name: context.deviceName,
    battery_level: 2,
  });
});

test('operating_mode_changed carries the new and the previous mode', () => {
  const events = run([
    reading(),
    reading({ mode: 'discharging', stateName: 'DISCHARGE' }),
    reading({ mode: 'discharging', stateName: 'DISCHARGE' }),
    { reachable: false, snapshot: null },
  ]).map((list) => list.filter((e) => e.key === TRIGGERS.OPERATING_MODE_CHANGED));
  assert.deepEqual(events[1][0].data, {
    device: context.device,
    device_name: context.deviceName,
    mode: 'discharging',
    previous_mode: 'charging',
    state_name: 'DISCHARGE',
  });
  assert.equal(events[2].length, 0);
  assert.equal(events[3][0].data.mode, 'unreachable');
  assert.equal(events[3][0].data.state_name, '');
});

test('surplus_started / surplus_stopped with hysteresis', () => {
  const keys = run([
    reading({ gridExportPower: 100 }),
    reading({ gridExportPower: 600 }),
    reading({ gridExportPower: 300 }),
    reading({ gridExportPower: 200 }),
    reading({ gridExportPower: 700 }),
  ]).map((list) => list.map((e) => e.key));
  assert.deepEqual(keys, [
    [],
    [TRIGGERS.SURPLUS_STARTED],
    [],
    [TRIGGERS.SURPLUS_STOPPED],
    [TRIGGERS.SURPLUS_STARTED],
  ]);
});

test('ev_plugged / ev_unplugged name the wallbox', () => {
  const events = run([
    reading({}, { plugged: 0 }),
    reading({}, { plugged: 1 }),
    reading({}, { plugged: null }),
    reading({}, { plugged: 0 }),
  ]);
  assert.deepEqual(events[1], [
    {
      key: TRIGGERS.EV_PLUGGED,
      data: { device: 'ext:x:senec-wallbox:1-1', device_name: 'SENEC.Wallbox 1 (1)' },
    },
  ]);
  assert.deepEqual(events[2], []);
  assert.equal(events[3][0].key, TRIGGERS.EV_UNPLUGGED);
});
