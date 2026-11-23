import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSceneActions } from '../src/scenes.js';
import { setup } from './helpers/setup.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

function assertDeclaredOutputs(key, outputs) {
  const declared = new Map(
    declarationOf('scene_actions', key).outputs.map((output) => [output.key, output.type]),
  );
  for (const [name, value] of Object.entries(outputs)) {
    assert.ok(declared.has(name), `output "${name}" is not declared, the core would drop it`);
    assert.equal(typeof value, declared.get(name), `output "${name}" type`);
  }
}

test('read_system returns the current values', async () => {
  const { gladys, installation, ids } = await setup();
  const actions = createSceneActions(installation);
  const outputs = await actions.read_system(gladys, { fields: { device: ids[0] } });
  assert.deepEqual(outputs, {
    reachable: true,
    operating_mode: 'charging',
    state_name: 'CHARGE',
    battery_level: 76.4,
    solar_power: 4200,
    house_power: 900,
    grid_import_power: 0,
    grid_export_power: 1800,
    battery_charge_power: 1501,
    battery_discharge_power: 0,
    safe_charge: false,
  });
  assertDeclaredOutputs('read_system', outputs);
  // The wallbox reads its system.
  const fromWallbox = await actions.read_system(gladys, { fields: { device: ids[1] } });
  assert.equal(fromWallbox.battery_level, 76.4);
});

test('read_system reports an unreachable or unknown system through its outputs', async () => {
  const { gladys, installation, ids, senec } = await setup();
  const actions = createSceneActions(installation);
  senec.online = false;
  const outputs = await actions.read_system(gladys, { fields: { device: ids[0] } });
  assert.deepEqual(outputs, { reachable: false, operating_mode: 'unreachable' });
  const unknown = await actions.read_system(gladys, { fields: { device: 'ext:x:senec:9' } });
  assert.deepEqual(unknown, { reachable: false, operating_mode: 'unknown' });
  assertDeclaredOutputs('read_system', outputs);
});

test('set_safe_charge starts and stops the safety charge', async () => {
  const { gladys, installation, ids, senec } = await setup();
  const actions = createSceneActions(installation);
  const started = await actions.set_safe_charge(gladys, {
    fields: { device: ids[0], state: 'start' },
  });
  assert.deepEqual(started, { applied: true, safe_charge: true });
  assert.equal(senec.writes.at(-1).key, 'SAFE_CHARGE_FORCE');
  const stopped = await actions.set_safe_charge(gladys, {
    fields: { device: ids[0], state: 'stop' },
  });
  assert.deepEqual(stopped, { applied: true, safe_charge: false });
  assertDeclaredOutputs('set_safe_charge', started);
});

test('set_safe_charge on the wrong device or an unreachable system is not applied', async () => {
  const { gladys, installation, ids, senec } = await setup();
  const actions = createSceneActions(installation);
  assert.deepEqual(
    await actions.set_safe_charge(gladys, { fields: { device: ids[1], state: 'start' } }),
    { applied: false },
  );
  senec.online = false;
  assert.deepEqual(
    await actions.set_safe_charge(gladys, { fields: { device: ids[0], state: 'start' } }),
    { applied: false },
  );
});

test('set_wallbox_mode changes the charging mode', async () => {
  const { gladys, installation, ids } = await setup();
  const actions = createSceneActions(installation);
  const outputs = await actions.set_wallbox_mode(gladys, {
    fields: { device: ids[1], mode: 'locked' },
  });
  assert.deepEqual(outputs, { applied: true, mode: 'locked' });
  assertDeclaredOutputs('set_wallbox_mode', outputs);
  assert.deepEqual(
    await actions.set_wallbox_mode(gladys, { fields: { device: ids[0], mode: 'fast' } }),
    { applied: false },
  );
  assert.deepEqual(
    await actions.set_wallbox_mode(gladys, { fields: { device: ids[1], mode: 'turbo' } }),
    { applied: false },
  );
});

test('scene events only carry keys their trigger declares, every trigger fires', async () => {
  const { gladys, installation, senec } = await setup();
  await installation.pollAll();
  senec.set('ENERGY', 'GUI_BAT_DATA_FUEL_CHARGE', 100);
  senec.set('ENERGY', 'STAT_STATE', 13, 'u8');
  senec.set('ENERGY', 'GUI_GRID_POW', 100);
  senec.raw.WALLBOX.EV_CONNECTED[0] = 'u8_00';
  await installation.pollAll();
  senec.set('ENERGY', 'GUI_BAT_DATA_FUEL_CHARGE', 0);
  senec.set('ENERGY', 'STAT_STATE', 15, 'u8');
  senec.set('ENERGY', 'GUI_GRID_POW', -2000);
  senec.raw.WALLBOX.EV_CONNECTED[0] = 'u8_01';
  await installation.pollAll();

  const fired = new Set(gladys.fake.sceneEvents.map((event) => event.key));
  assert.deepEqual([...fired].sort(), keysOf(manifest.scene_triggers).sort(), 'all fired');
  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = declarationOf('scene_triggers', key);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `${key}: data.${name} primitive`);
    }
    const filter = trigger.fields.find((field) => field.key === 'mode');
    if (filter) {
      assert.ok(
        filter.options.some((option) => option.value === data.mode),
        data.mode,
      );
    }
  }
});
