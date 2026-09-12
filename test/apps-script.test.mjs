import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';

const source = await readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
const SECRET = 'test-only-ñ-segredo-32-characters-long-🔒';
const signedBytes = buffer => [...buffer].map(byte => byte > 127 ? byte - 256 : byte);
const clone = value => JSON.parse(JSON.stringify(value));
const checksum = base => String((10 - [...base].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) % 10) % 10);
const serial = base => base + checksum(base);
const fingerprint = text => createHash('sha256').update(text).digest('hex');

function makeRecord(overrides = {}) {
  return {
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    id: '123e4567-e89b-42d3-a456-426614174000',
    serial: serial('012345678901'),
    fullName: 'João da Conceição', firstName: 'João', age: 21,
    whatsapp: '5519999999999', membership: 'guest', interest: true,
    contribution: true, contributionItem: 'Bolo de aniversário 🎂',
    consent: true, consentVersion: '2026-09-10-v1',
    category: 'CONVIDADO · NÃO ALUNO', avatar: 'disco', photo: null,
    palette: ['#ff62b4', '#955dff', '#ffb65d'], createdAt: new Date().toISOString(),
    event: { title: 'Aulão de aniversário', instructorName: 'Ana', date: '', time: '', unit: 'Smart Fit Castelo', city: 'Campinas · SP' },
    dayPassRequested: true, dayPassStatus: 'INTERESSE REGISTRADO · AGUARDA UNIDADE',
    ...overrides
  };
}

function mockRuntime({ configured = true, canLock = true } = {}) {
  const state = {
    props: new Map(configured ? [['SHARED_SECRET', SECRET], ['SPREADSHEET_ID', 'book-id'], ['PHOTO_FOLDER_ID', 'folder-id'], ['MINIMUM_AGE', '17'], ['SHEET_NAME', 'Convidados']] : []),
    sheets: new Map(), files: new Map(), rawWrites: [], events: [], fileCreates: 0,
    locked: false, flushes: 0, failNextDataWrite: false, forceSerial: null,
  };
  class Range {
    constructor(sheet, row, col, rows = 1, cols = 1) { Object.assign(this, { sheet, row, col, rows, cols }); }
    getValues() {
      return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.cols }, (_, c) => this.sheet.cells[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
    }
    setValues(values) {
      if (this.row > 1 && state.failNextDataWrite) { state.failNextDataWrite = false; throw new Error('INJECTED_SHEET_WRITE_FAILURE'); }
      assert.equal(values.length, this.rows);
      state.rawWrites.push({ row: this.row, col: this.col, values: clone(values), format: this.format });
      values.forEach((valuesRow, r) => {
        assert.equal(valuesRow.length, this.cols);
        const target = this.sheet.cells[this.row - 1 + r] ||= [];
        valuesRow.forEach((value, c) => {
          // Model apostrophe-as-text entry only; rawWrites remains the assertion source.
          target[this.col - 1 + c] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
        });
      });
      state.events.push('write'); return this;
    }
    setNumberFormat(format) { this.format = format; return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
    setFontWeight() { return this; }
    setWrap() { return this; }
    createTextFinder(needle) {
      const self = this;
      return {
        matchEntireCell(value) { assert.equal(value, true); return this; },
        useRegularExpression(value) { assert.equal(value, false); return this; },
        findNext() {
          for (let i = 0; i < self.rows; i++) {
            if (String(self.sheet.cells[self.row - 1 + i]?.[self.col - 1] ?? '') === needle) return { getRow: () => self.row + i };
          }
          return null;
        }
      };
    }
  }
  class Sheet {
    constructor(name) { this.name = name; this.cells = []; this.cols = 26; }
    getMaxColumns() { return this.cols; }
    insertColumnsAfter(after, count) { assert.equal(after, this.cols); this.cols += count; }
    getLastRow() { return this.cells.length; }
    appendRow(values) { this.cells.push(clone(values)); return this; }
    getRange(...args) { return new Range(this, ...args); }
    setFrozenRows() { return this; }
    setRowHeight() { return this; }
    setColumnWidth() { return this; }
    hideColumns() { return this; }
  }
  const book = {
    getId: () => 'book-id',
    getSheetByName: name => state.sheets.get(name) || null,
    insertSheet(name) { const sheet = new Sheet(name); state.sheets.set(name, sheet); return sheet; }
  };
  const folder = {
    getId: () => 'folder-id',
    getFilesByName(name) {
      let available = state.files.has(name);
      return { hasNext: () => available, next() { assert.ok(available); available = false; return state.files.get(name); } };
    },
    createFile(blob) {
      state.fileCreates++;
      const id = `photo-${state.fileCreates}`;
      const file = { blob, getId: () => id, getUrl: () => `https://drive.google.com/file/d/${id}/view` };
      state.files.set(blob.name, file); return file;
    }
  };
  const context = vm.createContext({
    console: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state.props.get(key) ?? null, setProperty(key, value) { state.props.set(key, String(value)); return this; } }) },
    SpreadsheetApp: { create: () => book, openById(id) { assert.equal(id, 'book-id'); return book; }, flush() { state.events.push('flush'); state.flushes++; } },
    DriveApp: { createFolder: () => folder, getFolderById(id) { assert.equal(id, 'folder-id'); return folder; } },
    LockService: { getScriptLock: () => ({
      tryLock(ms) { assert.equal(ms, 25000); state.events.push('tryLock'); state.locked = canLock; return canLock; },
      hasLock: () => state.locked,
      releaseLock() { assert.equal(state.locked, true); state.locked = false; state.events.push('release'); }
    }) },
    Utilities: {
      Charset: { UTF_8: 'UTF_8' }, DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeHmacSha256Signature(payload, key, charset) { assert.equal(charset, 'UTF_8'); return signedBytes(createHmac('sha256', key).update(payload, 'utf8').digest()); },
      computeDigest(algorithm, bytes) { assert.equal(algorithm, 'SHA_256'); return signedBytes(createHash('sha256').update(Buffer.from(bytes)).digest()); },
      base64Decode: value => signedBytes(Buffer.from(value, 'base64')),
      newBlob: (bytes, mime, name) => ({ bytes: [...bytes], mime, name }),
      getUuid: () => randomUUID()
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType(mime) { this.mime = mime; return this; } }) }
  });
  vm.runInContext(source, context, { filename: 'Code.gs' });
  return {
    context, state,
    send(record = makeRecord(), options = {}) {
      const payload = JSON.stringify({ record, fingerprint: options.fingerprint ?? fingerprint(JSON.stringify(record)), timestamp: options.timestamp ?? Date.now() });
      const signature = options.signature ?? createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex');
      const output = context.doPost({ postData: { contents: JSON.stringify({ payload, signature }) } });
      assert.equal(output.mime, 'application/json'); return JSON.parse(output.text);
    },
    sheet: () => state.sheets.get('Convidados')
  };
}

