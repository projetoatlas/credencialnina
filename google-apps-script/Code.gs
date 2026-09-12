/**
 * Cole este arquivo em https://script.google.com/ e execute setup() uma vez.
 * Depois implante como Aplicativo da Web: executar como você, acesso Qualquer pessoa.
 * O endpoint aceita o formulário público do Pages e envios assinados pelo servidor Node.
 * Nunca exponha SHARED_SECRET no navegador, no Git ou na planilha.
 */
const PUBLIC_EVENT = {
  "title": "Aulão de aniversário",
  "instructorName": "",
  "date": "2026-09-17",
  "time": "18h30",
  "unit": "Smart Fit Castelo",
  "city": "Campinas · SP",
  "address": "Avenida Francisco José de Camargo Andrade, 262 · Jardim Chapadão · Campinas, SP · 13070-055",
  "minimumAge": 17,
  "whatToBring": "Venha com roupa confortável, tênis e sua garrafinha de água.",
  "entryNote": "Apresente sua credencial e um documento na recepção. A entrada depende da validação da unidade.",
  "dayPassNote": "Marque seu interesse para solicitar um passe de um dia. A liberação e as condições serão confirmadas pela unidade.",
  "privacyContact": "a organização do evento",
  "consentVersion": "2026-09-10-v1"
};
const HEADERS = [
  'Data do cadastro', 'ID do envio', 'Número de série', 'Nome completo', 'Primeiro nome',
  'Idade', 'WhatsApp', 'Vínculo com a Smart Fit', 'Categoria da credencial',
  'Interesse em conhecer a academia', 'Passe de um dia solicitado', 'Situação do passe',
  'Contribui com comes e bebes', 'O que vai levar', 'Personagem ou foto', 'Foto no Drive',
  'ID da foto', 'Cores da credencial', 'Consentimento', 'Versão do consentimento',
  'Evento', 'Aniversariante', 'Data do evento', 'Horário do evento', 'Unidade', 'Cidade',
  'ID da credencial', 'Impressão digital do envio', 'Dados da credencial'
];

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) {
    const book = SpreadsheetApp.create('Aulão FitDance — convidados');
    props.setProperty('SPREADSHEET_ID', book.getId());
  }
  if (!props.getProperty('PHOTO_FOLDER_ID')) {
    const folder = DriveApp.createFolder('Aulão FitDance — fotos privadas');
    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  }
  if (!props.getProperty('SHARED_SECRET')) props.setProperty('SHARED_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  if (!props.getProperty('MINIMUM_AGE')) props.setProperty('MINIMUM_AGE', '17');
  if (!props.getProperty('SHEET_NAME')) props.setProperty('SHEET_NAME', 'Convidados');
  const sheet = getSheet_(props);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#29212e').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  sheet.setRowHeight(1, 44);
  sheet.setColumnWidth(4, 240);
  sheet.setColumnWidth(14, 240);
  sheet.setColumnWidth(16, 220);
  // As colunas auxiliares continuam na planilha, mas ficam recolhidas.
  sheet.hideColumns(28, 2);
  SpreadsheetApp.flush();
  console.log('Planilha: https://docs.google.com/spreadsheets/d/' + props.getProperty('SPREADSHEET_ID') + '/edit');
  console.log('Pasta privada: https://drive.google.com/drive/folders/' + props.getProperty('PHOTO_FOLDER_ID'));
  console.log('Configuração pronta. Copie SHARED_SECRET nas Propriedades do script para GOOGLE_SCRIPT_SECRET no .env.');
}

