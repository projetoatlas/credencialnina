import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateRegistration, createCredential, publicCredential, ean13CheckDigit } from '../src/domain.js';
import { barcodeBits } from '../public/credential.js';

const config = { minimumAge: 17, consentVersion: 'test-v1', title: 'Aulão', unit: 'Unidade teste', city: 'Campinas', date: '', time: '', instructorName: '' };
const input = () => ({ requestId: randomUUID(), fullName: 'Érica D’Ávila', age: 25, whatsapp: '(19) 99999-1234', membership: 'guest', interest: true, contribution: false, contributionItem: '', consent: true, avatar: 'disco' });
test('valida idade no limite e rejeita valor fracionado', () => {
  assert.throws(() => validateRegistration({ ...input(), age: 16 }, config), /17 anos/);
  assert.equal(validateRegistration({ ...input(), age: 17 }, config).age, 17);
  assert.throws(() => validateRegistration({ ...input(), age: 17.5 }, config));
  assert.equal(validateRegistration({ ...input(), age: 16 }, { ...config, minimumAge: 16 }).age, 16);
});
test('normaliza nome e celular, exige sobrenome, respostas e consentimento', () => {
  const parsed = validateRegistration({ ...input(), fullName: '  Érica   D’Ávila  ' }, config);
  assert.equal(parsed.fullName, 'Érica D’Ávila'); assert.equal(parsed.whatsapp, '5519999991234');
  assert.throws(() => validateRegistration({ ...input(), fullName: 'Érica' }, config));
  assert.throws(() => validateRegistration({ ...input(), whatsapp: '99999-1234' }, config));
  assert.throws(() => validateRegistration({ ...input(), membership: '__proto__' }, config));
  assert.throws(() => validateRegistration({ ...input(), interest: undefined }, config));
  assert.throws(() => validateRegistration({ ...input(), consent: false }, config));
});
test('contribuição positiva exige detalhe; resposta negativa elimina detalhe antigo', () => {
  assert.throws(() => validateRegistration({ ...input(), contribution: true }, config));
  assert.equal(validateRegistration({ ...input(), contributionItem: 'bolo' }, config).contributionItem, '');
  assert.equal(validateRegistration({ ...input(), contribution: true, contributionItem: 'Suco de uva' }, config).contributionItem, 'Suco de uva');
});
test('rejeita SVG, foto excessiva, base64 inválida e personagem inexistente', () => {
  for (const photo of ['data:image/svg+xml;base64,PHN2Zy8+', 'data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,' + 'A'.repeat(500000)]) assert.throws(() => validateRegistration({ ...input(), photo }, config));
  assert.throws(() => validateRegistration({ ...input(), avatar: 'other' }, config));
});
test('registra interesse no passe apenas para convidados e mantém as categorias', () => {
  for (const membership of ['guest', 'other', 'unit', 'black']) {
    const registration = validateRegistration({ ...input(), membership }, config);
    const record = createCredential(registration, config);
    assert.equal(record.dayPassRequested, ['guest', 'other'].includes(membership));
    assert.equal(record.category.startsWith('CONVIDADO'), ['guest', 'other'].includes(membership));
    const card = publicCredential(record, true);
    assert.equal(card.demo, true); assert.equal(card.fullName, registration.fullName);
    assert.equal('whatsapp' in card, false); assert.equal('age' in card, false); assert.equal('consent' in card, false);
  }
});
test('EAN-13 corresponde a vetor conhecido e gera 95 módulos', () => {
  assert.equal(ean13CheckDigit('400638133393'), '1');
  const bits = barcodeBits('4006381333931');
  assert.equal(bits.length, 95); assert.equal(bits.slice(0, 3), '101'); assert.equal(bits.slice(45, 50), '01010'); assert.equal(bits.slice(-3), '101');
  assert.throws(() => barcodeBits('4006381333932'));
  const series = new Set();
  for (let i = 0; i < 200; i++) { const record = createCredential(validateRegistration(input(), config), config); assert.equal(barcodeBits(record.serial).length, 95); series.add(record.serial); }
  assert.equal(series.size, 200);
});