test('HMAC signed-byte -> hex is compatible with Node for Unicode payload and secret', () => {
  const h = mockRuntime();
  const value = 'João: aniversário 🎂 e açãõ';
  const expected = createHmac('sha256', SECRET).update(value, 'utf8').digest('hex');
  const actual = h.context.hex_(h.context.Utilities.computeHmacSha256Signature(value, SECRET, 'UTF_8'));
  assert.equal(actual, expected);
  assert.equal(h.context.hex_([-128, -1, 0, 127]), '80ff007f');
  assert.equal(h.context.safeEqual_(expected, expected), true);
  assert.equal(h.context.safeEqual_(expected, expected.slice(0, -1) + (expected.endsWith('0') ? '1' : '0')), false);
});

test('missing configuration, GET, malformed signature, and tampered HMAC reject without mutation', () => {
  const h = mockRuntime();
  assert.deepEqual(JSON.parse(h.context.doGet().text), { ok: false, code: 'POST_REQUIRED' });
  assert.deepEqual(mockRuntime({ configured: false }).send(), { ok: false, code: 'NOT_CONFIGURED' });
  for (const signature of ['not-a-signature', '0'.repeat(64)]) assert.deepEqual(h.send(makeRecord(), { signature }), { ok: false, code: 'UNAUTHORIZED' });
  assert.equal(h.state.sheets.size, 0); assert.equal(h.state.files.size, 0); assert.equal(h.state.events.length, 0);
});

test('expired past and future signatures reject before acquiring lock', () => {
  const h = mockRuntime();
  for (const timestamp of [Date.now() - 301000, Date.now() + 301000]) assert.deepEqual(h.send(makeRecord(), { timestamp }), { ok: false, code: 'EXPIRED' });
  assert.equal(h.state.events.length, 0);
});

