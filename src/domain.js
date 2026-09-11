import { randomInt, randomUUID } from 'node:crypto';

export const MEMBERSHIPS = {
  guest: 'CONVIDADO · NÃO ALUNO',
  other: 'CONVIDADO · OUTRA UNIDADE',
  unit: 'ALUNO · UNIDADE DO EVENTO',
  black: 'ALUNO · PLANO BLACK'
};
export const AVATARS = ['disco', 'cool', 'fox', 'cat', 'butterfly', 'robot'];
export const PALETTES = [
  ['#ff62b4', '#955dff', '#ffb65d'],
  ['#ffc15c', '#ff6b79', '#ca65e9'],
  ['#64e2d4', '#5c88fa', '#b77eff'],
  ['#baf56b', '#63cfb6', '#8195ff'],
  ['#ff87b2', '#fd9159', '#ffda74'],
  ['#c68bff', '#7373f9', '#7ce5f3']
];
export class ValidationError extends Error {
  constructor(message, field) { super(message); this.field = field; this.status = 400; }
}
const clean = (value, max) => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, max) : '';
export function validateRegistration(body, config) {
  if (!body || typeof body !== 'object') throw new ValidationError('Preencha seus dados.');
  const fullName = clean(body.fullName, 120);
  if (fullName.length < 4 || !/^\p{L}[\p{L}\p{M}'’.-]*(?: [\p{L}\p{M}'’.-]+)+$/u.test(fullName)) throw new ValidationError('Informe seu nome e sobrenome.', 'fullName');
  const age = Number(body.age);
  if (body.age === '' || !Number.isInteger(age) || age < config.minimumAge || age > 120) throw new ValidationError(`A participação é permitida a partir de ${config.minimumAge} anos.`, 'age');
  if (!Object.hasOwn(MEMBERSHIPS, body.membership)) throw new ValidationError('Selecione sua relação com a Smart Fit.', 'membership');
  const rawPhone = typeof body.whatsapp === 'string' ? body.whatsapp.replace(/\D/g, '') : '';
  const phone = rawPhone.length === 13 && rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone;
  if (!/^[1-9]{2}9\d{8}$/.test(phone)) throw new ValidationError('Informe um celular com DDD, por exemplo (19) 99999-9999.', 'whatsapp');
  if (typeof body.interest !== 'boolean') throw new ValidationError('Conte se você tem interesse em conhecer a academia.', 'interest');
  if (typeof body.contribution !== 'boolean') throw new ValidationError('Selecione se deseja contribuir.', 'contribution');
  const contributionItem = body.contribution ? clean(body.contributionItem, 200) : '';
  if (body.contribution && contributionItem.length < 2) throw new ValidationError('Conte o que você pretende levar.', 'contributionItem');
  if (body.consent !== true) throw new ValidationError('É necessário concordar com o uso dos dados para este evento.', 'consent');
  let photo = null;
  if (body.photo) {
    if (typeof body.photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.photo)) throw new ValidationError('Use uma foto JPG, PNG ou WebP pelo seletor de fotos.', 'photo');
    const bytes = Buffer.from(body.photo.split(',')[1], 'base64');
    if (bytes.length > 360_000 || bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ValidationError('Não foi possível ler a foto. Escolha outra imagem.', 'photo');
    photo = body.photo;
  }
  if (!photo && !AVATARS.includes(body.avatar)) throw new ValidationError('Escolha um personagem ou uma foto.', 'avatar');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId ?? '')) throw new ValidationError('Recarregue a página para continuar.');
  return { requestId: body.requestId, fullName, age, whatsapp: `55${phone}`, membership: body.membership, interest: body.interest, contribution: body.contribution, contributionItem, consent: true, consentVersion: config.consentVersion, avatar: photo ? 'photo' : body.avatar, photo };
}
export function ean13CheckDigit(base) {
  if (!/^\d{12}$/.test(base)) throw new Error('EAN-13 precisa de 12 dígitos base.');
  const sum = [...base].reduce((total, n, i) => total + Number(n) * (i % 2 ? 3 : 1), 0);
  return String((10 - sum % 10) % 10);
}
export function createCredential(registration, config) {
  const base = Array.from({ length: 12 }, () => randomInt(10)).join('');
  return {
    ...registration, id: randomUUID(), serial: base + ean13CheckDigit(base),
    firstName: registration.fullName.split(' ')[0], category: MEMBERSHIPS[registration.membership],
    palette: PALETTES[randomInt(PALETTES.length)], createdAt: new Date().toISOString(),
    event: { title: config.title, instructorName: config.instructorName, date: config.date, time: config.time, unit: config.unit, city: config.city },
    dayPassRequested: ['guest', 'other'].includes(registration.membership) && registration.interest,
    dayPassStatus: ['guest', 'other'].includes(registration.membership) && registration.interest ? 'INTERESSE REGISTRADO · AGUARDA UNIDADE' : 'NÃO SOLICITADO'
  };
}
export function publicCredential(record, demo) {
  const { id, serial, firstName, fullName, category, palette, createdAt, event, avatar, photo, dayPassRequested } = record;
  return { id, serial, firstName, fullName, category, palette, createdAt, event, avatar, photo, dayPassRequested, demo };
}
