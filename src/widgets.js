// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+).
//
//   - senec_overview: one SENEC.Home chosen by the dashboard author (the first
//     one when not chosen) — energy flows now, battery gauge, operating mode,
//     battery level chart, and buttons to start / stop the safety charge;
//   - senec_wallbox: one SENEC.Wallbox — charging power, vehicle plugged,
//     charging mode, and one button per mode.
//
// The content is declarative (the core renders it with its own theme, dark
// mode and translations). Tiles bound to a device feature are live: they
// follow the published states with no refresh. The computed parts are cached
// by the core until `ttl_seconds`, and index.js nudges the widgets after every
// reading cycle. test/widgets.test.js checks every content with the SDK's
// validateWidgetContent.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { MODE_LABELS, WALLBOX_MODE_LABELS, text } from './i18n.js';
import { systemFeatureId, systemIds, wallboxIds } from './devices.js';
import { WALLBOX_MODES } from './senec.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = {
  OVERVIEW: 'senec_overview',
  WALLBOX: 'senec_wallbox',
};

// One action key per wallbox mode: a widget cannot carry two buttons with
// the same action key.
const MODE_ACTIONS = Object.fromEntries(WALLBOX_MODES.map((mode) => [`mode_${mode}`, mode]));

const ACTIONS = {
  REFRESH: 'refresh',
  SAFE_CHARGE_START: 'safe_charge_start',
  SAFE_CHARGE_STOP: 'safe_charge_stop',
};

const MODE_COLORS = {
  charging: WIDGET_COLORS.SUCCESS,
  discharging: WIDGET_COLORS.INFO,
  full: WIDGET_COLORS.SUCCESS,
  empty: WIDGET_COLORS.WARNING,
  idle: WIDGET_COLORS.NEUTRAL,
  safety_charge: WIDGET_COLORS.WARNING,
  maintenance: WIDGET_COLORS.WARNING,
  error: WIDGET_COLORS.DANGER,
  other: WIDGET_COLORS.NEUTRAL,
  unreachable: WIDGET_COLORS.WARNING,
  unknown: WIDGET_COLORS.NEUTRAL,
};

const LABELS = {
  solar: text('Solar', 'Solaire', 'Solar', 'Solar'),
  house: text('House', 'Maison', 'Haus', 'Casa'),
  fromGrid: text('From grid', 'Soutirage réseau', 'Netzbezug', 'Desde la red'),
  toGrid: text('To grid', 'Injection réseau', 'Einspeisung', 'Hacia la red'),
  charge: text('Battery charge', 'Charge batterie', 'Akku-Ladung', 'Carga batería'),
  discharge: text('Battery discharge', 'Décharge batterie', 'Akku-Entladung', 'Descarga batería'),
  battery: text('Battery', 'Batterie', 'Batterie', 'Batería'),
  chart: text('Battery level', 'Niveau de batterie', 'Akkustand', 'Nivel de batería'),
  mode: text('Operating mode', 'Mode de fonctionnement', 'Betriebsmodus', 'Modo de funcionamiento'),
  state: text('System state', 'État du système', 'Systemzustand', 'Estado del sistema'),
  safeCharge: text(
    'Safety charge',
    'Charge de sécurité',
    'Sicherheitsladung',
    'Carga de seguridad',
  ),
  running: text('Running', 'En cours', 'Läuft', 'En curso'),
  stopped: text('Off', 'Arrêtée', 'Aus', 'Desactivada'),
  lastReading: text('Last reading', 'Dernière lecture', 'Letzte Messung', 'Última lectura'),
  never: text('Never', 'Jamais', 'Nie', 'Nunca'),
  // Button labels: 24 characters at most.
  start: text(
    'Start safety charge',
    'Lancer charge sécurité',
    'Sicherheitsladung an',
    'Iniciar carga seguridad',
  ),
  stop: text(
    'Stop safety charge',
    'Arrêter charge sécurité',
    'Sicherheitsladung aus',
    'Detener carga seguridad',
  ),
  refresh: text('Refresh', 'Actualiser', 'Aktualisieren', 'Actualizar'),
  chargePower: text('Charging power', 'Puissance de charge', 'Ladeleistung', 'Potencia de carga'),
  vehicle: text('Vehicle', 'Véhicule', 'Fahrzeug', 'Vehículo'),
  plugged: text('Plugged in', 'Branché', 'Angesteckt', 'Conectado'),
  unplugged: text('Not plugged in', 'Non branché', 'Nicht angesteckt', 'No conectado'),
  chargingMode: text('Charging mode', 'Mode de charge', 'Lademodus', 'Modo de carga'),
  wallboxState: text(
    'Wallbox state',
    'État de la wallbox',
    'Wallbox-Zustand',
    'Estado del wallbox',
  ),
};

