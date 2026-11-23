// -----------------------------------------------------------------------------
// Gladys devices built from the identified SENEC.Home systems.
//
// - one device per SENEC.Home, keyed by its serial number (never by its IP
//   address, which DHCP can change): battery, solar production, house
//   consumption, grid exchange, temperatures, operating state, and the safety
//   charge switch;
// - one device per SENEC.Wallbox configured on it, keyed by the serial number
//   of the system and its position (1 to 4): charging power, vehicle plugged,
//   state, and the charging mode select.
//
// Feature keys are forever: Gladys keys the history, the scenes and the
// dashboards on them. Add new ones, never rename one.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { WALLBOX_MODES } from './senec.js';
import { WALLBOX_MODE_LABELS } from './i18n.js';

export const SYSTEM_TYPE = 'senec';
export const WALLBOX_TYPE = 'senec-wallbox';

export const FEATURE_KEYS = {
  SAFE_CHARGE: 'safe-charge',
  WALLBOX_MODE: 'mode',
};

const always = () => true;
const statistics = (profile) => profile.hasStatistics;

const power = (key, value, name, category, type) => ({
  key,
  value,
  name,
  category,
  type,
  unit: UNITS.WATT,
  min: 0,
  max: 100000,
  when: always,
});

const index = (key, value, name, category, type) => ({
  key,
  value,
  name,
  category,
  type,
  unit: UNITS.KILOWATT_HOUR,
  min: 0,
  max: 100000000,
  when: statistics,
});

// `value` is the key of the snapshot built by src/senec.js.
export const SYSTEM_FEATURES = [
  {
    key: 'battery-level',
    value: 'batteryLevel',
    name: 'Battery level',
    category: CATEGORIES.BATTERY_STORAGE,
    type: TYPES.BATTERY_STORAGE.BATTERY_LEVEL,
    unit: UNITS.PERCENT,
    min: 0,
    max: 100,
    when: always,
  },
  power(
    'battery-charge-power',
    'batteryChargePower',
    'Battery charge power',
    CATEGORIES.BATTERY_STORAGE,
    TYPES.BATTERY_STORAGE.CHARGE_POWER,
  ),
  power(
    'battery-discharge-power',
    'batteryDischargePower',
    'Battery discharge power',
    CATEGORIES.BATTERY_STORAGE,
    TYPES.BATTERY_STORAGE.DISCHARGE_POWER,
  ),
  power(
    'solar-power',
    'solarPower',
    'Solar production',
    CATEGORIES.ENERGY_PRODUCTION_SENSOR,
    TYPES.ENERGY_PRODUCTION_SENSOR.POWER,
  ),
  power(
    'house-power',
    'housePower',
    'House consumption',
    CATEGORIES.HOME_OUTPUT_SENSOR,
    TYPES.HOME_OUTPUT_SENSOR.POWER,
  ),
  power(
    'grid-import-power',
    'gridImportPower',
    'Power drawn from the grid',
    CATEGORIES.GRID_SENSOR,
    TYPES.GRID_SENSOR.INPUT_POWER,
  ),
  power(
    'grid-export-power',
    'gridExportPower',
    'Power fed into the grid',
    CATEGORIES.GRID_SENSOR,
    TYPES.GRID_SENSOR.OUTPUT_POWER,
  ),
  index(
    'solar-index',
    'solarIndex',
    'Total solar production',
    CATEGORIES.ENERGY_PRODUCTION_SENSOR,
    TYPES.ENERGY_PRODUCTION_SENSOR.INDEX,
  ),
  index(
    'house-index',
    'houseIndex',
    'Total house consumption',
    CATEGORIES.HOME_OUTPUT_SENSOR,
    TYPES.HOME_OUTPUT_SENSOR.INDEX,
  ),
  index(
    'grid-import-index',
    'gridImportIndex',
    'Energy drawn from the grid',
    CATEGORIES.GRID_SENSOR,
    TYPES.GRID_SENSOR.INPUT_INDEX,
  ),
  index(
    'grid-export-index',
    'gridExportIndex',
    'Energy fed into the grid',
    CATEGORIES.GRID_SENSOR,
    TYPES.GRID_SENSOR.OUTPUT_INDEX,
  ),
  index(
    'battery-charge-index',
    'batteryChargeIndex',
    'Battery energy charged',
    CATEGORIES.BATTERY_STORAGE,
    TYPES.BATTERY_STORAGE.CHARGE_INDEX,
  ),
  index(
    'battery-discharge-index',
    'batteryDischargeIndex',
    'Battery energy discharged',
    CATEGORIES.BATTERY_STORAGE,
    TYPES.BATTERY_STORAGE.DISCHARGE_INDEX,
  ),
  {
    // The temperatures of the system itself: probes, kept out of the room
    // average.
    key: 'battery-temperature',
    value: 'batteryTemperature',
    name: 'Battery temperature',
    category: CATEGORIES.TEMPERATURE_SENSOR,
    type: TYPES.TEMPERATURE_SENSOR.PROBE,
    unit: UNITS.CELSIUS,
    min: -40,
    max: 100,
    when: always,
  },
  {
    key: 'case-temperature',
    value: 'caseTemperature',
    name: 'Case temperature',
    category: CATEGORIES.TEMPERATURE_SENSOR,
    type: TYPES.TEMPERATURE_SENSOR.PROBE,
    unit: UNITS.CELSIUS,
    min: -40,
    max: 100,
    when: always,
  },
  {
    // The raw state as the SENEC web interface names it (text state).
    key: 'system-state',
    value: 'stateName',
    text: true,
    name: 'System state',
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    when: always,
    history: false,
  },
  {
    key: FEATURE_KEYS.SAFE_CHARGE,
    value: 'safeCharge',
    name: 'Safety charge',
    category: CATEGORIES.SWITCH,
    type: TYPES.SWITCH.BINARY,
    min: 0,
    max: 1,
    writable: true,
    when: always,
  },
];

