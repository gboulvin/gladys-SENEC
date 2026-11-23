import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/setup.js';

const statesOf = (gladys) =>
  Object.fromEntries(
    gladys.fake.states.map((state) => [
      state.device_feature_external_id.split(':').slice(-1)[0] +
        (state.device_feature_external_id.includes('wallbox') ? '@wallbox' : ''),
      state.state ?? state.text,
    ]),
  );

test('discovery publishes the system and its wallbox, keyed by serial number', async () => {
  const { gladys, installation, ids } = await setup();
  await installation.publishDiscoveredDevices();
  const devices = gladys.fake.discoveredDevices;
  assert.deepEqual(ids, [
    'ext:test-integration:senec:1234567',
    'ext:test-integration:senec-wallbox:1234567-1',
  ]);
  assert.equal(devices[0].name, 'SENEC.Home V3 hybrid 1234567');
  assert.equal(devices[1].name, 'SENEC.Wallbox 1 (1234567)');
  for (const device of devices) {
    for (const feature of device.features) {
      for (const key of ['name', 'min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
      }
    }
  }
  const writable = devices.flatMap((device) =>
    device.features.filter((feature) => !feature.read_only).map((f) => f.external_id),
  );
  assert.deepEqual(writable, [
    'ext:test-integration:senec:1234567:safe-charge',
    'ext:test-integration:senec-wallbox:1234567-1:mode',
  ]);
});

test('a system without statistics has no energy index', async () => {
  const { installation } = await setup({ hosts: ['192.168.1.41'] });
  const [device] = installation.discoveredDevices();
  assert.ok(!device.features.some((feature) => feature.external_id.endsWith('-index')));
  assert.equal(installation.discoveredDevices().length, 1);
});

test('a reading publishes the states of the created devices', async () => {
  const { gladys, installation } = await setup();
  await installation.pollAll();
  assert.deepEqual(statesOf(gladys), {
    'battery-level': 76.4,
    'battery-charge-power': 1501,
    'battery-discharge-power': 0,
    'solar-power': 4200,
    'house-power': 900,
    'grid-import-power': 0,
    'grid-export-power': 1800,
    'solar-index': 12345.5,
    'house-index': 9876.25,
    'grid-import-index': 3210,
    'grid-export-index': 6543,
    'battery-charge-index': 2000,
    'battery-discharge-index': 1800,
    'battery-temperature': 24.5,
    'case-temperature': 31.3,
    'system-state': 'CHARGE',
    'safe-charge': 0,
    'charge-power@wallbox': 7400,
    'plugged@wallbox': 1,
    'state@wallbox': 'EV has the permission to charge',
    'mode@wallbox': 'optimized',
  });
  assert.deepEqual(gladys.fake.transports, [
    { device_external_id: 'ext:test-integration:senec:1234567', transport: 'local' },
    { device_external_id: 'ext:test-integration:senec-wallbox:1234567-1', transport: 'local' },
  ]);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a device not created in Gladys receives nothing', async () => {
  const { gladys, installation } = await setup({ create: false });
  await installation.pollAll();
  assert.equal(gladys.fake.states.length, 0);
  assert.equal(gladys.fake.transports.length, 0);
});

test('an unreachable system shows on the badge and the connection status', async () => {
  const { gladys, installation, senec } = await setup();
  await installation.pollAll();
  senec.online = false;
  await installation.pollAll();
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Aucun SENEC.Home ne répond/);
});

test('a system unreachable at start is identified at a later reading', async () => {
  const { gladys, installation, senec } = await setup({ create: false });
  installation.configure({ ...installation.config, hosts: '192.168.1.40' });
  installation.entries.get('https://192.168.1.40').profile = null;
  senec.online = false;
  await installation.pollAll();
  assert.equal(installation.discoveredDevices().length, 0);
  senec.online = true;
  await installation.pollAll();
  assert.equal(gladys.fake.discoveredDevices.length, 2);
});

test('no address configured asks for one', async () => {
  const { gladys, installation } = await setup({ hosts: [] });
  await installation.pollAll();
  assert.match(gladys.fake.connectionStatus.message.de, /IP-Adresse/);
});

test('the safety charge switch starts and stops the safety charge', async () => {
  const { gladys, installation, senec, ids } = await setup();
  const device = { external_id: ids[0] };
  await installation.setValue(device, { external_id: `${ids[0]}:safe-charge` }, 1);
  assert.equal(senec.writes.at(-1).key, 'SAFE_CHARGE_FORCE');
  assert.equal(statesOf(gladys)['safe-charge'], 1);
  assert.equal(statesOf(gladys)['system-state'], 'MAN. SAFETY CHARGE');
  await installation.setValue(device, { external_id: `${ids[0]}:safe-charge` }, 0);
  assert.equal(senec.writes.at(-1).key, 'SAFE_CHARGE_PROHIBIT');
  assert.equal(statesOf(gladys)['safe-charge'], 0);
});

test('the wallbox mode select changes the charging mode', async () => {
  const { gladys, installation, senec, ids } = await setup();
  await installation.setValue({ external_id: ids[1] }, { external_id: `${ids[1]}:mode` }, 'fast');
  assert.deepEqual(senec.writes.at(-1).value, ['u8_00', '', '', '']);
  assert.equal(statesOf(gladys)['mode@wallbox'], 'fast');
});

test('a read-only feature cannot be controlled', async () => {
  const { installation, ids } = await setup();
  await assert.rejects(
    installation.setValue({ external_id: ids[0] }, { external_id: `${ids[0]}:battery-level` }, 1),
    /cannot be controlled/,
  );
});

test('overlapping readings share the same cycle', async () => {
  const { installation, senec } = await setup();
  const before = senec.requests.length;
  await Promise.all([installation.pollAll(), installation.pollAll()]);
  assert.equal(senec.requests.length - before, 1);
});
