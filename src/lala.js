// -----------------------------------------------------------------------------
// Minimal client of the local SENEC.Home API: `lala.cgi`.
//
// SENEC.Home V2.1 and V3 systems answer on the local network at
// `https://<ip>/lala.cgi` (plain `http` on older firmware). The protocol is a
// POST of a JSON object listing the values wanted, section by section, with
// empty strings: `{"ENERGY":{"GUI_BAT_DATA_FUEL_CHARGE":""}}`. The answer is
// the same object filled with type-prefixed hexadecimal values:
//
//   fl_42C80000   IEEE 754 float, big endian         -> 100
//   u8_01         unsigned integer (u8, u1, u3, u6)  -> 1
//   i3_FFFFFFFF   signed integer   (i8, i1, i3)      -> -1
//   st_text       string                              -> 'text'
//   VARIABLE_NOT_FOUND / FILE_NOT_FOUND              -> null
//
// A write is the same POST with the encoded value instead of an empty string.
//
// The system serves a self-signed certificate: the TLS certificate is not
// verified (the traffic stays on the local network). The web interface keeps a
// session cookie, sent back on every request. The transport is injectable, so
// the tests plug a simulated SENEC instead of a socket.
// -----------------------------------------------------------------------------

import http from 'node:http';
import https from 'node:https';

// lala.cgi rejects long requests: the reads are split into chunks of sections.
export const MAX_REQUEST_LENGTH = 600;
const TIMEOUT_MS = 10000;

/** Decode one raw lala.cgi value. */
export function decodeValue(raw) {
  if (Array.isArray(raw)) {
    return raw.map(decodeValue);
  }
  if (raw && typeof raw === 'object') {
    return decodeSection(raw);
  }
  if (typeof raw !== 'string') {
    return raw ?? null;
  }
  if (raw === 'VARIABLE_NOT_FOUND' || raw === 'FILE_NOT_FOUND' || raw === '') {
    return null;
  }
  const separator = raw.indexOf('_');
  if (separator < 0) {
    return raw;
  }
  const prefix = raw.slice(0, separator);
  const payload = raw.slice(separator + 1);
  if (prefix === 'st') {
    return payload;
  }
  if (prefix === 'fl') {
    if (!/^[0-9a-fA-F]{8}$/.test(payload)) {
      return null;
    }
    const value = Buffer.from(payload, 'hex').readFloatBE(0);
    return Number.isFinite(value) ? value : null;
  }
  if (/^[ui]\d$/.test(prefix)) {
    if (!/^[0-9a-fA-F]+$/.test(payload)) {
      return null;
    }
    const unsigned = Number.parseInt(payload, 16);
    if (prefix.startsWith('i')) {
      const bits = payload.length * 4;
      return unsigned >= 2 ** (bits - 1) ? unsigned - 2 ** bits : unsigned;
    }
    return unsigned;
  }
  return raw;
}

/** Decode every value of a lala.cgi answer (or section). */
export function decodeSection(section) {
  return Object.fromEntries(
    Object.entries(section).map(([key, value]) => [key, decodeValue(value)]),
  );
}

/** Encode an unsigned 8-bit integer, as written by the SENEC web interface. */
export function encodeU8(value) {
  return `u8_${Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .toUpperCase()
    .padStart(2, '0')}`;
}

/** Encode an IEEE 754 float. */
export function encodeFloat(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeFloatBE(value, 0);
  return `fl_${buffer.toString('hex').toUpperCase()}`;
}

/**
 * Split a request into chunks under MAX_REQUEST_LENGTH, one section never
 * being split.
 * @param {Record<string, Record<string, string>>} form
 */
export function chunkForm(form) {
  const chunks = [];
  let current = {};
  for (const [section, values] of Object.entries(form)) {
    const candidate = { ...current, [section]: values };
    if (Object.keys(current).length > 0 && JSON.stringify(candidate).length > MAX_REQUEST_LENGTH) {
      chunks.push(current);
      current = { [section]: values };
    } else {
      current = candidate;
    }
  }
  if (Object.keys(current).length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * The default transport: one HTTP(S) POST, the certificate not verified.
 * @returns {Promise<{ status: number, headers: Record<string, string | string[]>, body: string }>}
 */
function nodeTransport({ url, body, headers }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(
      target,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
      },
      (response) => {
        const parts = [];
        response.on('data', (part) => parts.push(part));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(parts).toString('utf8'),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('Timeout')));
    request.on('error', reject);
    request.end(body);
  });
}

export class LalaClient {
  /**
   * @param {{ host: string, protocol?: 'https' | 'http', transport?: Function }} options
   */
  constructor({ host, protocol = 'https', transport = nodeTransport }) {
    this.host = host;
    // `host` may carry a port, and an IPv6 address comes in brackets.
    this.origin = `${protocol}://${host}`;
    this.url = `${this.origin}/lala.cgi`;
    this.transport = transport;
    this.cookies = new Map();
  }

  /**
   * Send one raw request (read or write), return the decoded answer.
   * @param {Record<string, Record<string, unknown>>} form
   */
  async post(form) {
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Origin: this.origin,
      Referer: `${this.origin}/`,
    };
    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    let response;
    try {
      response = await this.transport({ url: this.url, body: JSON.stringify(form), headers });
    } catch (err) {
      throw new Error(`${this.host} does not answer (${err.code ?? err.message})`, { cause: err });
    }
    this.rememberCookies(response.headers?.['set-cookie']);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${this.host} answered HTTP ${response.status}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      throw new Error(`${this.host} did not answer like a SENEC.Home (no JSON)`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${this.host} did not answer like a SENEC.Home`);
    }
    return decodeSection(parsed);
  }

  /**
   * Read values: the request is split in chunks, the answers merged.
   * @param {Record<string, Record<string, string>>} form
   */
  async read(form) {
    const result = {};
    for (const chunk of chunkForm(form)) {
      const answer = await this.post(chunk);
      for (const [section, values] of Object.entries(answer)) {
        result[section] = { ...result[section], ...values };
      }
    }
    return result;
  }

  rememberCookies(header) {
    for (const line of [header ?? []].flat()) {
      const [pair] = String(line).split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }
}
