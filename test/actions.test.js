import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createActions, describeDiscovery } from '../src/actions.js';
import { setup } from './helpers/setup.js';

test('test_connection lists the systems that answer, in every language', async () => {
  const { gladys, installation, systems } = await setup({
    hosts: ['192.168.1.40', '192.168.1.41', '192.168.1.99'],
  });
  systems['192.168.1.41'].online = false;
  const message = await createActions(installation).test_connection();
  assert.equal(
    message.en,
    [
      '1 of 3 SENEC.Home system(s) answered.',
      '✓ 192.168.1.40: SENEC.Home V3 hybrid 1234567, 1 wallbox(es)',
      '✗ 192.168.1.41: 192.168.1.41 does not answer (EHOSTUNREACH)',
      '✗ 192.168.1.99: 192.168.1.99 does not answer (ETIMEDOUT)',
    ].join('\n'),
  );
  assert.match(message.fr, /^1 système\(s\) SENEC.Home sur 3 ont répondu\./);
  assert.match(message.fr, /1 wallbox\(s\)/);
  // The system identified earlier (192.168.1.41) keeps its devices.
  assert.equal(gladys.fake.discoveredDevices.length, 3);
});

test('describeDiscovery without any address asks for one', () => {
  const message = describeDiscovery([], []);
  assert.equal(message.es, 'Ningún SENEC.Home configurado: introduzca su dirección IP.');
  const invalid = describeDiscovery([], ['bad!']);
  assert.match(invalid.de, /„bad!“: ungültige Adresse/);
});
