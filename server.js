import http from 'node:http';
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { validateRegistration, createCredential, publicCredential } from './src/domain.js';
import { createGoogleClient } from './src/google-client.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'event.config.json'), 'utf8'));
if (!Number.isInteger(config.minimumAge) || config.minimumAge < 16) throw new Error('Configure minimumAge com um inteiro a partir de 16.');
const mode = process.env.STORAGE_MODE || 'local';
if (!['local', 'google'].includes(mode)) throw new Error('STORAGE_MODE deve ser local ou google.');
const googleUrl = process.env.GOOGLE_SCRIPT_URL;
const secret = process.env.GOOGLE_SCRIPT_SECRET;
const googleClient = createGoogleClient({ url: googleUrl, secret });
if (mode === 'google' && (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(googleUrl || '') || !secret || secret.length < 32)) throw new Error('Configure GOOGLE_SCRIPT_URL e GOOGLE_SCRIPT_SECRET (32 caracteres ou mais) no .env.');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const dataDir = path.resolve(root, process.env.DATA_DIR || 'data');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
let queue = Promise.resolve();
const attempts = new Map();
const trustedProxies = new Set((process.env.TRUSTED_PROXY_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean));
setInterval(() => { const now = Date.now(); for (const [key, value] of attempts) if (now - value.start > 600_000) attempts.delete(key); }, 600_000).unref();
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function readJson(req) {
  const buffers = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 550_000) { const e = new Error('A foto é muito grande. Escolha outra.'); e.status = 413; throw e; } buffers.push(chunk); }
  try { return JSON.parse(Buffer.concat(buffers).toString('utf8')); } catch { const e = new Error('Não foi possível ler os dados.'); e.status = 400; throw e; }
}
async function saveLocal(record, fingerprint) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, `${record.requestId}.json`);
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (saved.fingerprint !== fingerprint) { const e = new Error('Este envio já foi usado. Recarregue a página para um novo cadastro.'); e.status = 409; throw e; }
    return saved.record;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = (await readdir(dataDir)).filter(name => name.endsWith('.json'));
  const serials = new Set(await Promise.all(files.map(async name => JSON.parse(await readFile(path.join(dataDir, name), 'utf8')).record.serial)));
  while (serials.has(record.serial)) record.serial = createCredential(record, config).serial;
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify({ fingerprint, record }, null, 2), { mode: 0o600 });
  await rename(temp, file);
  return record;
}
async function saveGoogle(record, fingerprint) {
  let result;
  try {
    result = await googleClient({ record, fingerprint });
  } catch { throw new Error('Não recebemos a confirmação da planilha. Tente novamente; o mesmo envio não será duplicado.'); }
  if (!result.ok) {
    const error = new Error(result.code === 'IDEMPOTENCY_CONFLICT' ? 'Este envio já foi salvo com outros dados. Para corrigir o cadastro, procure a organização. Recarregue a página somente se quiser iniciar um novo cadastro.' : 'A planilha não confirmou o cadastro. Tente novamente ou avise a organização.');
    if (result.code === 'IDEMPOTENCY_CONFLICT') error.status = 409;
    throw error;
  }
  if (!result.credential?.serial || !/^\d{13}$/.test(result.credential.serial)) throw new Error('A confirmação da planilha está incompleta. Avise a organização.');
  return { ...record, ...result.credential };
}
export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src https://www.google.com/maps/ https://www.google.com/; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { ...config, mode });
    if (req.method === 'POST' && url.pathname === '/api/registrations') {
      const expectedOrigin = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== expectedOrigin) return json(res, 403, { error: 'Origem de envio não permitida.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Envie os dados como JSON.' });
      const peer = req.socket.remoteAddress;
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim();
      const ip = trustedProxies.has(peer) && isIP(forwarded) ? forwarded : peer;
      const entry = attempts.get(ip) || { count: 0, start: Date.now() };
      if (Date.now() - entry.start > 600_000) { entry.count = 0; entry.start = Date.now(); }
      entry.count++; attempts.set(ip, entry);
      if (entry.count > 40) return json(res, 429, { error: 'Muitos envios em pouco tempo. Aguarde alguns minutos.' });
      const body = await readJson(req);
      const registration = validateRegistration(body, config);
      const fingerprint = createHash('sha256').update(JSON.stringify(registration)).digest('hex');
      const candidate = createCredential(registration, config);
      let saved;
      if (mode === 'google') saved = await saveGoogle(candidate, fingerprint);
      else {
        const operation = queue.then(() => saveLocal(candidate, fingerprint));
        queue = operation.catch(() => {});
        saved = await operation;
      }
      return json(res, 201, { credential: publicCredential(saved, mode === 'local'), storage: mode });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Endereço não encontrado.' });
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Método não permitido.' });
    const pathname = decodeURIComponent(url.pathname);
    const requested = path.resolve(root, 'public', '.' + (pathname === '/' ? '/index.html' : pathname));
    const publicRoot = path.join(root, 'public') + path.sep;
    if (!requested.startsWith(publicRoot)) return json(res, 404, { error: 'Arquivo não encontrado.' });
    const ext = path.extname(requested);
    if (!mime[ext]) return json(res, 404, { error: 'Arquivo não encontrado.' });
    const data = await readFile(requested);
    res.writeHead(200, { 'Content-Type': mime[ext], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return json(res, 404, { error: 'Arquivo não encontrado.' });
    const status = error.status || 502;
    if (status >= 500) console.error('Falha ao salvar cadastro:', error.name);
    return json(res, status, { error: error.status ? error.message : 'Não foi possível confirmar o cadastro na planilha. Tente novamente; seu envio não será duplicado.', field: error.field });
  }
});
server.listen(port, host, () => {
  console.log(`Site disponível em http://${host}:${server.address().port}`);
  console.log(mode === 'local' ? 'Demonstração: cadastros salvos somente em data/. Credenciais sem validade.' : 'Google Planilhas: integração ativada.');
});
