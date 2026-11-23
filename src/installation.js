// -----------------------------------------------------------------------------
// The SENEC installation: the configured systems, their identification, the
// reading loop, the commands and what is published to Gladys.
//
// Every `poll_frequency` seconds, each SENEC.Home is read through lala.cgi.
// Then:
//   - its states go to Gladys with publishChangedStates — only the values that
//     changed, plus a heartbeat — for the devices the user created;
//   - its transitions fire the scene triggers (src/triggers.js);
//   - its reachability feeds the transport badge and the connection status;
//   - the dashboard widgets are nudged.
//
// The lala.cgi client is injectable (`createClient`), so the tests plug a
// simulated SENEC instead of the network.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { parseHosts } from './config.js';
import { LalaClient } from './lala.js';
import { identifySystem, readSnapshot, setSafeCharge, setWallboxMode } from './senec.js';
import {
  buildDevices,
  buildStates,
  FEATURE_KEYS,
  systemIds,
  systemName,
  wallboxIds,
  wallboxName,
} from './devices.js';
import { detectEvents } from './triggers.js';
import { text } from './i18n.js';

const logger = createLogger({ name: 'installation' });

// Re-send an unchanged value every 15 minutes, so it stays recently dated.
const STATE_HEARTBEAT_MS = 15 * 60 * 1000;

const defaultCreateClient = ({ host, protocol }) => new LalaClient({ host, protocol });

export class Installation {
  /**
   * @param {{ gladys: object, createClient?: (options: object) => object,
   *   onChange?: () => void }} options
   */
  constructor({ gladys, createClient = defaultCreateClient, onChange = () => {} }) {
    this.gladys = gladys;
    this.createClient = createClient;
    this.onChange = onChange;
    this.config = null;
    this.invalidHosts = [];
    // `protocol://host` -> { host, client, profile, reachable, snapshot, readAt, error, tracking }
    this.entries = new Map();
    this.createdDevices = new Set();
    this.timer = null;
    this.cycle = null;
    this.connectionStatus = null;
  }

  // --- Configuration and identification -------------------------------------

  /** Apply a (new) configuration: the systems no longer listed are forgotten. */
  configure(config) {
    this.config = config;
    // A new configuration (or a reconnection) re-sends the status.
    this.connectionStatus = null;
    const { hosts, invalid } = parseHosts(config);
    this.invalidHosts = invalid;
    const entries = new Map();
    for (const host of hosts) {
      const key = `${config.protocol}://${host}`;
      entries.set(
        key,
        this.entries.get(key) ?? {
          host,
          client: this.createClient({ host, protocol: config.protocol }),
          profile: null,
          reachable: null,
          snapshot: null,
          readAt: null,
          error: null,
          tracking: {},
        },
      );
    }
    this.entries = entries;
  }

  async identify(entry) {
    const profile = await identifySystem(entry.client);
    const changed = JSON.stringify(profile) !== JSON.stringify(entry.profile);
    if (changed) {
      logger.info(`${entry.host}: ${systemName(profile)} identified`);
    }
    entry.profile = profile;
    return changed;
  }

  /**
   * Identify every configured system (again). A system that does not answer
   * keeps the profile identified earlier, if any.
   * @returns {Promise<Array<{ host: string, profile: object | null, error: string | null }>>}
   */
  async discover() {
    const results = [];
    for (const entry of this.entries.values()) {
      try {
        await this.identify(entry);
        entry.error = null;
      } catch (err) {
        entry.error = err.message;
        logger.warn(`${entry.host}: identification failed (${err.message})`);
      }
      results.push({ host: entry.host, profile: entry.profile, error: entry.error });
    }
    return results;
  }

  /** The discovery payload: each identified system and its wallboxes. */
  discoveredDevices() {
    return this.systems().flatMap((entry) => buildDevices(this.gladys, entry.profile));
  }

  async publishDiscoveredDevices() {
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
  }

  /** Track the devices the user created in Gladys: only those get states. */
  async refreshCreatedDevices() {
    const devices = await this.gladys.getDevices();
    this.createdDevices = new Set(devices.map((device) => device.external_id));
  }

