import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSessionAvailable, saveCredentialSession, loadCredentialSession } from '../public/credential-session.js';
function createStorage() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key), clear: () => map.clear() }; }
const credential = { id: 'test-id', serial: '4006381333931', fullName: 'Convidada de Teste', firstName: 'Convidada', category: 'CONVIDADO · NÃO ALUNO', demo: false, event: { title: 'Aulão' }, palette: ['#ff62b4', '#955dff', '#ffb65d'], photo: 'data:image/jpeg;base64,test', dayPassRequested: true };
test('a nova página recupera a mesma credencial, inclusive foto, sem precisar de outro cadastro', () => {
  const storage = createStorage(); ensureSessionAvailable(storage);
  assert.equal(loadCredentialSession(storage), null);
  saveCredentialSession({ ...credential, whatsapp: 'dado privado', age: 25 }, 'Apresente na recepção.', storage);
  const saved = loadCredentialSession(storage);
  assert.equal(saved.credential.id, credential.id); assert.equal(saved.credential.serial, credential.serial); assert.equal(saved.credential.photo, credential.photo);
  assert.equal(saved.entryNote, 'Apresente na recepção.'); assert.equal('whatsapp' in saved.credential, false); assert.equal('age' in saved.credential, false);
  assert.deepEqual(loadCredentialSession(storage), saved);
  storage.clear(); assert.equal(loadCredentialSession(storage), null);
});
test('credencial inválida, sessão corrompida e armazenamento bloqueado têm tratamento', () => {
  const storage = createStorage();
  assert.throws(() => saveCredentialSession({ ...credential, serial: 'invalid' }, '', storage));
  assert.equal(loadCredentialSession({ getItem: () => '{broken' }), null);
  const blocked = { setItem() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); } };
  assert.throws(() => ensureSessionAvailable(blocked)); assert.equal(loadCredentialSession(blocked), null);
});