export const WALLBOX_FEATURES = [
  {
    key: 'charge-power',
    value: 'chargePower',
    name: 'Charging power',
    category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
    type: TYPES.ELECTRICAL_VEHICLE_CHARGE.CHARGE_POWER,
    unit: UNITS.WATT,
    min: 0,
    max: 50000,
  },
  {
    key: 'plugged',
    value: 'plugged',
    name: 'Vehicle plugged',
    category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
    type: TYPES.ELECTRICAL_VEHICLE_CHARGE.PLUGGED,
    min: 0,
    max: 1,
  },
  {
    key: 'state',
    value: 'stateName',
    text: true,
    name: 'Wallbox state',
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    history: false,
  },
  {
    key: FEATURE_KEYS.WALLBOX_MODE,
    value: 'mode',
    text: true,
    name: 'Charging mode',
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.SELECT,
    min: 0,
    max: 0,
    writable: true,
    history: false,
    supported_options: WALLBOX_MODES.map((mode, position) => ({
      value: mode,
      label: WALLBOX_MODE_LABELS[mode].en,
      sort_order: position,
    })),
  },
];

export function systemIds(gladys, profile) {
  return gladys.externalIds(SYSTEM_TYPE, profile.serial);
}

export function wallboxIds(gladys, profile, index) {
  return gladys.externalIds(WALLBOX_TYPE, `${profile.serial}-${index + 1}`);
}

export function systemName(profile) {
  return `${profile.model} ${profile.serial}`;
}

export function wallboxName(profile, index) {
  return `SENEC.Wallbox ${index + 1} (${profile.serial})`;
}

export function systemFeaturesOf(profile) {
  return SYSTEM_FEATURES.filter((feature) => feature.when(profile));
}

/** External id of a feature of a system, `null` when it does not carry it. */
export function systemFeatureId(gladys, profile, key) {
  return systemFeaturesOf(profile).some((feature) => feature.key === key)
    ? systemIds(gladys, profile).feature(key)
    : null;
}

function buildFeature(ids, feature) {
  const built = {
    name: feature.name,
    external_id: ids.feature(feature.key),
    category: feature.category,
    type: feature.type,
    min: feature.min,
    max: feature.max,
    read_only: !feature.writable,
    // A command is confirmed by the next reading of the system.
    has_feedback: Boolean(feature.writable),
    keep_history: feature.history !== false,
  };
  if (feature.unit) {
    built.unit = feature.unit;
  }
  if (feature.supported_options) {
    built.supported_options = feature.supported_options;
  }
  return built;
}

/** The discovery payload of one SENEC.Home and of its wallboxes. */
export function buildDevices(gladys, profile) {
  const ids = systemIds(gladys, profile);
  const devices = [
    {
      name: systemName(profile),
      external_id: ids.device,
      model: profile.model,
      features: systemFeaturesOf(profile).map((feature) => buildFeature(ids, feature)),
    },
  ];
  for (let index = 0; index < profile.wallboxes; index += 1) {
    const wallbox = wallboxIds(gladys, profile, index);
    devices.push({
      name: wallboxName(profile, index),
      external_id: wallbox.device,
      model: 'SENEC.Wallbox',
      features: WALLBOX_FEATURES.map((feature) => buildFeature(wallbox, feature)),
    });
  }
  return devices;
}

function statesOf(ids, features, values) {
  const states = [];
  for (const feature of features) {
    const value = values[feature.value];
    if (feature.text && typeof value === 'string' && value !== '' && value !== 'unknown') {
      states.push({ device_feature_external_id: ids.feature(feature.key), text: value });
    } else if (!feature.text && typeof value === 'number') {
      states.push({ device_feature_external_id: ids.feature(feature.key), state: value });
    }
  }
  return states;
}

/**
 * The states of one reading, ready for publishChangedStates. Values the
 * system could not fill (`null`) are left out: Gladys keeps the last one.
 */
export function buildStates(gladys, profile, snapshot) {
  const states = statesOf(systemIds(gladys, profile), systemFeaturesOf(profile), snapshot);
  snapshot.wallboxes.forEach((wallbox, index) => {
    states.push(...statesOf(wallboxIds(gladys, profile, index), WALLBOX_FEATURES, wallbox));
  });
  return states;
}
