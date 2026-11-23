// -----------------------------------------------------------------------------
// SENEC.Home: what is read and written through lala.cgi (src/lala.js).
//
// - identifySystem: the serial number (FACTORY.DEVICE_ID), the model, the
//   firmware and the number of SENEC.Wallbox configured — read once;
// - readSnapshot: the live values of one reading cycle;
// - setSafeCharge: start or stop the manual safety charge (the battery charges
//   from the grid up to 100 %, then holds);
// - setWallboxMode: lock a SENEC.Wallbox, or charge in fast / solar-optimized
//   mode.
//
// The field names and state tables come from the SENEC web interface, as
// documented by the Home Assistant integration ha-senec-v3 (Apache-2.0).
// -----------------------------------------------------------------------------

import { encodeU8 } from './lala.js';

export const MAX_WALLBOXES = 4;

// Raw system states (ENERGY.STAT_STATE), as the SENEC web interface names them.
export const SYSTEM_STATE_NAMES = {
  0: 'INITIALSTATE',
  1: 'ERROR INVERTER COMMUNICATION',
  2: 'ERROR ELECTRICITY METER',
  3: 'RIPPLE CONTROL RECEIVER',
  4: 'INITIAL CHARGE',
  5: 'MAINTENANCE CHARGE',
  6: 'MAINTENANCE READY',
  7: 'MAINTENANCE REQUIRED',
  8: 'MAN. SAFETY CHARGE',
  9: 'SAFETY CHARGE READY',
  10: 'FULL CHARGE',
  11: 'EQUALIZATION: CHARGE',
  12: 'DESULFATATION: CHARGE',
  13: 'BATTERY FULL',
  14: 'CHARGE',
  15: 'BATTERY EMPTY',
  16: 'DISCHARGE',
  17: 'PV + DISCHARGE',
  18: 'GRID + DISCHARGE',
  19: 'PASSIVE',
  20: 'OFF',
  21: 'OWN CONSUMPTION',
  22: 'RESTART',
  23: 'MAN. EQUALIZATION: CHARGE',
  24: 'MAN. DESULFATATION: CHARGE',
  25: 'SAFETY CHARGE',
  26: 'BATTERY PROTECTION MODE',
  27: 'EG ERROR',
  28: 'EG CHARGE',
  29: 'EG DISCHARGE',
  30: 'EG PASSIVE',
  31: 'EG PROHIBIT CHARGE',
  32: 'EG PROHIBIT DISCHARGE',
  33: 'EMERGENCY CHARGE',
  34: 'SOFTWARE UPDATE',
  35: 'NSP ERROR',
  36: 'NSP ERROR: GRID',
  37: 'NSP ERROR: HARDWARE',
  38: 'NO SERVER CONNECTION',
  39: 'BMS ERROR',
  40: 'MAINTENANCE: FILTER',
  41: 'BMS SHUTDOWN',
  42: 'WAITING EXCESS',
  43: 'CAPACITY TEST: CHARGE',
  44: 'CAPACITY TEST: DISCHARGE',
  45: 'MAN. DESULFATATION: WAIT',
  46: 'MAN. DESULFATATION: READY',
  47: 'MAN. DESULFATATION: ERROR',
  48: 'EQUALIZATION: WAIT',
  49: 'EMERGENCY CHARGE: ERROR',
  50: 'MAN. EQUALIZATION: WAIT',
  51: 'MAN. EQUALIZATION: ERROR',
  52: 'MAN. EQUALIZATION: READY',
  53: 'AUTO. DESULFATATION: WAIT',
  54: 'ABSORPTION PHASE',
  55: 'DC-SWITCH OFF',
  56: 'PEAK-SHAVING: WAIT',
  57: 'ERROR BATTERY INVERTER',
  58: 'NPU-ERROR',
  59: 'BMS OFFLINE',
  60: 'MAINTENANCE CHARGE ERROR',
  61: 'MAN. SAFETY CHARGE ERROR',
  62: 'SAFETY CHARGE ERROR',
  63: 'NO CONNECTION TO MASTER',
  64: 'LITHIUM SAFE MODE ACTIVE',
  65: 'LITHIUM SAFE MODE DONE',
  66: 'BATTERY VOLTAGE ERROR',
  67: 'BMS DC SWITCHED OFF',
  68: 'GRID INITIALIZATION',
  69: 'GRID STABILIZATION',
  70: 'REMOTE SHUTDOWN',
  71: 'OFFPEAK-CHARGE',
  72: 'ERROR HALFBRIDGE',
  73: 'BMS: ERROR OPERATING TEMPERATURE',
  74: 'FACTORY SETTINGS NOT FOUND',
  75: 'BACKUP POWER MODE - ACTIVE',
  76: 'BACKUP POWER MODE - BATTERY EMPTY',
  77: 'BACKUP POWER MODE ERROR',
  78: 'INITIALISING',
  79: 'INSTALLATION MODE',
  80: 'GRID OFFLINE',
  81: 'BMS UPDATE NEEDED',
  82: 'BMS CONFIGURATION NEEDED',
  83: 'INSULATION TEST',
  84: 'SELFTEST',
  85: 'EXTERNAL CONTROL',
  86: 'ERROR: TEMPERATURESENSOR',
  87: 'GRID OPERATOR: CHARGE PROHIBITED',
  88: 'GRID OPERATOR: DISCHARGE PROHIBITED',
  89: 'SPARE CAPACITY',
  90: 'SELFTEST ERROR',
  91: 'EARTH FAULT',
  92: 'PV-MODE',
  93: 'REMOTE DISCONNECTION',
  94: 'ERROR DRM0',
  95: 'BATTERY DIAGNOSIS',
  96: 'BALANCING',
  97: 'SAFETY DISCHARGE',
  98: 'BMS ERROR - MODULE IMBALANCE',
  99: 'WAKE UP CHARGING',
  100: 'SOX-CALIBRATION',
};