  isCreated(externalId) {
    return this.createdDevices.has(externalId);
  }

  // --- Reading ---------------------------------------------------------------

  /**
   * Read every system once. Overlapping calls share the same cycle: a slow
   * network never stacks requests on the systems.
   */
  pollAll() {
    if (!this.cycle) {
      this.cycle = this.runCycle().finally(() => {
        this.cycle = null;
      });
    }
    return this.cycle;
  }

  async runCycle() {
    let discoveryChanged = false;
    for (const entry of this.entries.values()) {
      discoveryChanged = (await this.poll(entry)) || discoveryChanged;
    }
    if (discoveryChanged) {
      await this.publishDiscoveredDevices();
    }
    await this.publishTransports();
    await this.publishConnectionStatus();
    this.onChange();
  }

  /**
   * Read one system and publish what changed.
   * @returns {Promise<boolean>} whether its profile changed (newly identified)
   */
  async poll(entry) {
    let profileChanged = false;
    try {
      if (!entry.profile) {
        // Not identified yet (unreachable at start): try again.
        profileChanged = await this.identify(entry);
      }
      entry.snapshot = await readSnapshot(entry.client, entry.profile);
      entry.reachable = true;
      entry.readAt = new Date();
      entry.error = null;
    } catch (err) {
      if (entry.reachable !== false) {
        logger.warn(`${entry.host}: not reachable (${err.message})`);
      }
      entry.reachable = false;
      entry.error = err.message;
    }
    if (entry.profile) {
      await this.publish(entry);
    }
    return profileChanged;
  }

  wallboxesOf(entry) {
    return Array.from({ length: entry.profile.wallboxes }, (_, index) => ({
      index,
      device: wallboxIds(this.gladys, entry.profile, index).device,
      deviceName: wallboxName(entry.profile, index),
    }));
  }

  async publish(entry) {
    const { profile } = entry;
    const device = systemIds(this.gladys, profile).device;
    const { tracking, events } = detectEvents(
      entry.tracking,
      { reachable: entry.reachable, snapshot: entry.snapshot },
      {
        device,
        deviceName: systemName(profile),
        threshold: this.config.surplus_threshold,
        wallboxes: this.wallboxesOf(entry),
      },
    );
    entry.tracking = tracking;
    try {
      if (entry.reachable) {
        const states = buildStates(this.gladys, profile, entry.snapshot).filter((state) =>
          this.isCreated(state.device_feature_external_id.split(':').slice(0, -1).join(':')),
        );
        if (states.length > 0) {
          await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
        }
      }
      for (const { key, data } of events) {
        if (this.isCreated(data.device)) {
          logger.info(`Scene event ${key} <- ${data.device_name}`);
          await this.gladys.publishSceneEvent(key, data);
        }
      }
    } catch (err) {
      logger.error(`${entry.host}: publication failed`, err);
    }
  }

  // --- Commands --------------------------------------------------------------

  /**
   * Start or stop the safety charge of a system, then read it again so the
   * switch reflects what the system confirms.
   */
  async setSafeCharge(entry, enabled) {
    logger.info(`${entry.host}: safety charge ${enabled ? 'start' : 'stop'}`);
    await setSafeCharge(entry.client, enabled);
    await this.readNow(entry);
    return entry.snapshot?.safeCharge === 1;
  }

  /** Set the charging mode of a wallbox, then read the system again. */
  async setWallboxMode(entry, index, mode) {
    logger.info(`${entry.host}: wallbox ${index + 1} mode ${mode}`);
    await setWallboxMode(entry.client, index, mode);
    await this.readNow(entry);
    return entry.snapshot?.wallboxes[index]?.mode ?? 'unknown';
  }

  /** A command from Gladys (onSetValue). Throws when it cannot be applied. */
  async setValue(device, feature, value) {
    const featureKey = feature.external_id.slice(device.external_id.length + 1);
    const system = this.findSystem(device.external_id);
    if (system && featureKey === FEATURE_KEYS.SAFE_CHARGE) {
      await this.setSafeCharge(system, Number(value) === 1);
      return;
    }
    const wallbox = this.findWallbox(device.external_id);
    if (wallbox && featureKey === FEATURE_KEYS.WALLBOX_MODE) {
      await this.setWallboxMode(wallbox.entry, wallbox.index, String(value));
      return;
    }
    throw new Error(`${feature.external_id} cannot be controlled`);
  }

