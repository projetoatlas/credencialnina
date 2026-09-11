import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createGoogleClient } from '../src/google-client.js';

const secret = 'integration-test-secret-not-real';
const url = 'https://script.google.com/macros/s/test/exec';
const localTime = Date.parse('2026-09-10T18:00:00Z');
const googleTime = Date.parse('2026-09-11T05:20:00Z');
const reply = (body, date = new Date(googleTime).toUTCString()) => new Response(JSON.stringify(body), { headers: date ? { Date: date } : {} });
test('ajusta diferença de relógio sem alterar registro e reutiliza ajuste no próximo envio', async () => {
  const calls = [];
  const client = createGoogleClient({ url, secret, now: () => localTime, fetchImpl: async (_, options) => {
    const envelope = JSON.parse(options.body);
    assert.equal(envelope.signature, createHmac('sha256', secret).update(envelope.payload, 'utf8').digest('hex'));
    const sent = JSON.parse(envelope.payload); calls.push(sent);
    return Math.abs(sent.timestamp - googleTime) > 300000 ? reply({ ok: false, code: 'EXPIRED' }) : reply({ ok: true, credential: sent.record });
  } });
  const data = { record: { id: 'same-id', serial: '0123456789012' }, fingerprint: 'same-fingerprint' };
  assert.deepEqual((await client(data)).credential, data.record);
  assert.equal(calls.length, 2); assert.equal(calls[0].timestamp, localTime); assert.equal(calls[1].timestamp, googleTime);
  assert.deepEqual(calls[0].record, calls[1].record); assert.equal(calls[0].fingerprint, calls[1].fingerprint);
  await client(data); assert.equal(calls.length, 3); assert.equal(calls[2].timestamp, googleTime);
});
test('limita correção a uma tentativa e não repete erros de autenticação', async () => {
  for (const code of ['UNAUTHORIZED', 'EXPIRED']) {
    let calls = 0;
    const client = createGoogleClient({ url, secret, now: () => localTime, fetchImpl: async () => { calls++; return reply({ ok: false, code }); } });
    assert.equal((await client({})).code, code); assert.equal(calls, code === 'EXPIRED' ? 2 : 1);
  }
});
test('mantém erro quando o Google não informa um horário válido', async () => {
  let calls = 0;
  const client = createGoogleClient({ url, secret, fetchImpl: async () => { calls++; return reply({ ok: false, code: 'EXPIRED' }, null); } });
  assert.equal((await client({})).code, 'EXPIRED'); assert.equal(calls, 1);
});