const NO_SYSTEM = text(
  'No SENEC.Home yet: enter its IP address in the integration configuration, then add it from the Discovery tab.',
  "Aucun SENEC.Home pour l'instant : saisissez son adresse IP dans la configuration de l'intégration, puis ajoutez-le depuis l'onglet Découverte.",
  'Noch kein SENEC.Home: Geben Sie seine IP-Adresse in der Konfiguration der Integration ein und fügen Sie es im Reiter Erkennung hinzu.',
  'Aún no hay ningún SENEC.Home: introduzca su dirección IP en la configuración de la integración y añádalo desde la pestaña Descubrimiento.',
);

const UNKNOWN_WALLBOX = text(
  'Pick a SENEC.Wallbox in the widget settings.',
  'Choisissez une SENEC.Wallbox dans les réglages du widget.',
  'Wählen Sie eine SENEC.Wallbox in den Widget-Einstellungen.',
  'Elija un SENEC.Wallbox en los ajustes del widget.',
);

const TOASTS = {
  refreshed: text(
    'Values read from the SENEC.Home.',
    'Valeurs relues sur le SENEC.Home.',
    'Werte vom SENEC.Home gelesen.',
    'Valores leídos del SENEC.Home.',
  ),
  started: text(
    'Safety charge started.',
    'Charge de sécurité lancée.',
    'Sicherheitsladung gestartet.',
    'Carga de seguridad iniciada.',
  ),
  stopped: text(
    'Safety charge stopped.',
    'Charge de sécurité arrêtée.',
    'Sicherheitsladung beendet.',
    'Carga de seguridad detenida.',
  ),
  mode: (mode) =>
    text(
      `Charging mode: ${WALLBOX_MODE_LABELS[mode].en}.`,
      `Mode de charge : ${WALLBOX_MODE_LABELS[mode].fr}.`,
      `Lademodus: ${WALLBOX_MODE_LABELS[mode].de}.`,
      `Modo de carga: ${WALLBOX_MODE_LABELS[mode].es}.`,
    ),
  unreachable: text(
    'The SENEC.Home does not answer.',
    'Le SENEC.Home ne répond pas.',
    'Das SENEC.Home antwortet nicht.',
    'El SENEC.Home no responde.',
  ),
};

/** A power in W, as a tile value: W below 1 kW, kW above. */
export function formatPower(watts) {
  if (watts === null || watts === undefined) {
    return { value: '–', unit: 'W' };
  }
  if (Math.abs(watts) < 1000) {
    return { value: Math.round(watts), unit: 'W' };
  }
  return { value: Math.round(watts / 10) / 100, unit: 'kW' };
}

/** How long ago, as a multi-language text. */
export function formatAge(date, now = new Date()) {
  if (!date) {
    return LABELS.never;
  }
  const minutes = Math.floor((now - date) / 60000);
  if (minutes < 1) {
    return text('Just now', "À l'instant", 'Gerade eben', 'Ahora mismo');
  }
  if (minutes < 60) {
    return text(
      `${minutes} min ago`,
      `Il y a ${minutes} min`,
      `Vor ${minutes} Min.`,
      `Hace ${minutes} min`,
    );
  }
  const hours = Math.floor(minutes / 60);
  return text(`${hours} h ago`, `Il y a ${hours} h`, `Vor ${hours} Std.`, `Hace ${hours} h`);
}

function modeOf(entry) {
  if (entry.reachable === false) {
    return 'unreachable';
  }
  return entry.snapshot?.mode ?? 'unknown';
}

/**
 * @param {import('./installation.js').Installation} installation
 */
