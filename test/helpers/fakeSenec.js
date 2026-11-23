// -----------------------------------------------------------------------------
// A simulated SENEC.Home answering lala.cgi requests, in memory.
//
// It holds raw encoded values (as the real system sends them), answers the
// sections and keys it is asked for, applies writes the way the system does
// (safety charge, wallbox modes) and refuses requests longer than the real
// limit. `online = false` makes it stop answering.
// -----------------------------------------------------------------------------

import { encodeFloat, encodeU8, LalaClient, MAX_REQUEST_LENGTH } from '../../src/lala.js';

const u8 = encodeU8;
const fl = encodeFloat;
const u3 = (value) => `u3_${value.toString(16).toUpperCase().padStart(8, '0')}`;

/** A SENEC.Home V3 hybrid with one wallbox, on a firmware with statistics. */
export function v3Hybrid() {
  return {
    FACTORY: { SYS_TYPE: u8(19), DEVICE_ID: u3(1234567) },
    WIZARD: { APPLICATION_VERSION: 'st_0826', SETUP_NUMBER_WALLBOXES: u8(1) },
    SYS_UPDATE: { NPU_IMAGE_VERSION: 'u1_0960' },
    STATISTIC: {
      LIVE_PV_GEN: fl(12345.5),
      LIVE_HOUSE_CONS: fl(9876.25),
      LIVE_GRID_IMPORT: fl(3210),
      LIVE_GRID_EXPORT: fl(6543),
      LIVE_BAT_CHARGE: fl(2000),
      LIVE_BAT_DISCHARGE: fl(1800),
    },
    ENERGY: {
      STAT_STATE: u8(14),
      GUI_BAT_DATA_FUEL_CHARGE: fl(76.4),
      GUI_BAT_DATA_POWER: fl(1500.6),
      GUI_INVERTER_POWER: fl(-4200.2),
      GUI_HOUSE_POW: fl(900.4),
      GUI_GRID_POW: fl(-1800),
      SAFE_CHARGE_RUNNING: u8(0),
      SAFE_CHARGE_FORCE: '',
      SAFE_CHARGE_PROHIBIT: '',
      LI_STORAGE_MODE_START: '',
      LI_STORAGE_MODE_STOP: '',
      LI_STORAGE_MODE_RUNNING: u8(0),
    },
    TEMPMEASURE: { BATTERY_TEMP: fl(24.5), CASE_TEMP: fl(31.25) },
    WALLBOX: {
      APPARENT_CHARGING_POWER: [fl(7.4), fl(0), fl(0), fl(0)],
      EV_CONNECTED: [u8(1), u8(0), u8(0), u8(0)],
      STATE: [u8(178), u8(0), u8(0), u8(0)],
      PROHIBIT_USAGE: [u8(0), u8(0), u8(0), u8(0)],
      SMART_CHARGE_ACTIVE: [u8(3), u8(0), u8(0), u8(0)],
    },
  };
}

/** A SENEC.Home V2.1 on a recent firmware: no statistics, no wallbox. */
export function v21Recent() {
  const raw = v3Hybrid();
  raw.FACTORY = { SYS_TYPE: u8(15), DEVICE_ID: 'st_DE-0042' };
  raw.WIZARD.SETUP_NUMBER_WALLBOXES = u8(0);
  raw.SYS_UPDATE.NPU_IMAGE_VERSION = 'u1_0970';
  raw.STATISTIC = { LIVE_PV_GEN: 'VARIABLE_NOT_FOUND' };
  delete raw.WALLBOX;
  raw.ENERGY.STAT_STATE = u8(16);
  raw.ENERGY.GUI_BAT_DATA_FUEL_CHARGE = fl(40);
  raw.ENERGY.GUI_BAT_DATA_POWER = fl(-800);
  raw.ENERGY.GUI_INVERTER_POWER = fl(0);
  raw.ENERGY.GUI_GRID_POW = fl(150);
  return raw;
}

export function createFakeSenec(raw = v3Hybrid()) {
  const senec = {
    raw,
    online: true,
    requests: [],
    writes: [],
    /** Set a decoded value, e.g. senec.set('ENERGY', 'GUI_GRID_POW', -900). */
    set(section, key, value, type = 'fl') {
      senec.raw[section][key] = type === 'fl' ? fl(value) : u8(value);
    },
    async transport({ body }) {
      if (!senec.online) {
        throw Object.assign(new Error('connect EHOSTUNREACH'), { code: 'EHOSTUNREACH' });
      }
      if (body.length > MAX_REQUEST_LENGTH) {
        return { status: 400, headers: {}, body: '' };
      }
      const form = JSON.parse(body);
      senec.requests.push(form);
      const answer = {};
      for (const [section, values] of Object.entries(form)) {
        const stored = senec.raw[section];
        if (!stored) {
          continue;
        }
        answer[section] = {};
        for (const [key, value] of Object.entries(values)) {
          if (Array.isArray(value) ? value.some((v) => v !== '') : value !== '') {
            senec.writes.push({ section, key, value });
            senec.apply(section, key, value);
          }
          answer[section][key] = stored[key] ?? 'VARIABLE_NOT_FOUND';
        }
      }
      return {
        status: 200,
        headers: { 'set-cookie': ['session=abc123; Path=/; HttpOnly'] },
        body: JSON.stringify(answer),
      };
    },
    apply(section, key, value) {
      if (section === 'ENERGY' && key === 'SAFE_CHARGE_FORCE') {
        senec.raw.ENERGY.SAFE_CHARGE_RUNNING = u8(1);
        senec.raw.ENERGY.STAT_STATE = u8(8);
      } else if (section === 'ENERGY' && key === 'SAFE_CHARGE_PROHIBIT') {
        senec.raw.ENERGY.SAFE_CHARGE_RUNNING = u8(0);
        senec.raw.ENERGY.STAT_STATE = u8(14);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item !== '') {
            senec.raw[section][key][index] = item;
          }
        });
      } else {
        senec.raw[section][key] = value;
      }
    },
  };
  return senec;
}

/** A createClient for Installation: each host answered by its fake system. */
export function fakeNetwork(systems) {
  return ({ host, protocol }) =>
    new LalaClient({
      host,
      protocol,
      transport: (request) => {
        const senec = systems[host];
        if (!senec) {
          return Promise.reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
        }
        return senec.transport(request);
      },
    });
}