// Raw states of a SENEC.Wallbox (WALLBOX.STATE).
export const WALLBOX_STATE_NAMES = {
  0: 'Invalid',
  161: 'Waiting for EV',
  162: 'Waiting for EV, but locked',
  177: 'EV is asking for charging',
  178: 'EV has the permission to charge',
  193: 'EV is asking for charging, but locked',
  194: 'EV is charged',
  195: 'C2 w. reduced current (error F16, F17)',
  196: 'C2 w. reduced current (imbalance F15)',
  224: 'Charging point disabled by enable input EN1 / key lock or for update',
  225: 'production test',
  226: 'EVCC can be programmed',
  227: 'Bus idle',
  241: 'Unintended closed contact (Welding)',
  242: 'Internal error',
  243: 'DC residual current detected',
  244: 'Upstream communication timeout',
  245: 'Lock of socket failed',
  246: 'CS out of range',
  247: 'State D requested by EV',
  248: 'CP out of range',
  249: 'Overcurrent detected',
  250: 'Temperature outside limits',
  251: 'Unintended opened contact',
  252: 'Reserved State',
  253: 'Reserved State',
};

// Model of the system (FACTORY.SYS_TYPE).
export const SYSTEM_TYPE_NAMES = {
  4: 'SENEC.Home 5.0/7.5/10.0 Lithium',
  5: 'SENEC.Home 15.0 Lithium',
  6: 'SENEC.Business 25.0 Lithium',
  9: 'SENEC.Home V2 5.0/7.5/10.0',
  13: 'SENEC.Business V2 2ph Lithium',
  14: 'SENEC.Business V2 3ph Lithium',
  15: 'SENEC.Home V2.1 1ph Lithium',
  17: 'SENEC.Home V3 hybrid',
  18: 'SENEC.Home V3 hybrid duo',
  19: 'SENEC.Home V3 hybrid',
  20: 'SENEC.Home V3 hybrid LFP',
  21: 'SENEC.Home V3 hybrid duo LFP',
};