function getSheet_(props) {
  const book = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  const name = props.getProperty('SHEET_NAME') || 'Convidados';
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  if (!sheet.getLastRow()) sheet.appendRow(HEADERS);
  // Evita escrever sob cabeçalhos trocados manualmente.
  const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (headers.join('|') !== HEADERS.join('|')) throw new Error('SCHEMA_MISMATCH');
  return sheet;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'health') return output_({ ok: true, protocol: 'fitdance-pages-v1' });
  return output_({ ok: false, code: 'POST_REQUIRED' });
}
function doPost(e) {
  let lock = null;
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('SHARED_SECRET');
    if (!secret || secret.length < 32 || !props.getProperty('SPREADSHEET_ID') || !props.getProperty('PHOTO_FOLDER_ID')) return output_({ ok: false, code: 'NOT_CONFIGURED' });
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 550000) return output_({ ok: false, code: 'INVALID_REQUEST' });
    const envelope = JSON.parse(e.postData.contents);
    const isPublic = envelope.action === 'register';
    let message;
    if (isPublic) {
      const registration = publicRegistration_(envelope.registration, props);
      const fingerprint = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(registration), Utilities.Charset.UTF_8));
      message = { record: publicRecord_(registration), fingerprint: fingerprint };
    } else {
      if (typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature || '')) return output_({ ok: false, code: 'UNAUTHORIZED' });
      const expected = hex_(Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8));
      if (!safeEqual_(expected, envelope.signature)) return output_({ ok: false, code: 'UNAUTHORIZED' });
      message = JSON.parse(envelope.payload);
      if (!Number.isFinite(message.timestamp) || Math.abs(Date.now() - message.timestamp) > 5 * 60 * 1000) return output_({ ok: false, code: 'EXPIRED' });
    }
    const record = message.record;
    validate_(record, Number(props.getProperty('MINIMUM_AGE') || '17'));
    if (!/^[a-f0-9]{64}$/.test(message.fingerprint || '')) throw new Error('INVALID_DATA');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) return output_({ ok: false, code: 'BUSY' });
    const sheet = getSheet_(props);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const previous = sheet.getRange(2, 2, lastRow - 1, 1).createTextFinder(record.requestId).matchEntireCell(true).useRegularExpression(false).findNext();
      if (previous) {
        const saved = sheet.getRange(previous.getRow(), 28, 1, 2).getValues()[0];
        if (String(saved[0]) !== message.fingerprint) return output_({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
        return output_({ ok: true, storage: 'google', duplicate: true, credential: JSON.parse(String(saved[1])) });
      }
    }
    // O código de barras é único nesta lista, inclusive se houver uma colisão aleatória.
    let serial = record.serial;
    for (let attempt = 0; attempt < 10; attempt++) {
      const found = lastRow > 1 && sheet.getRange(2, 3, lastRow - 1, 1).createTextFinder(serial).matchEntireCell(true).useRegularExpression(false).findNext();
      if (!found) break;
      serial = randomSerial_();
      if (attempt === 9) throw new Error('SERIAL_COLLISION');
    }
    record.serial = serial;
    let photoId = '', photoUrl = '';
    if (record.photo) {
      const bytes = Utilities.base64Decode(record.photo.split(',')[1]);
      const digest = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
      const filename = record.requestId + '-' + digest.slice(0, 20) + '.jpg';
      const folder = DriveApp.getFolderById(props.getProperty('PHOTO_FOLDER_ID'));
      // Se a foto tiver sido salva antes de uma falha, reutiliza no próximo envio.
      const files = folder.getFilesByName(filename);
      const file = files.hasNext() ? files.next() : folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', filename));
      photoId = file.getId(); photoUrl = file.getUrl();
    }
    const credential = {
      id: record.id, serial: record.serial, firstName: record.firstName,
      fullName: record.fullName, category: record.category, palette: record.palette,
      createdAt: record.createdAt, event: record.event, avatar: record.avatar,
      dayPassRequested: record.dayPassRequested
    };
    const row = [
      record.createdAt, record.requestId, record.serial, record.fullName, record.firstName,
      record.age, record.whatsapp, record.membership, record.category,
      record.interest ? 'Sim' : 'Não', record.dayPassRequested ? 'Sim' : 'Não', record.dayPassStatus,
      record.contribution ? 'Sim' : 'Não', record.contributionItem, record.avatar, photoUrl,
      photoId, record.palette.join(' → '), 'Sim', record.consentVersion,
      record.event.title, record.event.instructorName || '', record.event.date || '', record.event.time || '',
      record.event.unit, record.event.city, record.id, message.fingerprint, JSON.stringify(credential)
    ];
    // Tudo em texto preserva zeros do código e do WhatsApp; escape evita fórmulas.
    const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
    range.setNumberFormat('@');
    range.setValues([row.map(sheetText_)]);
    SpreadsheetApp.flush();
    return output_({ ok: true, storage: 'google', credential: credential });
  } catch (error) {
    // Não retorna nome, telefone, foto, segredo ou detalhes internos em erros.
    return output_({ ok: false, code: error.message === 'INVALID_DATA' ? 'INVALID_DATA' : 'SAVE_FAILED' });
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}