test('valid request writes exactly 29 text cells, preserves Unicode and leading-zero serial, flushes before releasing', () => {
  const h = mockRuntime(); const r = makeRecord(); const reply = h.send(r);
  assert.equal(reply.ok, true); assert.equal(reply.credential.serial, r.serial); assert.equal(reply.credential.fullName, r.fullName);
  assert.equal(h.sheet().getMaxColumns(), 29); assert.equal(h.sheet().getLastRow(), 2);
  assert.equal(h.sheet().cells[1].length, 29); assert.equal(h.sheet().cells[1][2], r.serial);
  assert.equal(h.sheet().cells[1][3], r.fullName); assert.equal(h.sheet().cells[1][13], r.contributionItem);
  assert.ok(h.state.rawWrites[0].values[0].every(value => typeof value === 'string'));
  assert.equal(h.state.rawWrites[0].format, '@'); assert.deepEqual(h.state.events.slice(-2), ['flush', 'release']);
  assert.equal(h.state.locked, false); assert.equal(Object.hasOwn(reply.credential, 'whatsapp'), false);
});

test('same requestId and fingerprint returns saved credential, ignoring newly generated candidate fields', () => {
  const h = mockRuntime(); const r = makeRecord(); const fp = fingerprint('normalized-registration'); const first = h.send(r, { fingerprint: fp });
  const repeated = h.send({ ...r, id: randomUUID(), serial: serial('333333333333'), palette: ['#000000', '#111111', '#222222'] }, { fingerprint: fp });
  assert.equal(repeated.ok, true); assert.equal(repeated.duplicate, true); assert.deepEqual(repeated.credential, first.credential);
  assert.equal(h.sheet().getLastRow(), 2); assert.equal(h.state.rawWrites.length, 1); assert.equal(h.state.locked, false);
});

