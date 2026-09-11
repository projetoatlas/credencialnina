import { drawCredential } from './credential.js';
import { loadCredentialSession } from './credential-session.js';
const $ = selector => document.querySelector(selector);
const canvas = $('#result-canvas');
let credential = null;
async function initialize() {
  const saved = loadCredentialSession();
  if (!saved) { $('#empty-credential').hidden = false; return; }
  credential = saved.credential;
  $('#demo-banner').hidden = !credential.demo;
  $('#success-message').textContent = credential.demo ? 'Demonstração salva neste computador. Esta credencial não confirma entrada e ainda não foi enviada ao Google Planilhas.' : 'Cadastro confirmado na planilha do evento. Baixe sua credencial e guarde para o aulão.';
  $('#success-name').textContent = credential.fullName;
  $('#success-category').textContent = credential.category;
  $('#success-serial').textContent = `Série ${credential.serial}`;
  $('#success-entry').textContent = saved.entryNote;
  $('#success-pass').hidden = !credential.dayPassRequested;
  $('#success-pass').textContent = credential.demo ? 'Na versão conectada, seu interesse no passe será registrado para avaliação da unidade.' : 'Seu interesse no passe de um dia foi registrado. Aguarde a confirmação da unidade.';
  $('#download-button').disabled = true;
  $('#success-section').hidden = false;
  document.title = `Credencial de ${credential.firstName} · Bora dançar`;
  try { await drawCredential(canvas, credential); $('#download-button').disabled = false; }
  catch { $('#success-message').textContent = 'Seu cadastro foi salvo, mas não foi possível exibir a imagem. Recarregue esta página para tentar novamente.'; }
}
$('#download-button').addEventListener('click', async () => {
  if (!credential) return;
  const button = $('#download-button'); button.disabled = true;
  try {
    await drawCredential(canvas, credential);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('download');
    const link = document.createElement('a'); const url = URL.createObjectURL(blob);
    link.href = url; link.download = `credencial-${credential.serial}.png`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch { $('#success-message').textContent = 'Não foi possível baixar a imagem. Tente novamente ou salve uma captura da credencial.'; }
  finally { button.disabled = false; }
});
initialize();
