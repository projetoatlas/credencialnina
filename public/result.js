import { drawCredential } from './credential.js';
import { loadCredentialSession } from './credential-session.js';
const $ = selector => document.querySelector(selector);
const canvas = $('#result-canvas');
const downloadButton = $('#download-button');
const DOWNLOAD_MARKER_PREFIX = 'fitdance:credential:downloaded:';
let credential = null;

function downloadMarkerKey(card) { return `${DOWNLOAD_MARKER_PREFIX}${card.serial}`; }

function wasDownloaded(card) {
  try { return sessionStorage.getItem(downloadMarkerKey(card)) === '1'; }
  catch { return false; }
}

function markDownloaded(card) {
  try { sessionStorage.setItem(downloadMarkerKey(card), '1'); }
  catch { /* O download continua válido mesmo sem sessionStorage. */ }
}

async function downloadCredentialImage() {
  await drawCredential(canvas, credential);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('download');
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `credencial-${credential.serial}.png`;
  link.setAttribute('aria-label', `Baixar credencial ${credential.serial}`);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function initialize() {
  const saved = loadCredentialSession();
  if (!saved) { $('#empty-credential').hidden = false; return; }
  credential = saved.credential;
  $('#demo-banner').hidden = !credential.demo;
  $('#success-message').textContent = credential.demo ? 'Demonstração gerada neste computador. Ela não confirma entrada e não foi enviada ao Google Planilhas.' : 'Sua credencial será baixada automaticamente para este dispositivo. Apresente o arquivo e um documento na recepção da Smart Fit.';
  $('#success-name').textContent = credential.fullName;
  $('#success-category').textContent = credential.category;
  $('#success-serial').textContent = `Série ${credential.serial}`;
  $('#success-entry').textContent = saved.entryNote;
  $('#success-pass').hidden = !credential.dayPassRequested;
  $('#success-pass').textContent = credential.demo ? 'Na versão conectada, seu interesse no passe será registrado para avaliação da unidade.' : 'Seu interesse no passe de um dia foi registrado. Aguarde a confirmação da unidade.';
  downloadButton.disabled = true;
  downloadButton.hidden = true;
  $('#success-section').hidden = false;
  document.title = `Credencial de ${credential.firstName} · Bora dançar`;
  try {
    await drawCredential(canvas, credential);
    if (!wasDownloaded(credential)) {
      await downloadCredentialImage();
      markDownloaded(credential);
    }
    downloadButton.hidden = false;
    downloadButton.disabled = false;
    $('#success-title').textContent = 'Sua credencial está pronta!';
    $('#success-message').textContent = credential.demo
      ? 'A credencial de demonstração foi baixada para este dispositivo. Ela não confirma entrada na academia.'
      : 'O download da sua credencial foi iniciado. Procure o arquivo em Downloads. Se ele não aparecer, toque em “Baixar novamente”.';
  } catch {
    downloadButton.hidden = false;
    downloadButton.disabled = false;
    $('#success-message').textContent = 'A credencial está pronta, mas o download automático não foi concluído. Toque em “Baixar novamente” para salvá-la no dispositivo.';
  }
}
downloadButton.addEventListener('click', async () => {
  if (!credential) return;
  const button = downloadButton; button.disabled = true;
  try {
    await downloadCredentialImage();
    markDownloaded(credential);
    button.hidden = false;
    $('#success-message').textContent = credential.demo
      ? 'A credencial de demonstração foi baixada para este dispositivo. Ela não confirma entrada na academia.'
      : 'O download foi iniciado novamente. Apresente a credencial com um documento na recepção da Smart Fit.';
  } catch {
    $('#success-message').textContent = 'Não foi possível baixar a imagem agora. Tente novamente ou salve uma captura da credencial.';
  } finally { button.disabled = false; }
});
initialize();