export function createWidgets(installation) {
  const { gladys } = installation;

  function chosenSystem(settings) {
    if (settings.device) {
      return (
        installation.findSystem(settings.device) ??
        installation.findWallbox(settings.device)?.entry ??
        null
      );
    }
    return installation.systems()[0] ?? null;
  }

  function overview(settings) {
    const entry = chosenSystem(settings);
    if (!entry) {
      return { ttl_seconds: 300, components: [{ type: 'text', text: NO_SYSTEM }] };
    }
    const snapshot = entry.reachable ? entry.snapshot : null;
    const device = systemIds(gladys, entry.profile).device;
    const mode = modeOf(entry);
    const components = [
      { type: 'value', label: LABELS.solar, icon: 'sun', ...formatPower(snapshot?.solarPower) },
      { type: 'value', label: LABELS.house, icon: 'home', ...formatPower(snapshot?.housePower) },
    ];
    if (snapshot && snapshot.gridExportPower > 0) {
      components.push({
        type: 'value',
        label: LABELS.toGrid,
        icon: 'arrow-up-circle',
        ...formatPower(snapshot.gridExportPower),
      });
    } else {
      components.push({
        type: 'value',
        label: LABELS.fromGrid,
        icon: 'arrow-down-circle',
        ...formatPower(snapshot?.gridImportPower),
      });
    }
    if (snapshot && snapshot.batteryDischargePower > 0) {
      components.push({
        type: 'value',
        label: LABELS.discharge,
        icon: 'battery',
        ...formatPower(snapshot.batteryDischargePower),
      });
    } else {
      components.push({
        type: 'value',
        label: LABELS.charge,
        icon: 'battery-charging',
        ...formatPower(snapshot?.batteryChargePower),
      });
    }
    if (typeof snapshot?.batteryLevel === 'number') {
      components.push({
        type: 'gauge',
        label: LABELS.battery,
        value: Math.round(snapshot.batteryLevel),
        min: 0,
        max: 100,
        unit: '%',
        color: snapshot.batteryLevel < 20 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      });
    }
    // The chart reads the history Gladys keeps: only a created device has one.
    const levelFeature = systemFeatureId(gladys, entry.profile, 'battery-level');
    if (installation.isCreated(device) && levelFeature) {
      components.push({
        type: 'chart',
        title: LABELS.chart,
        chart_type: 'line',
        device_features: [levelFeature],
        interval: 'last-day',
      });
    }
    const safeCharge = snapshot?.safeCharge === 1;
    const items = [
      {
        label: LABELS.mode,
        icon: mode === 'unreachable' ? 'wifi-off' : 'activity',
        value: MODE_LABELS[mode],
        color: MODE_COLORS[mode],
      },
    ];
    if (snapshot?.stateName) {
      items.push({
        label: LABELS.state,
        icon: 'info',
        value: snapshot.stateName,
        color: WIDGET_COLORS.NEUTRAL,
      });
    }
    if (snapshot) {
      items.push({
        label: LABELS.safeCharge,
        icon: 'zap',
        value: safeCharge ? LABELS.running : LABELS.stopped,
        color: safeCharge ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
      });
    }
    items.push({
      label: LABELS.lastReading,
      icon: 'clock',
      value: formatAge(entry.readAt),
      color: WIDGET_COLORS.NEUTRAL,
    });
    components.push({ type: 'status', items });
    const params = { device };
    if (snapshot) {
      components.push({
        type: 'button',
        label: safeCharge ? LABELS.stop : LABELS.start,
        icon: 'zap',
        style: safeCharge ? 'secondary' : 'primary',
        action: {
          key: safeCharge ? ACTIONS.SAFE_CHARGE_STOP : ACTIONS.SAFE_CHARGE_START,
          params,
        },
      });
    } else {
      // Unreachable: a manual retry instead (8 components at most).
      components.push({
        type: 'button',
        label: LABELS.refresh,
        icon: 'refresh-cw',
        style: 'secondary',
        action: { key: ACTIONS.REFRESH, params },
      });
    }
    return { ttl_seconds: 60, components };
  }

  function wallbox(settings) {
    const found = installation.findWallbox(settings.device);
    if (!found) {
      return { ttl_seconds: 300, components: [{ type: 'text', text: UNKNOWN_WALLBOX }] };
    }
    const { entry, index } = found;
    const ids = wallboxIds(gladys, entry.profile, index);
    const created = installation.isCreated(ids.device);
    const data = entry.reachable ? entry.snapshot?.wallboxes[index] : null;
    const components = [
      created
        ? {
            type: 'value',
            label: LABELS.chargePower,
            icon: 'zap',
            device_feature: ids.feature('charge-power'),
          }
        : {
            type: 'value',
            label: LABELS.chargePower,
            icon: 'zap',
            ...formatPower(data?.chargePower),
          },
    ];
    const mode = data?.mode ?? 'unknown';
    const items = [
      {
        label: LABELS.vehicle,
        icon: 'truck',
        value: data?.plugged === 1 ? LABELS.plugged : LABELS.unplugged,
        color: data?.plugged === 1 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
      },
      {
        label: LABELS.chargingMode,
        icon: mode === 'locked' ? 'lock' : 'sliders',
        value: WALLBOX_MODE_LABELS[mode],
        color: mode === 'locked' ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO,
      },
    ];
    if (data?.stateName) {
      items.push({
        label: LABELS.wallboxState,
        icon: 'info',
        value: data.stateName,
        color: WIDGET_COLORS.NEUTRAL,
      });
    }
    if (!entry.reachable) {
      items.push({
        label: LABELS.mode,
        icon: 'wifi-off',
        value: MODE_LABELS.unreachable,
        color: WIDGET_COLORS.WARNING,
      });
    }
    components.push({ type: 'status', items });
    if (data) {
      for (const [key, candidate] of Object.entries(MODE_ACTIONS)) {
        components.push({
          type: 'button',
          label: WALLBOX_MODE_LABELS[candidate],
          icon: candidate === 'locked' ? 'lock' : candidate === 'fast' ? 'zap' : 'sun',
          style: candidate === mode ? 'primary' : 'secondary',
          action: { key, params: { device: ids.device } },
        });
      }
    }
    return { ttl_seconds: 60, components };
  }

  return {
    [WIDGET_KEYS.OVERVIEW]: {
      async get(_gladys, { settings = {} } = {}) {
        logger.debug(`onWidgetGet <- ${WIDGET_KEYS.OVERVIEW}`);
        return overview(settings);
      },
      async action(_gladys, { actionKey, params = {} }) {
        logger.info(`onWidgetAction <- ${WIDGET_KEYS.OVERVIEW}.${actionKey}`);
        if (!Object.values(ACTIONS).includes(actionKey)) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        const entry = installation.findSystem(params.device);
        if (!entry) {
          await installation.pollAll();
          return TOASTS.refreshed;
        }
        if (actionKey === ACTIONS.REFRESH) {
          await installation.readNow(entry);
          return entry.reachable ? TOASTS.refreshed : TOASTS.unreachable;
        }
        const start = actionKey === ACTIONS.SAFE_CHARGE_START;
        await installation.setSafeCharge(entry, start);
        if (!entry.reachable) {
          return TOASTS.unreachable;
        }
        return start ? TOASTS.started : TOASTS.stopped;
      },
    },
    [WIDGET_KEYS.WALLBOX]: {
      async get(_gladys, { settings = {} } = {}) {
        logger.debug(`onWidgetGet <- ${WIDGET_KEYS.WALLBOX}`);
        return wallbox(settings);
      },
      async action(_gladys, { actionKey, params = {} }) {
        logger.info(`onWidgetAction <- ${WIDGET_KEYS.WALLBOX}.${actionKey}`);
        const requested = MODE_ACTIONS[actionKey];
        if (!requested) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        const found = installation.findWallbox(params.device);
        if (!found) {
          throw new Error('Unknown SENEC.Wallbox');
        }
        const mode = await installation.setWallboxMode(found.entry, found.index, requested);
        return found.entry.reachable
          ? TOASTS.mode(mode === 'unknown' ? requested : mode)
          : TOASTS.unreachable;
      },
    },
  };
}

/**
 * Freshness nudge: ask the core to re-pull every widget now (rate-limited
 * core-side to 1 per 10 s per widget, dropped while disconnected).
 */
export function refreshWidgets(gladys) {
  for (const key of Object.values(WIDGET_KEYS)) {
    gladys.requestWidgetRefresh(key);
  }
}
