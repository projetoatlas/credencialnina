import { cropPhoto } from './photo-crop.js';
import { submitRegistration } from './registration-api.js';
import { drawCredential } from './credential.js';
import { ensureSessionAvailable, saveCredentialSession } from './credential-session.js';
import { staticEventConfig } from './site-config.js';
const $ = (selector) => document.querySelector(selector);
const form = $('#registration-form');
const preview = $('#credential-canvas');
let config = null, photo = null, avatar = 'disco', stream = null;
let requestId = crypto.randomUUID(), saving = false, processingPhoto = false, photoVersion = 0;
const categories = { guest: 'CONVIDADO · NÃO ALUNO', other: 'CONVIDADO · OUTRA UNIDADE', unit: 'ALUNO · UNIDADE DO EVENTO', black: 'ALUNO · PLANO BLACK' };
function previewCard() {
  const fullName = $('#fullName').value.trim().replace(/\s+/g, ' ');
  return { fullName, firstName: fullName.split(' ')[0], avatar, photo, category: categories[form.elements.membership.value], event: config || {}, demo: false };
}
function updatePreview() { drawCredential(preview, previewCard()).catch(() => { $('#photo-status').textContent = 'Não conseguimos exibir sua foto. Escolha a imagem novamente antes de continuar.'; }); }
function updateSubmitState() { $('#submit-button').disabled = !config || saving || processingPhoto; }
function showFormError(message, field) {
  const error = $('#form-error'); error.textContent = message; error.hidden = false;
  const input = field ? form.querySelector(`[name="${field}"]`) : null;
  if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); } else error.focus();
}
async function initialize() {
  config = staticEventConfig;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    try {
      const response = await fetch('/api/config');
      if (response.ok) config = await response.json();
    } catch { /* A publicação estática usa a integração pública configurada. */ }
  }
  $('#daypass-note').textContent = config.dayPassNote;
  $('#age').min = config.minimumAge;
  $('#age-hint').textContent = 'Participação a partir de ' + config.minimumAge + ' anos.';
  $('#privacy-contact').textContent = config.privacyContact;
  $('#demo-banner').hidden = config.mode !== 'local';
  $('#privacy-storage').textContent = config.mode === 'local'
    ? 'Nesta demonstração, os dados ficam somente no computador que executa o site.'
    : 'Os dados ficam em uma planilha privada da organização. Fotos enviadas ficam em uma pasta privada do Google Drive. A credencial é gerada após a confirmação do cadastro.';
  updateSubmitState(); updatePreview();
}
form.addEventListener('input', (event) => { event.target.removeAttribute('aria-invalid'); $('#form-error').hidden = true; if (event.target.name === 'fullName') updatePreview(); });
form.addEventListener('change', (event) => {
  if (event.target.name === 'membership') updatePreview();
  if (event.target.name === 'contribution') { const yes = event.target.value === 'yes'; $('#contribution-detail').hidden = !yes; $('#contributionItem').disabled = !yes; $('#contributionItem').required = yes; if (yes) $('#contributionItem').focus(); else $('#contributionItem').value = ''; }
});
$('#whatsapp').addEventListener('input', (event) => {
  let digits = event.target.value.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  event.target.value = digits.length > 7 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits.length > 2 ? `(${digits.slice(0, 2)}) ${digits.slice(2)}` : digits;
});
function selectAvatar(value) {
  photoVersion++; avatar = value; photo = null; processingPhoto = false;
  document.querySelectorAll('[data-avatar]').forEach(button => { const selected = button.dataset.avatar === value; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  $('#remove-photo').hidden = true; $('#gallery-input').value = ''; $('#capture-input').value = '';
  $('#photo-status').textContent = 'Personagem selecionado. Você também pode escolher uma foto.'; updateSubmitState(); updatePreview();
}
document.querySelectorAll('[data-avatar]').forEach(button => button.addEventListener('click', () => selectAvatar(button.dataset.avatar)));
$('#remove-photo').addEventListener('click', () => selectAvatar(avatar));
$('#gallery-button').addEventListener('click', () => $('#gallery-input').click());
async function processPhoto(file) {
  if (!file) return;
  const version = ++photoVersion; processingPhoto = true; updateSubmitState();
  $('#photo-status').textContent = 'Preparando sua foto…';
  try {
    const cropped = await cropPhoto(file);
    if (version !== photoVersion) return;
    if (!cropped) { $('#photo-status').textContent = 'Recorte cancelado. Sua seleção anterior foi mantida.'; return; }
    photo = cropped;
    document.querySelectorAll('[data-avatar]').forEach(button => { button.classList.remove('selected'); button.setAttribute('aria-pressed', 'false'); });
    $('#remove-photo').hidden = false; $('#photo-status').textContent = 'Foto pronta! Confira o recorte na prévia da credencial.'; updatePreview();
  } catch (error) { if (version === photoVersion) $('#photo-status').textContent = error.message || 'Não foi possível abrir a imagem. Tente outra foto.'; }
  finally { if (version === photoVersion) { processingPhoto = false; updateSubmitState(); } }
}
$('#gallery-input').addEventListener('change', (event) => processPhoto(event.target.files[0]));
$('#capture-input').addEventListener('change', (event) => processPhoto(event.target.files[0]));
function stopCamera() { if (stream) stream.getTracks().forEach(track => track.stop()); stream = null; $('#camera-video').srcObject = null; $('#take-photo').disabled = true; }
$('#camera-button').addEventListener('click', async () => {
  if (window.matchMedia('(pointer: coarse)').matches) { $('#capture-input').click(); return; }
  if (!navigator.mediaDevices?.getUserMedia) { $('#photo-status').textContent = 'A câmera precisa de HTTPS ou localhost. Use a galeria para escolher sua foto.'; return; }
  const dialog = $('#camera-dialog'); $('#camera-status').textContent = 'Permita o acesso à câmera para tirar sua foto.'; dialog.showModal();
  try {
    const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 900 }, height: { ideal: 900 } }, audio: false });
    if (!dialog.open) { camera.getTracks().forEach(track => track.stop()); return; }
    stream = camera; $('#camera-video').srcObject = camera; await $('#camera-video').play();
    $('#take-photo').disabled = false; $('#camera-status').textContent = 'Posicione seu rosto no centro. A foto terá formato quadrado.';
  } catch { stopCamera(); $('#camera-status').textContent = 'Não conseguimos acessar a câmera. Confira a permissão do navegador ou escolha uma foto da galeria.'; }
});
$('#camera-close').addEventListener('click', () => $('#camera-dialog').close());
$('#camera-dialog').addEventListener('close', stopCamera);
$('#camera-dialog').addEventListener('cancel', stopCamera);
$('#take-photo').addEventListener('click', async () => {
  const video = $('#camera-video'); if (!video.videoWidth) return;
  const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9)); $('#camera-dialog').close(); if (blob) await processPhoto(blob);
});
window.addEventListener('pagehide', stopCamera);
document.addEventListener('visibilitychange', () => { if (document.hidden && $('#camera-dialog').open) $('#camera-dialog').close(); });
$('#privacy-button').addEventListener('click', () => $('#privacy-dialog').showModal());
$('#privacy-close').addEventListener('click', () => $('#privacy-dialog').close());
function lockForm(locked) {
  form.querySelectorAll('fieldset').forEach(fieldset => { fieldset.disabled = locked; });
  $('#consent').disabled = locked; saving = locked; updateSubmitState();
  $('#submit-button').textContent = locked ? 'Salvando seu cadastro…' : 'Criar minha credencial ↗';
}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (saving || processingPhoto || !config) return;
  if (!form.reportValidity()) return;
  try { ensureSessionAvailable(); }
  catch { showFormError('Permita o armazenamento deste site no navegador para abrir sua credencial na próxima página. Nenhum dado foi enviado.'); return; }
  const data = new FormData(form);
  const payload = { requestId, fullName: data.get('fullName'), age: Number(data.get('age')), whatsapp: data.get('whatsapp'), membership: data.get('membership'), interest: data.get('interest') === 'yes', contribution: data.get('contribution') === 'yes', contributionItem: data.get('contributionItem') || '', avatar, photo, consent: data.get('consent') === 'on' };
  $('#form-error').hidden = true; lockForm(true);
  try {
    const body = await submitRegistration(payload, config);
    try { saveCredentialSession(body.credential, config.entryNote); }
    catch { throw new Error('Seu cadastro foi salvo, mas o navegador não conseguiu preparar a próxima página. Permita o armazenamento deste site e tente novamente para abrir a credencial, sem duplicar o cadastro.'); }
    stopCamera();
    window.location.assign('./credencial.html');
  } catch (error) {
    lockForm(false);
    showFormError(['TimeoutError', 'AbortError', 'TypeError', 'SyntaxError'].includes(error.name) ? 'Não recebemos a confirmação do cadastro. Confira sua conexão e tente novamente. O mesmo envio não será duplicado.' : error.message, error.field);
  } finally { lockForm(false); }
});
initialize();
