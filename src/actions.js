// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
// The resolved message (multi-language) is displayed under the button; the
// ack is awaited under the action's `timeout_seconds`.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { systemName } from './devices.js';
import { mapText, text } from './i18n.js';

const logger = createLogger({ name: 'actions' });

export const ACTION_KEYS = { TEST_CONNECTION: 'test_connection' };

function wallboxLine(profile) {
  if (profile.wallboxes === 0) {
    return text('', '', '', '');
  }
  return text(
    `, ${profile.wallboxes} wallbox(es)`,
    `, ${profile.wallboxes} wallbox(s)`,
    `, ${profile.wallboxes} Wallbox(en)`,
    `, ${profile.wallboxes} wallbox(es)`,
  );
}

/**
 * Summarize a discovery for the user.
 * @param {Array<{ host: string, profile: object | null, error: string | null }>} results
 * @param {string[]} invalid entries of the hosts field that could not be parsed
 */
export function describeDiscovery(results, invalid) {
  const lines = [];
  for (const { host, profile, error } of results) {
    if (!error) {
      const wallboxes = wallboxLine(profile);
      lines.push(
        mapText(wallboxes, (_language, suffix) => `✓ ${host}: ${systemName(profile)}${suffix}`),
      );
    } else {
      lines.push(
        text(
          `✗ ${host}: ${error}`,
          `✗ ${host} : ${error}`,
          `✗ ${host}: ${error}`,
          `✗ ${host}: ${error}`,
        ),
      );
    }
  }
  for (const entry of invalid) {
    lines.push(
      text(
        `✗ "${entry}": invalid address`,
        `✗ « ${entry} » : adresse invalide`,
        `✗ „${entry}“: ungültige Adresse`,
        `✗ "${entry}": dirección no válida`,
      ),
    );
  }
  const found = results.filter((result) => !result.error).length;
  const header =
    results.length === 0 && invalid.length === 0
      ? text(
          'No SENEC.Home configured: enter its IP address.',
          'Aucun SENEC.Home configuré : saisissez son adresse IP.',
          'Kein SENEC.Home konfiguriert: Geben Sie seine IP-Adresse ein.',
          'Ningún SENEC.Home configurado: introduzca su dirección IP.',
        )
      : text(
          `${found} of ${results.length} SENEC.Home system(s) answered.`,
          `${found} système(s) SENEC.Home sur ${results.length} ont répondu.`,
          `${found} von ${results.length} SENEC.Home-System(en) haben geantwortet.`,
          `${found} de ${results.length} sistema(s) SENEC.Home respondieron.`,
        );
  return mapText(header, (language, value) =>
    [value, ...lines.map((line) => line[language])].join('\n'),
  );
}

/**
 * @param {import('./installation.js').Installation} installation
 */
export function createActions(installation) {
  return {
    async [ACTION_KEYS.TEST_CONNECTION]() {
      logger.info('Action test_connection -> identifying the configured systems');
      const results = await installation.discover();
      await installation.publishDiscoveredDevices();
      await installation.pollAll();
      return describeDiscovery(results, installation.invalidHosts);
    },
  };
}
