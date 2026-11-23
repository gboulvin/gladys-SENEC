// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
//   - read_system      : read a SENEC.Home NOW and hand its values to the
//                        following actions ("at 10 pm, if the battery is above
//                        80 %, start the water heater");
//   - set_safe_charge  : start or stop the safety charge (charge the battery
//                        from the grid during the off-peak hours, before a
//                        storm...);
//   - set_wallbox_mode : lock a SENEC.Wallbox, or charge fast / solar
//                        optimized.
//
// The rules that matter:
//   - `fields` arrive RESOLVED: a `"source": "devices"` field is the chosen
//     device external_id;
//   - only the declared `outputs` (scalars) reach the scene: test/scenes.test.js
//     checks every returned key against the manifest;
//   - a system that does not answer, or a device of the wrong kind, is an
//     OUTPUT (`reachable: false`, `applied: false`), not a failure: a scene
//     action is never a condition, the scene author gates on the output.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { WALLBOX_MODES } from './senec.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTION_KEYS = {
  READ_SYSTEM: 'read_system',
  SET_SAFE_CHARGE: 'set_safe_charge',
  SET_WALLBOX_MODE: 'set_wallbox_mode',
};

// Drop the outputs the system cannot provide: an undeclared or `null` value
// would read as an empty variable in the scene anyway.
function definedOnly(outputs) {
  return Object.fromEntries(
    Object.entries(outputs).filter(([, value]) => value !== null && value !== undefined),
  );
}

/**
 * @param {import('./installation.js').Installation} installation
 */
export function createSceneActions(installation) {
  return {
    async [SCENE_ACTION_KEYS.READ_SYSTEM](_gladys, { fields }) {
      logger.info(`Scene action read_system <- ${fields.device}`);
      const entry =
        installation.findSystem(fields.device) ?? installation.findWallbox(fields.device)?.entry;
      if (!entry) {
        return { reachable: false, operating_mode: 'unknown' };
      }
      await installation.readNow(entry);
      if (!entry.reachable) {
        return { reachable: false, operating_mode: 'unreachable' };
      }
      const { snapshot } = entry;
      return definedOnly({
        reachable: true,
        operating_mode: snapshot.mode,
        state_name: snapshot.stateName,
        battery_level: snapshot.batteryLevel,
        solar_power: snapshot.solarPower,
        house_power: snapshot.housePower,
        grid_import_power: snapshot.gridImportPower,
        grid_export_power: snapshot.gridExportPower,
        battery_charge_power: snapshot.batteryChargePower,
        battery_discharge_power: snapshot.batteryDischargePower,
        safe_charge: snapshot.safeCharge === null ? null : snapshot.safeCharge === 1,
      });
    },

    async [SCENE_ACTION_KEYS.SET_SAFE_CHARGE](_gladys, { fields }) {
      const enabled = fields.state !== 'stop';
      logger.info(`Scene action set_safe_charge <- ${fields.device} ${enabled ? 'start' : 'stop'}`);
      const entry = installation.findSystem(fields.device);
      if (!entry) {
        return { applied: false };
      }
      try {
        const running = await installation.setSafeCharge(entry, enabled);
        return { applied: entry.reachable === true, safe_charge: running };
      } catch (err) {
        logger.warn(`set_safe_charge failed (${err.message})`);
        return { applied: false };
      }
    },

    async [SCENE_ACTION_KEYS.SET_WALLBOX_MODE](_gladys, { fields }) {
      logger.info(`Scene action set_wallbox_mode <- ${fields.device} ${fields.mode}`);
      const wallbox = installation.findWallbox(fields.device);
      if (!wallbox || !WALLBOX_MODES.includes(fields.mode)) {
        return { applied: false };
      }
      try {
        const mode = await installation.setWallboxMode(wallbox.entry, wallbox.index, fields.mode);
        return { applied: mode === fields.mode, mode };
      } catch (err) {
        logger.warn(`set_wallbox_mode failed (${err.message})`);
        return { applied: false };
      }
    },
  };
}