// The ~100 raw states, grouped into the operating modes a user acts on
// (MODE_LABELS in src/i18n.js). A state not listed here reads as `other`.
const MODE_GROUPS = {
  charging: [4, 10, 11, 12, 14, 23, 24, 28, 43, 54, 71, 99],
  safety_charge: [8, 25, 33],
  discharging: [16, 17, 18, 29, 44, 97],
  full: [13],
  empty: [15, 76],
  idle: [6, 9, 19, 20, 21, 30, 31, 32, 42, 46, 52, 56, 65, 87, 88, 89, 92],
  maintenance: [5, 7, 22, 34, 40, 45, 48, 50, 53, 68, 69, 78, 79, 81, 82, 83, 84, 95, 96, 100],
  error: [
    1, 2, 27, 35, 36, 37, 38, 39, 41, 47, 49, 51, 55, 57, 58, 59, 60, 61, 62, 63, 66, 67, 70, 72,
    73, 74, 77, 80, 86, 90, 91, 93, 94, 98,
  ],
};

export const MODES = [...Object.keys(MODE_GROUPS), 'other'];

const MODE_OF_STATE = new Map(
  Object.entries(MODE_GROUPS).flatMap(([mode, codes]) => codes.map((code) => [code, mode])),
);

/** The operating mode of a raw system state. */
export function modeOfState(code) {
  if (typeof code !== 'number') {
    return 'unknown';
  }
  return MODE_OF_STATE.get(code) ?? 'other';
}

export const WALLBOX_MODES = ['fast', 'optimized', 'locked'];

// Identification request: a few short values, read once.
const IDENTIFY_FORM = {
  FACTORY: { SYS_TYPE: '', DEVICE_ID: '' },
  WIZARD: { APPLICATION_VERSION: '', SETUP_NUMBER_WALLBOXES: '' },
  SYS_UPDATE: { NPU_IMAGE_VERSION: '' },
  STATISTIC: { LIVE_PV_GEN: '' },
};

const ENERGY_FIELDS = {
  STAT_STATE: '',
  GUI_BAT_DATA_FUEL_CHARGE: '',
  GUI_BAT_DATA_POWER: '',
  GUI_INVERTER_POWER: '',
  GUI_HOUSE_POW: '',
  GUI_GRID_POW: '',
  SAFE_CHARGE_RUNNING: '',
};

const STATISTIC_FIELDS = {
  LIVE_PV_GEN: '',
  LIVE_HOUSE_CONS: '',
  LIVE_GRID_IMPORT: '',
  LIVE_GRID_EXPORT: '',
  LIVE_BAT_CHARGE: '',
  LIVE_BAT_DISCHARGE: '',
};