  // --- Status ----------------------------------------------------------------

  /** Transport badge: the systems are read on the LAN, or not at all. */
  transportEntries() {
    const entries = [];
    for (const entry of this.systems()) {
      if (entry.reachable === null) {
        continue;
      }
      const transport = entry.reachable ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.UNREACHABLE;
      entries.push({ external_id: systemIds(this.gladys, entry.profile).device, transport });
      for (const wallbox of this.wallboxesOf(entry)) {
        entries.push({ external_id: wallbox.device, transport });
      }
    }
    return entries;
  }

  async publishTransports() {
    const entries = this.transportEntries().filter((entry) => this.isCreated(entry.external_id));
    if (entries.length > 0) {
      await this.gladys.publishTransports(entries).catch((err) => {
        logger.error('publishTransports failed', err);
      });
    }
  }

  /** The application-level status of the Configuration screen. */
  connectionState() {
    if (this.entries.size === 0) {
      return {
        connected: false,
        message: text(
          'Enter the IP address of your SENEC.Home.',
          "Saisissez l'adresse IP de votre SENEC.Home.",
          'Geben Sie die IP-Adresse Ihres SENEC.Home ein.',
          'Introduzca la dirección IP de su SENEC.Home.',
        ),
      };
    }
    const entries = [...this.entries.values()];
    if (entries.some((entry) => entry.reachable)) {
      return { connected: true };
    }
    if (entries.every((entry) => entry.reachable === null)) {
      return { connected: false };
    }
    return {
      connected: false,
      message: text(
        'No SENEC.Home answers. Check its IP address and the protocol (HTTPS or HTTP).',
        'Aucun SENEC.Home ne répond. Vérifiez son adresse IP et le protocole (HTTPS ou HTTP).',
        'Kein SENEC.Home antwortet. Prüfen Sie die IP-Adresse und das Protokoll (HTTPS oder HTTP).',
        'Ningún SENEC.Home responde. Compruebe su dirección IP y el protocolo (HTTPS o HTTP).',
      ),
    };
  }

  async publishConnectionStatus() {
    const { connected, message } = this.connectionState();
    const key = JSON.stringify([connected, message?.en]);
    if (key === this.connectionStatus || (!connected && !message)) {
      return;
    }
    this.connectionStatus = key;
    await this.gladys.setConnectionStatus(connected, message).catch((err) => {
      logger.error('setConnectionStatus failed', err);
    });
  }

  // --- Loop ------------------------------------------------------------------

  start() {
    this.stop();
    const run = () => this.pollAll().catch((err) => logger.error('Reading cycle failed', err));
    run();
    this.timer = setInterval(run, this.config.poll_frequency * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // --- Queries (widgets, scene actions) --------------------------------------

  /** The entries of the identified systems, one per serial number. */
  systems() {
    const bySerial = new Map();
    for (const entry of this.entries.values()) {
      if (entry.profile && !bySerial.has(entry.profile.serial)) {
        bySerial.set(entry.profile.serial, entry);
      }
    }
    return [...bySerial.values()];
  }

  findSystem(externalId) {
    return (
      this.systems().find((entry) => systemIds(this.gladys, entry.profile).device === externalId) ??
      null
    );
  }

  /** @returns {{ entry: object, index: number } | null} */
  findWallbox(externalId) {
    for (const entry of this.systems()) {
      const wallbox = this.wallboxesOf(entry).find((candidate) => candidate.device === externalId);
      if (wallbox) {
        return { entry, index: wallbox.index };
      }
    }
    return null;
  }

  /** Read one system now (scene action, widget button, command), outside the loop. */
  async readNow(entry) {
    await this.poll(entry);
    await this.publishTransports();
    this.onChange();
    return entry;
  }
}
