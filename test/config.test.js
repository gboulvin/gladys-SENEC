import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseHosts } from '../src/config.js';

test('normalizeConfig fills the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(undefined), DEFAULT_CONFIG);
});

test('normalizeConfig types and bounds the values typed in a form', () => {
  const config = normalizeConfig({
    hosts: ' 192.168.1.40 ',
    protocol: 'ftp',
    poll_frequency: '2',
    surplus_threshold: '750',
  });
  assert.equal(config.hosts, '192.168.1.40');
  assert.equal(config.protocol, 'https');
  assert.equal(config.poll_frequency, 10);
  assert.equal(config.surplus_threshold, 750);
  assert.equal(normalizeConfig({ protocol: 'http' }).protocol, 'http');
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 30);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, 3600);
});

test('parseHosts accepts addresses, names, ports and pasted URLs', () => {
  assert.deepEqual(
    parseHosts({
      hosts:
        '192.168.1.40, senec.local;https://192.168.1.41/  10.0.0.2:8443 [fe80::1] 192.168.1.40',
    }),
    {
      hosts: ['192.168.1.40', 'senec.local', '192.168.1.41', '10.0.0.2:8443', '[fe80::1]'],
      invalid: [],
    },
  );
  assert.deepEqual(parseHosts({ hosts: 'bad_host!, 192.168.1.40' }), {
    hosts: ['192.168.1.40'],
    invalid: ['bad_host!'],
  });
  assert.deepEqual(parseHosts({ hosts: '' }), { hosts: [], invalid: [] });
});