function validate_(r, minimumAge) {
  const fail = function () { throw new Error('INVALID_DATA'); };
  if (!r || !Number.isInteger(minimumAge) || minimumAge < 16 || !Number.isInteger(r.age) || r.age < minimumAge || r.age > 120) fail();
  if (typeof r.fullName !== 'string' || r.fullName.length < 4 || r.fullName.length > 120 || r.fullName.trim().split(/\s+/).length < 2) fail();
  if (!/^55[1-9]{2}9\d{8}$/.test(r.whatsapp || '') || r.consent !== true) fail();
  if (['guest', 'other', 'unit', 'black'].indexOf(r.membership) === -1 || typeof r.interest !== 'boolean' || typeof r.contribution !== 'boolean') fail();
  if (typeof r.contributionItem !== 'string' || r.contributionItem.length > 200 || (r.contribution && r.contributionItem.length < 2)) fail();
  if (!/^[a-f0-9-]{36}$/i.test(r.requestId || '') || !/^[a-f0-9-]{36}$/i.test(r.id || '')) fail();
  if (!/^\d{13}$/.test(r.serial || '') || eanCheck_(r.serial.slice(0, 12)) !== r.serial[12]) fail();
  if (!Array.isArray(r.palette) || r.palette.length !== 3 || r.palette.some(function (c) { return !/^#[a-f0-9]{6}$/i.test(c); })) fail();
  if (!r.event || typeof r.event.title !== 'string' || typeof r.event.unit !== 'string') fail();
  if (r.photo) {
    if (typeof r.photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(r.photo)) fail();
    const bytes = Utilities.base64Decode(r.photo.split(',')[1]);
    if (bytes.length > 360000 || bytes.length < 20 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[2] & 255) !== 255) fail();
  } else if (['disco', 'cool', 'fox', 'cat', 'butterfly', 'robot'].indexOf(r.avatar) === -1) fail();
}
function sheetText_(value) {
  const text = String(value == null ? '' : value);
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
}
function hex_(bytes) { return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join(''); }
function safeEqual_(a, b) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function eanCheck_(base) { let sum = 0; for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 ? 3 : 1); return String((10 - sum % 10) % 10); }
function randomSerial_() { const raw = Utilities.getUuid().replace(/[^0-9]/g, '') + Utilities.getUuid().replace(/[^0-9]/g, ''); const base = raw.slice(0, 12).padEnd(12, '0'); return base + eanCheck_(base); }
function output_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }

// Somente campos permitidos entram no registro. Série, categoria e evento vêm do servidor.
function publicRegistration_(body, props) {
  const fail = function () { throw new Error('INVALID_DATA'); };
  const clean = function (value, max) { return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, max) : ''; };
  if (!body || typeof body !== 'object') fail();
  const fullName = clean(body.fullName, 120);
  if (fullName.length < 4 || !/^\p{L}[\p{L}\p{M}'’.-]*(?: [\p{L}\p{M}'’.-]+)+$/u.test(fullName)) fail();
  const age = Number(body.age);
  if (body.age === '' || !Number.isInteger(age) || age < Number(props.getProperty('MINIMUM_AGE') || '17') || age > 120) fail();
  if (['guest', 'other', 'unit', 'black'].indexOf(body.membership) < 0) fail();
  const raw = typeof body.whatsapp === 'string' ? body.whatsapp.replace(/\D/g, '') : '';
  const phone = raw.length === 13 && raw.indexOf('55') === 0 ? raw.slice(2) : raw;
  if (!/^[1-9]{2}9\d{8}$/.test(phone)) fail();
  if (typeof body.interest !== 'boolean' || typeof body.contribution !== 'boolean' || body.consent !== true) fail();
  const item = body.contribution ? clean(body.contributionItem, 200) : '';
  if (body.contribution && item.length < 2) fail();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || '')) fail();
  const photo = body.photo || null;
  if (photo && (typeof photo !== 'string' || photo.length > 470000)) fail();
  if (!photo && ['disco', 'cool', 'fox', 'cat', 'butterfly', 'robot'].indexOf(body.avatar) < 0) fail();
  return { requestId: body.requestId, fullName: fullName, age: age, whatsapp: '55' + phone,
    membership: body.membership, interest: body.interest, contribution: body.contribution,
    contributionItem: item, consent: true, consentVersion: PUBLIC_EVENT.consentVersion,
    avatar: photo ? 'photo' : body.avatar, photo: photo };
}
function publicRecord_(registration) {
  const categories = { guest: 'CONVIDADO · NÃO ALUNO', other: 'CONVIDADO · OUTRA UNIDADE', unit: 'ALUNO · UNIDADE DO EVENTO', black: 'ALUNO · PLANO BLACK' };
  const palettes = [['#ff62b4','#955dff','#ffb65d'],['#ffc15c','#ff6b79','#ca65e9'],['#64e2d4','#5c88fa','#b77eff'],['#baf56b','#63cfb6','#8195ff'],['#ff87b2','#fd9159','#ffda74']];
  const interest = ['guest', 'other'].indexOf(registration.membership) >= 0 && registration.interest;
  return Object.assign({}, registration, { id: Utilities.getUuid(), serial: randomSerial_(),
    firstName: registration.fullName.split(' ')[0], category: categories[registration.membership],
    palette: palettes[Math.floor(Math.random() * palettes.length)], createdAt: new Date().toISOString(),
    event: { title: PUBLIC_EVENT.title, instructorName: PUBLIC_EVENT.instructorName, date: PUBLIC_EVENT.date, time: PUBLIC_EVENT.time, unit: PUBLIC_EVENT.unit, city: PUBLIC_EVENT.city },
    dayPassRequested: interest, dayPassStatus: interest ? 'INTERESSE REGISTRADO · AGUARDA UNIDADE' : 'NÃO SOLICITADO' });
}
