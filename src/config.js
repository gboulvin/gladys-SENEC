// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or numbers typed as strings.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  // Comma-separated addresses of the SENEC.Home systems (see parseHosts).
  hosts: '',
  // Recent firmware serve lala.cgi over HTTPS only, older ones over HTTP only.
  protocol: 'https',
  // Seconds between two reads of every system.
  poll_frequency: 30,
  // Power fed into the grid (W) above which there is a solar surplus (scene
  // triggers surplus_started / surplus_stopped).
  surplus_threshold: 500,
};

export const PROTOCOLS = ['https', 'http'];
export const MIN_POLL_FREQUENCY = 10;
export const MAX_POLL_FREQUENCY = 3600;

function toNumber(value, fallback, { min, max }) {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    hosts: typeof raw.hosts === 'string' ? raw.hosts.trim() : DEFAULT_CONFIG.hosts,
    protocol: PROTOCOLS.includes(raw.protocol) ? raw.protocol : DEFAULT_CONFIG.protocol,
    poll_frequency: toNumber(raw.poll_frequency, DEFAULT_CONFIG.poll_frequency, {
      min: MIN_POLL_FREQUENCY,
      max: MAX_POLL_FREQUENCY,
    }),
    surplus_threshold: toNumber(raw.surplus_threshold, DEFAULT_CONFIG.surplus_threshold, {
      min: 1,
      max: 100000,
    }),
  };
}

const HOST_PATTERN = /^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::\d{1,5})?$/;

/**
 * Parse the `hosts` field: IP addresses or host names, optionally with a
 * port, separated by commas, semicolons or spaces. A user pasting the address
 * of the web interface (`https://192.168.1.40/`) gets it understood.
 * @param {{ hosts: string }} config
 * @returns {{ hosts: string[], invalid: string[] }}
 */
export function parseHosts(config) {
  const hosts = [];
  const invalid = [];
  for (const raw of config.hosts.split(/[\s,;]+/)) {
    const entry = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (entry === '') {
      continue;
    }
    if (!HOST_PATTERN.test(entry)) {
      invalid.push(raw);
    } else if (!hosts.includes(entry)) {
      hosts.push(entry);
    }
  }
  return { hosts, invalid };
}