const WALLBOX_FIELDS = {
  APPARENT_CHARGING_POWER: '',
  EV_CONNECTED: '',
  STATE: '',
  PROHIBIT_USAGE: '',
  SMART_CHARGE_ACTIVE: '',
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const round = (value, digits = 0) =>
  isNumber(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;

/** The platform id of a system: its serial number, filesystem and id safe. */
export function normalizeSerial(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  const serial = String(raw)
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '-');
  return serial === '' || serial === '0' ? null : serial;
}

/**
 * Identify a SENEC.Home.
 * @param {import('./lala.js').LalaClient} client
 */
export async function identifySystem(client) {
  const answer = await client.read(IDENTIFY_FORM);
  const serial = normalizeSerial(answer.FACTORY?.DEVICE_ID);
  if (!serial) {
    throw new Error(`${client.host} answered without a SENEC serial number (FACTORY.DEVICE_ID)`);
  }
  const sysType = answer.FACTORY?.SYS_TYPE;
  const wallboxes = answer.WIZARD?.SETUP_NUMBER_WALLBOXES;
  return {
    serial,
    host: client.host,
    model: SYSTEM_TYPE_NAMES[sysType] ?? 'SENEC.Home',
    sysType: isNumber(sysType) ? sysType : null,
    firmware: answer.WIZARD?.APPLICATION_VERSION ?? null,
    npuImage: answer.SYS_UPDATE?.NPU_IMAGE_VERSION ?? null,
    // The lifetime totals are gone from the recent firmware (NPU image 2408+).
    hasStatistics: isNumber(answer.STATISTIC?.LIVE_PV_GEN),
    wallboxes: isNumber(wallboxes) ? Math.max(0, Math.min(MAX_WALLBOXES, wallboxes)) : 0,
  };
}

function at(section, key, index) {
  const value = section?.[key];
  return Array.isArray(value) ? (value[index] ?? null) : null;
}

/** The charging mode of a wallbox, from its lock and smart-charge flags. */
export function wallboxModeOf(prohibitUsage, smartChargeActive) {
  if (prohibitUsage === 1) {
    return 'locked';
  }
  if (smartChargeActive === 3 || smartChargeActive === 4) {
    return 'optimized';
  }
  if (smartChargeActive === 0) {
    return 'fast';
  }
  return 'unknown';
}

/**
 * Turn a decoded lala.cgi answer into a snapshot.
 * @param {Record<string, Record<string, unknown>>} answer
 * @param {{ wallboxes: number }} profile
 */
export function snapshotOf(answer, profile) {
  const energy = answer.ENERGY ?? {};
  const statistic = answer.STATISTIC ?? {};
  const temperatures = answer.TEMPMEASURE ?? {};
  const batteryPower = isNumber(energy.GUI_BAT_DATA_POWER) ? energy.GUI_BAT_DATA_POWER : null;
  const gridPower = isNumber(energy.GUI_GRID_POW) ? energy.GUI_GRID_POW : null;
  const stateCode = isNumber(energy.STAT_STATE) ? energy.STAT_STATE : null;
  const level = round(energy.GUI_BAT_DATA_FUEL_CHARGE, 1);
  const wallbox = answer.WALLBOX ?? {};
  const wallboxes = [];
  for (let index = 0; index < profile.wallboxes; index += 1) {
    const power = at(wallbox, 'APPARENT_CHARGING_POWER', index);
    const connected = at(wallbox, 'EV_CONNECTED', index);
    const state = at(wallbox, 'STATE', index);
    wallboxes.push({
      // Reported in kW.
      chargePower: isNumber(power) ? Math.max(0, Math.round(power * 1000)) : null,
      plugged: isNumber(connected) ? (connected > 0 ? 1 : 0) : null,
      stateCode: isNumber(state) ? state : null,
      stateName: isNumber(state) ? (WALLBOX_STATE_NAMES[state] ?? `STATE ${state}`) : null,
      mode: wallboxModeOf(
        at(wallbox, 'PROHIBIT_USAGE', index),
        at(wallbox, 'SMART_CHARGE_ACTIVE', index),
      ),
    });
  }
  return {
    stateCode,
    stateName: stateCode === null ? null : (SYSTEM_STATE_NAMES[stateCode] ?? `STATE ${stateCode}`),
    mode: modeOfState(stateCode),
    batteryLevel: level === null ? null : Math.max(0, Math.min(100, level)),
    batteryChargePower: batteryPower === null ? null : Math.round(Math.max(0, batteryPower)),
    batteryDischargePower: batteryPower === null ? null : Math.round(Math.max(0, -batteryPower)),
    // The inverter power is negative on some firmware.
    solarPower: isNumber(energy.GUI_INVERTER_POWER)
      ? Math.round(Math.abs(energy.GUI_INVERTER_POWER))
      : null,
    housePower: isNumber(energy.GUI_HOUSE_POW)
      ? Math.round(Math.max(0, energy.GUI_HOUSE_POW))
      : null,
    gridImportPower: gridPower === null ? null : Math.round(Math.max(0, gridPower)),
    gridExportPower: gridPower === null ? null : Math.round(Math.max(0, -gridPower)),
    safeCharge: isNumber(energy.SAFE_CHARGE_RUNNING)
      ? energy.SAFE_CHARGE_RUNNING > 0
        ? 1
        : 0
      : null,
    batteryTemperature: round(temperatures.BATTERY_TEMP, 1),
    caseTemperature: round(temperatures.CASE_TEMP, 1),
    solarIndex: round(statistic.LIVE_PV_GEN, 3),
    houseIndex: round(statistic.LIVE_HOUSE_CONS, 3),
    gridImportIndex: round(statistic.LIVE_GRID_IMPORT, 3),
    gridExportIndex: round(statistic.LIVE_GRID_EXPORT, 3),
    batteryChargeIndex: round(statistic.LIVE_BAT_CHARGE, 3),
    batteryDischargeIndex: round(statistic.LIVE_BAT_DISCHARGE, 3),
    wallboxes,
  };
}

/** The request of one reading cycle. */
export function readForm(profile) {
  const form = {
    ENERGY: ENERGY_FIELDS,
    TEMPMEASURE: { BATTERY_TEMP: '', CASE_TEMP: '' },
  };
  if (profile.hasStatistics) {
    form.STATISTIC = STATISTIC_FIELDS;
  }
  if (profile.wallboxes > 0) {
    form.WALLBOX = WALLBOX_FIELDS;
  }
  return form;
}

/**
 * Read the live values of a SENEC.Home.
 * @param {import('./lala.js').LalaClient} client
 */
export async function readSnapshot(client, profile) {
  const answer = await client.read(readForm(profile));
  if (!answer.ENERGY) {
    throw new Error(`${client.host} answered without energy values`);
  }
  return snapshotOf(answer, profile);
}

// The three flags the web interface always sends together with the order.
const SAFE_CHARGE_FLAGS = {
  SAFE_CHARGE_FORCE: '',
  SAFE_CHARGE_PROHIBIT: '',
  SAFE_CHARGE_RUNNING: '',
  LI_STORAGE_MODE_START: '',
  LI_STORAGE_MODE_STOP: '',
  LI_STORAGE_MODE_RUNNING: '',
};

/**
 * Start (true) or stop (false) the manual safety charge. Nothing is sent when
 * the system is already in the requested state.
 * @returns {Promise<boolean>} whether the safety charge runs afterwards (as ordered)
 */
export async function setSafeCharge(client, enabled) {
  const current = await client.post({ ENERGY: SAFE_CHARGE_FLAGS });
  const running = current.ENERGY?.SAFE_CHARGE_RUNNING === 1;
  if (running !== enabled) {
    await client.post({
      ENERGY: {
        ...SAFE_CHARGE_FLAGS,
        [enabled ? 'SAFE_CHARGE_FORCE' : 'SAFE_CHARGE_PROHIBIT']: encodeU8(1),
      },
    });
  }
  return enabled;
}

/**
 * Set the charging mode of one wallbox (index 0 to 3). The values are arrays
 * of 4 wallboxes: the others stay empty, so they keep their own mode.
 */
export async function setWallboxMode(client, index, mode) {
  if (!WALLBOX_MODES.includes(mode)) {
    throw new Error(`Unknown wallbox mode: ${mode}`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= MAX_WALLBOXES) {
    throw new Error(`Invalid wallbox index: ${index}`);
  }
  const slot = (value) =>
    Array.from({ length: MAX_WALLBOXES }, (_, i) => (i === index ? value : ''));
  await client.post({
    WALLBOX: {
      PROHIBIT_USAGE: slot(encodeU8(mode === 'locked' ? 1 : 0)),
      SMART_CHARGE_ACTIVE: slot(encodeU8(mode === 'optimized' ? 3 : 0)),
    },
  });
  return mode;
}