test('same requestId with a different fingerprint conflicts and does not append', () => {
  const h = mockRuntime(); const r = makeRecord(); h.send(r, { fingerprint: fingerprint('original') });
  assert.deepEqual(h.send({ ...r, fullName: 'Maria Silva' }, { fingerprint: fingerprint('changed') }), { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(h.sheet().getLastRow(), 2); assert.equal(h.state.rawWrites.length, 1); assert.equal(h.state.locked, false);
});

test('formula escape covers = + - @ and whitespace while leaving normal text unchanged', () => {
  const h = mockRuntime();
  for (const input of ['=1+1', '+1+1', '-1+1', '@SUM(A1)', ' \t=HYPERLINK("x")', '\n+1']) assert.equal(h.context.sheetText_(input), "'" + input);
  assert.equal(h.context.sheetText_('Bolo 🎂'), 'Bolo 🎂'); assert.equal(h.context.sheetText_(null), '');
  const injection = '=IMPORTXML("https://invalid.example", "//x")';
  assert.equal(h.send(makeRecord({ contributionItem: injection })).ok, true);
  assert.equal(h.state.rawWrites[0].values[0][13], "'" + injection);
});

test('serial collision is regenerated and saved once under a valid EAN checksum', () => {
  const h = mockRuntime(); const first = makeRecord(); h.send(first);
  const replacement = serial('999999999999'); let generated = 0;
  h.context.randomSerial_ = () => { generated++; return replacement; };
  const second = h.send(makeRecord({ requestId: randomUUID(), id: randomUUID(), serial: first.serial }));
  assert.equal(second.ok, true); assert.equal(second.credential.serial, replacement); assert.equal(generated, 1);
  assert.equal(h.sheet().cells[2][2], replacement); assert.equal(h.sheet().getLastRow(), 3);
  assert.equal(replacement[12], checksum(replacement.slice(0, 12)));
});

test('persistent serial collisions fail without an extra row and release lock', () => {
  const h = mockRuntime(); const first = makeRecord(); h.send(first); h.context.randomSerial_ = () => first.serial;
  const second = h.send(makeRecord({ requestId: randomUUID(), id: randomUUID(), serial: first.serial }));
  assert.deepEqual(second, { ok: false, code: 'SAVE_FAILED' }); assert.equal(h.sheet().getLastRow(), 2); assert.equal(h.state.locked, false);
});

test('photo file is reused after a sheet failure; response excludes photo payload and phone', () => {
  const h = mockRuntime();
  // Only JPEG magic is validated by Code.gs; mock does not decode image pixels.
  const bytes = Buffer.from([255, 216, 255, ...Array(40).fill(15)]);
  const r = makeRecord({ photo: 'data:image/jpeg;base64,' + bytes.toString('base64'), avatar: 'photo' });
  const fp = fingerprint('photo-registration'); h.state.failNextDataWrite = true;
  assert.deepEqual(h.send(r, { fingerprint: fp }), { ok: false, code: 'SAVE_FAILED' });
  assert.equal(h.state.fileCreates, 1); assert.equal(h.sheet().getLastRow(), 1); assert.equal(h.state.locked, false);
  const result = h.send(r, { fingerprint: fp }); assert.equal(result.ok, true); assert.equal(h.state.fileCreates, 1);
  assert.equal(h.sheet().cells[1][16], 'photo-1'); assert.equal(Object.hasOwn(result.credential, 'photo'), false); assert.equal(Object.hasOwn(result.credential, 'whatsapp'), false);
  const again = h.send(r, { fingerprint: fp }); assert.equal(again.duplicate, true); assert.equal(h.state.fileCreates, 1); assert.equal(h.sheet().getLastRow(), 2);
});

test('invalid data, invalid checksum, and busy lock do not write registrations', () => {
  const h = mockRuntime();
  for (const record of [makeRecord({ age: 16 }), makeRecord({ consent: false }), makeRecord({ serial: '0000000000001' }), makeRecord({ photo: 'data:image/jpeg;base64,AAAA' })]) assert.deepEqual(h.send(record), { ok: false, code: 'INVALID_DATA' });
  assert.equal(h.state.sheets.size, 0);
  const busy = mockRuntime({ canLock: false }); assert.deepEqual(busy.send(), { ok: false, code: 'BUSY' }); assert.equal(busy.state.sheets.size, 0);
});

test('setup can run twice without recreating configured resources or appending duplicate headers', () => {
  const h = mockRuntime({ configured: false }); h.context.setup(); const secret = h.state.props.get('SHARED_SECRET'); h.context.setup();
  assert.equal(h.state.props.get('SHARED_SECRET'), secret); assert.equal(secret.length, 64); assert.equal(h.state.props.get('MINIMUM_AGE'), '17');
  assert.equal(h.sheet().getLastRow(), 1); assert.equal(h.sheet().getMaxColumns(), 29);
});

function publicSend(h, overrides = {}) {
 const body = { requestId: '550e8400-e29b-41d4-a716-446655440000', fullName: 'Teste Integração', age: 25, whatsapp: '(19) 99999-9999', membership: 'guest', interest: true, contribution: true, contributionItem: 'Bolo', consent: true, avatar: 'disco', photo: null, ...overrides };
 return JSON.parse(h.context.doPost({postData:{contents:JSON.stringify({action:'register',registration:body})}}).text);
}
test('Pages saves a real row and creates trusted metadata; retry does not duplicate', () => {
 const h = mockRuntime();
 const result = publicSend(h, {serial:'fake', event:{title:'fake'}, category:'fake', demo:true});
 assert.equal(result.ok, true); assert.equal(result.storage, 'google');
 assert.equal(result.credential.category, 'CONVIDADO · NÃO ALUNO');
 assert.equal(result.credential.event.date, '2026-09-17');
 assert.match(result.credential.serial, /^\d{13}$/);
 assert.equal(h.sheet().getLastRow(), 2);
 const again = publicSend(h);
 assert.equal(again.ok, true); assert.equal(again.duplicate, true);
 assert.equal(again.credential.serial, result.credential.serial);
 assert.equal(h.sheet().getLastRow(), 2);
 assert.equal(publicSend(h, {fullName:'Outro Nome'}).code, 'IDEMPOTENCY_CONFLICT');
});
test('Pages rejects invalid input and does not confirm a failed sheet write', () => {
 for(const invalid of [{age:16},{consent:false},{whatsapp:'123'},{fullName:'Ana'},{membership:'admin'},{photo:'data:image/png;base64,invalid'},{interest:'yes'}]) {
  const h=mockRuntime(); assert.equal(publicSend(h,invalid).ok,false); assert.equal(h.state.rawWrites.length,0);
 }
 const h=mockRuntime();h.state.failNextDataWrite=true;
 assert.equal(publicSend(h).code,'SAVE_FAILED');
 assert.equal(publicSend(h).ok,true); assert.equal(h.sheet().getLastRow(),2);
});
test('Pages stores uploaded photo privately and excludes photo bytes/contact from response', () => {
 const h=mockRuntime(); const photo='data:image/jpeg;base64,'+Buffer.from([255,216,255,...Array(100).fill(0)]).toString('base64');
 const result=publicSend(h,{photo});
 assert.equal(result.ok,true); assert.equal(h.state.fileCreates,1);
 assert.equal(result.credential.avatar,'photo');
 assert.equal(result.credential.photo,undefined); assert.equal(result.credential.whatsapp,undefined);
 assert.equal(h.sheet().cells[1][14],'photo'); assert.match(h.sheet().cells[1][15],/drive.google.com/);
 assert.equal(publicSend(h,{photo}).duplicate,true); assert.equal(h.state.fileCreates,1);
});
