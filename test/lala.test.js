import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkForm,
  decodeSection,
  decodeValue,
  encodeFloat,
  encodeU8,
  LalaClient,
  MAX_REQUEST_LENGTH,
} from '../src/lala.js';

test('decodeValue reads every lala.cgi type', () => {
  assert.equal(decodeValue('fl_42C80000'), 100);
  assert.equal(decodeValue('fl_C2C80000'), -100);
  assert.equal(decodeValue('u8_0E'), 14);
  assert.equal(decodeValue('u1_0960'), 2400);
  assert.equal(decodeValue('u3_0012D687'), 1234567);
  assert.equal(decodeValue('i8_FF'), -1);
  assert.equal(decodeValue('i1_FFFE'), -2);
  assert.equal(decodeValue('i3_00000010'), 16);
  assert.equal(decodeValue('st_DE_0042'), 'DE_0042');
  assert.equal(decodeValue('VARIABLE_NOT_FOUND'), null);
  assert.equal(decodeValue('FILE_NOT_FOUND'), null);
  assert.equal(decodeValue(''), null);
  assert.equal(decodeValue('fl_7FC00000'), null, 'NaN');
  assert.equal(decodeValue('fl_zz'), null);
  assert.equal(decodeValue('plain'), 'plain');
  assert.deepEqual(decodeValue(['u8_01', 'fl_3F800000']), [1, 1]);
  assert.deepEqual(decodeSection({ A: { B: 'u8_02' } }), { A: { B: 2 } });
});

test('encoders produce what the web interface sends', () => {
  assert.equal(encodeU8(1), 'u8_01');
  assert.equal(encodeU8(255), 'u8_FF');
  assert.equal(encodeU8(300), 'u8_FF');
  assert.equal(encodeFloat(100), 'fl_42C80000');
  assert.equal(decodeValue(encodeFloat(16.5)), 16.5);
});

test('chunkForm keeps requests under the lala.cgi limit, sections whole', () => {
  const section = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`A_RATHER_LONG_KEY_${i}`, '']),
  );
  const form = { ONE: section, TWO: section, THREE: { X: '' } };
  const chunks = chunkForm(form);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(JSON.stringify(chunk).length <= MAX_REQUEST_LENGTH);
  }
  assert.deepEqual(Object.assign({}, ...chunks), form);
  assert.deepEqual(chunkForm({}), []);
});

function scriptedClient(responses, seen = []) {
  return new LalaClient({
    host: '192.168.1.40',
    transport: async (request) => {
      seen.push(request);
      const next = responses.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
  });
}

test('the client posts JSON to lala.cgi and sends the session cookie back', async () => {
  const seen = [];
  const client = scriptedClient(
    [
      {
        status: 200,
        headers: { 'set-cookie': ['PHPSESSID=xyz; Path=/'] },
        body: '{"ENERGY":{"STAT_STATE":"u8_0E"}}',
      },
      { status: 200, headers: {}, body: '{"ENERGY":{"STAT_STATE":"u8_10"}}' },
    ],
    seen,
  );
  assert.deepEqual(await client.read({ ENERGY: { STAT_STATE: '' } }), {
    ENERGY: { STAT_STATE: 14 },
  });
  await client.post({ ENERGY: { STAT_STATE: '' } });
  assert.equal(seen[0].url, 'https://192.168.1.40/lala.cgi');
  assert.equal(seen[0].body, '{"ENERGY":{"STAT_STATE":""}}');
  assert.equal(seen[0].headers.Cookie, undefined);
  assert.equal(seen[1].headers.Cookie, 'PHPSESSID=xyz');
  assert.equal(seen[1].headers.Origin, 'https://192.168.1.40');
});

test('the client explains what went wrong', async () => {
  await assert.rejects(
    scriptedClient([Object.assign(new Error('x'), { code: 'ECONNREFUSED' })]).post({}),
    /192.168.1.40 does not answer \(ECONNREFUSED\)/,
  );
  await assert.rejects(
    scriptedClient([{ status: 404, headers: {}, body: '' }]).post({}),
    /HTTP 404/,
  );
  await assert.rejects(
    scriptedClient([{ status: 200, headers: {}, body: '<html>' }]).post({}),
    /no JSON/,
  );
  await assert.rejects(
    scriptedClient([{ status: 200, headers: {}, body: '[]' }]).post({}),
    /like a SENEC.Home/,
  );
});

test('the HTTP protocol is honoured', () => {
  const client = new LalaClient({ host: '10.0.0.5:8080', protocol: 'http' });
  assert.equal(client.url, 'http://10.0.0.5:8080/lala.cgi');
});
