import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  createWidgets,
  formatAge,
  formatPower,
  refreshWidgets,
  WIDGET_KEYS,
} from '../src/widgets.js';
import { setup } from './helpers/setup.js';

const request = (settings = {}) => ({ settings, language: 'en', units: 'metric' });

async function ready(options) {
  const context = await setup(options);
  await context.installation.pollAll();
  return { ...context, widgets: createWidgets(context.installation) };
}

test('senec_overview is rendered exactly as sent', async () => {
  const { gladys, widgets, ids } = await ready();
  for (const settings of [{}, { device: ids[0] }]) {
    const content = await widgets[WIDGET_KEYS.OVERVIEW].get(gladys, request(settings));
    assert.deepEqual(validateWidgetContent(content), []);
    assert.deepEqual(
      content.components.map((component) => component.type),
      ['value', 'value', 'value', 'value', 'gauge', 'chart', 'status', 'button'],
    );
    assert.deepEqual(content.components[0], {
      type: 'value',
      label: { en: 'Solar', fr: 'Solaire', de: 'Solar', es: 'Solar' },
      icon: 'sun',
      value: 4.2,
      unit: 'kW',
    });
    assert.equal(content.components[2].label.en, 'To grid');
    assert.equal(content.components[5].device_features[0], `${ids[0]}:battery-level`);
    assert.equal(content.components[7].action.key, 'safe_charge_start');
  }
});

test('senec_overview of an unreachable system keeps the refresh button', async () => {
  const { gladys, widgets, installation, senec } = await ready();
  senec.online = false;
  await installation.pollAll();
  const content = await widgets[WIDGET_KEYS.OVERVIEW].get(gladys, request());
  assert.deepEqual(validateWidgetContent(content), []);
  const status = content.components.find((component) => component.type === 'status');
  assert.equal(status.items[0].value.en, 'Unreachable');
  const buttons = content.components.filter((component) => component.type === 'button');
  assert.deepEqual(
    buttons.map((button) => button.action.key),
    ['refresh'],
  );
});

test('senec_overview without any system explains what to do', async () => {
  const { gladys, widgets } = await ready({ hosts: [] });
  const content = await widgets[WIDGET_KEYS.OVERVIEW].get(gladys, request());
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});

test('the overview buttons start and stop the safety charge', async () => {
  const { gladys, widgets, senec } = await ready();
  const button = async () =>
    (await widgets[WIDGET_KEYS.OVERVIEW].get(gladys, request())).components.find(
      (component) => component.type === 'button',
    );
  let { action } = await button();
  let toast = await widgets[WIDGET_KEYS.OVERVIEW].action(gladys, {
    actionKey: action.key,
    params: action.params,
  });
  assert.equal(toast.fr, 'Charge de sécurité lancée.');
  assert.equal(senec.writes.at(-1).key, 'SAFE_CHARGE_FORCE');
  ({ action } = await button());
  assert.equal(action.key, 'safe_charge_stop');
  toast = await widgets[WIDGET_KEYS.OVERVIEW].action(gladys, {
    actionKey: action.key,
    params: action.params,
  });
  assert.equal(toast.de, 'Sicherheitsladung beendet.');
});

test('senec_wallbox shows the wallbox and one button per mode', async () => {
  const { gladys, widgets, ids, senec } = await ready();
  const content = await widgets[WIDGET_KEYS.WALLBOX].get(gladys, request({ device: ids[1] }));
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].device_feature, `${ids[1]}:charge-power`);
  const buttons = content.components.filter((component) => component.type === 'button');
  assert.deepEqual(
    buttons.map((button) => [button.action.key, button.style]),
    [
      ['mode_fast', 'secondary'],
      ['mode_optimized', 'primary'],
      ['mode_locked', 'secondary'],
    ],
  );
  const toast = await widgets[WIDGET_KEYS.WALLBOX].action(gladys, {
    actionKey: buttons[0].action.key,
    params: buttons[0].action.params,
  });
  assert.equal(toast.es, 'Modo de carga: Rápido.');
  assert.deepEqual(senec.writes.at(-1).value, ['u8_00', '', '', '']);
});

test('senec_wallbox of a device that is not a wallbox says so', async () => {
  const { gladys, widgets, ids } = await ready();
  const content = await widgets[WIDGET_KEYS.WALLBOX].get(gladys, request({ device: ids[0] }));
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});

test('every toast exists in every language, unknown actions fail', async () => {
  const { gladys, widgets, ids } = await ready();
  const toast = await widgets[WIDGET_KEYS.OVERVIEW].action(gladys, {
    actionKey: 'refresh',
    params: { device: ids[0] },
  });
  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.ok(toast[language].length > 0 && toast[language].length <= 200);
  }
  await assert.rejects(
    widgets[WIDGET_KEYS.OVERVIEW].action(gladys, { actionKey: 'nope', params: {} }),
    /Unknown widget action/,
  );
  await assert.rejects(
    widgets[WIDGET_KEYS.WALLBOX].action(gladys, {
      actionKey: 'mode_turbo',
      params: { device: ids[1] },
    }),
    /Unknown widget action/,
  );
});

test('formatPower switches to kW above 1000 W', () => {
  assert.deepEqual(formatPower(850.4), { value: 850, unit: 'W' });
  assert.deepEqual(formatPower(3456), { value: 3.46, unit: 'kW' });
  assert.deepEqual(formatPower(null), { value: '–', unit: 'W' });
});

test('formatAge reads in every language', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  assert.equal(formatAge(new Date('2026-06-01T11:55:00Z'), now).de, 'Vor 5 Min.');
  assert.equal(formatAge(new Date('2026-06-01T09:00:00Z'), now).es, 'Hace 3 h');
  assert.equal(formatAge(null, now).fr, 'Jamais');
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.values(WIDGET_KEYS));
});
