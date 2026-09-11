import { barcodeBits } from './credential.js';
const KEY = 'fitdance:credential:v1';
function validCard(card) {
  if (!card || typeof card.id !== 'string' || typeof card.fullName !== 'string' || !card.fullName || typeof card.firstName !== 'string' || typeof card.category !== 'string' || typeof card.demo !== 'boolean') return false;
  if (!card.event || !Array.isArray(card.palette) || card.palette.length !== 3 || card.palette.some(color => !/^#[a-f\d]{6}$/i.test(color))) return false;
  try { barcodeBits(card.serial); } catch { return false; }
  return true;
}
export function ensureSessionAvailable(storage = globalThis.sessionStorage) {
  const key = `${KEY}:check`;
  storage.setItem(key, '1'); storage.removeItem(key);
}
export function saveCredentialSession(card, entryNote, storage = globalThis.sessionStorage) {
  if (!validCard(card)) throw new Error('Credencial inválida.');
  // Somente o necessário para exibir a credencial, sem idade, telefone ou respostas.
  const { id, serial, firstName, fullName, category, palette, createdAt, event, avatar, photo, dayPassRequested, demo } = card;
  storage.setItem(KEY, JSON.stringify({ version: 1, credential: { id, serial, firstName, fullName, category, palette, createdAt, event, avatar, photo, dayPassRequested, demo }, entryNote: String(entryNote || '') }));
}
export function loadCredentialSession(storage) {
  try {
    const entry = JSON.parse((storage || globalThis.sessionStorage).getItem(KEY));
    return entry?.version === 1 && validCard(entry.credential) && typeof entry.entryNote === 'string' ? entry : null;
  } catch { return null; }
}
