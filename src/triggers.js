// -----------------------------------------------------------------------------
// Scene triggers (manifest `scene_triggers`, Gladys 5.1+).
//
// The values themselves (battery level, powers...) are device features: the
// standard "device state" trigger of Gladys already covers thresholds on them.
// These triggers carry what a single state cannot: a TRANSITION, with its
// details.
//
//   - battery_full / battery_empty : the battery reaches 100 % / runs out;
//   - operating_mode_changed       : charging, discharging, safety charge,
//                                    error... or unreachable;
//   - surplus_started / surplus_stopped : the power fed into the grid crosses
//                                    the configured threshold (hysteresis);
//   - ev_plugged / ev_unplugged    : a vehicle is plugged into / unplugged
//                                    from a SENEC.Wallbox.
//
// One event per transition, never one per reading: the core admits 300
// events per minute per integration. The first reading after a start only
// records the state. Pure functions, tested in test/triggers.test.js.
// -----------------------------------------------------------------------------

export const TRIGGERS = {
  BATTERY_FULL: 'battery_full',
  BATTERY_EMPTY: 'battery_empty',
  OPERATING_MODE_CHANGED: 'operating_mode_changed',
  SURPLUS_STARTED: 'surplus_started',
  SURPLUS_STOPPED: 'surplus_stopped',
  EV_PLUGGED: 'ev_plugged',
  EV_UNPLUGGED: 'ev_unplugged',
};

export const TRIGGER_KEYS = Object.values(TRIGGERS);

// The battery is full at 100 % and stops being so below 95 %; it is empty at
// 0 % (or when the system says so) and stops being so from 5 %.
const FULL_LEVEL = 100;
const FULL_RESET_LEVEL = 95;
const EMPTY_LEVEL = 0;
const EMPTY_RESET_LEVEL = 5;
// The surplus stops below half the threshold: a cloud must not fire
// started / stopped / started...
const STOP_RATIO = 0.5;

function flag(previous, isOn, isOff) {
  if (isOn) {
    return true;
  }
  if (isOff) {
    return false;
  }
  return previous ?? false;
}

/**
 * Compute the events of a new reading of a SENEC.Home.
 *
 * @param {object} previous tracking state of the system (empty before its
 *   first reading)
 * @param {{ reachable: boolean, snapshot: object | null }} reading
 * @param {{ device: string, deviceName: string, threshold: number,
 *   wallboxes: Array<{ device: string, deviceName: string }> }} context
 */
export function detectEvents(previous, reading, { device, deviceName, threshold, wallboxes }) {
  const events = [];
  const first = previous.mode === undefined;
  const snapshot = reading.reachable ? reading.snapshot : null;
  const mode = snapshot ? snapshot.mode : 'unreachable';
  const tracking = { ...previous, mode };
  const emit = (key, data) => {
    if (!first) {
      events.push({ key, data: { device, device_name: deviceName, ...data } });
    }
  };

  if (snapshot) {
    const level = typeof snapshot.batteryLevel === 'number' ? snapshot.batteryLevel : null;
    if (level !== null || mode === 'empty' || mode === 'full') {
      const full = flag(
        previous.full,
        (level !== null && level >= FULL_LEVEL) || mode === 'full',
        level !== null && level < FULL_RESET_LEVEL,
      );
      if (full && previous.full === false) {
        emit(TRIGGERS.BATTERY_FULL, { battery_level: level ?? FULL_LEVEL });
      }
      tracking.full = full;

      const empty = flag(
        previous.empty,
        (level !== null && level <= EMPTY_LEVEL) || mode === 'empty',
        level !== null && level >= EMPTY_RESET_LEVEL && mode !== 'empty',
      );
      if (empty && previous.empty === false) {
        emit(TRIGGERS.BATTERY_EMPTY, { battery_level: level ?? EMPTY_LEVEL });
      }
      tracking.empty = empty;
    }

    const exported = snapshot.gridExportPower;
    if (typeof exported === 'number') {
      const surplus = flag(
        previous.surplus,
        exported >= threshold,
        exported < threshold * STOP_RATIO,
      );
      if (surplus && previous.surplus === false) {
        emit(TRIGGERS.SURPLUS_STARTED, { export_power: exported });
      } else if (!surplus && previous.surplus === true) {
        emit(TRIGGERS.SURPLUS_STOPPED, { export_power: exported });
      }
      tracking.surplus = surplus;
    }

    tracking.plugged = wallboxes.map((wallbox, index) => {
      const plugged = snapshot.wallboxes[index]?.plugged;
      const before = previous.plugged?.[index];
      if (typeof plugged !== 'number') {
        return before;
      }
      if (!first && before !== undefined && before !== plugged) {
        events.push({
          key: plugged ? TRIGGERS.EV_PLUGGED : TRIGGERS.EV_UNPLUGGED,
          data: { device: wallbox.device, device_name: wallbox.deviceName },
        });
      }
      return plugged;
    });
  }

  if (!first && previous.mode !== mode) {
    emit(TRIGGERS.OPERATING_MODE_CHANGED, {
      mode,
      previous_mode: previous.mode,
      state_name: snapshot?.stateName ?? '',
    });
  }

  return { tracking, events };
}
