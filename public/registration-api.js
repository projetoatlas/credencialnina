import { googleScriptUrl } from './site-config.js';
import { barcodeBits } from './credential.js';

export async function submitRegistration(payload, config, fetcher = fetch) {
  const pages = config.mode === 'pages';
  if (pages && !googleScriptUrl) throw new Error('A conexão com a planilha ainda não foi configurada. Avise a organização.');
  const response = await fetcher(pages ? googleScriptUrl : '/api/registrations', {
    method: 'POST',
    // POST simples evita o preflight que o Apps Script não atende.
    headers: { 'Content-Type': pages ? 'text/plain;charset=utf-8' : 'application/json' },
    redirect: 'follow', credentials: 'omit',
    body: JSON.stringify(pages ? { action: 'register', registration: payload } : payload),
    signal: AbortSignal.timeout(70_000)
  });
  const body = await response.json();
  if (!response.ok || (pages && body.ok !== true)) {
    const messages = {
      UNAUTHORIZED: 'A integração da planilha precisa ser atualizada pela organização. Seu cadastro não foi confirmado.',
      INVALID_DATA: 'Confira nome e sobrenome, idade, WhatsApp e os campos obrigatórios.',
      IDEMPOTENCY_CONFLICT: 'Este envio já foi salvo com outros dados. Procure a organização para corrigir o cadastro.',
      BUSY: 'Há outros cadastros em andamento. Aguarde um pouco e tente novamente.'
    };
    const error = new Error(body.error || messages[body.code] || 'A planilha não confirmou o cadastro. Tente novamente ou avise a organização.');
    error.field = body.field; throw error;
  }
  if (!body.credential || (pages && body.storage !== 'google')) throw new Error('A confirmação do cadastro está incompleta. Tente novamente.');
  barcodeBits(body.credential.serial);
  // O Google guarda o JPEG no Drive privado, sem devolver sua URL nem duplicá-lo na célula.
  // Preserva a foto deste envio na passagem à página da credencial.
  return { ...body, credential: { ...body.credential, photo: payload.photo || null,
    avatar: payload.photo ? 'photo' : payload.avatar,
    demo: pages ? false : body.credential.demo } };
}
