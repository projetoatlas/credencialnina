import { createHmac } from 'node:crypto';

/**
 * O Apps Script exige assinatura com horário recente. Em caso de EXPIRED,
 * sincroniza apenas esta integração com o cabeçalho Date da resposta HTTPS
 * do Google e repete uma vez. O relógio do sistema não é alterado.
 */
export function createGoogleClient({ url, secret, fetchImpl = fetch, now = Date.now, timeoutMs = 55_000 }) {
  let clockOffsetMs = 0;
  return async function send(data) {
    const signal = AbortSignal.timeout(timeoutMs);
    for (let attempt = 0; attempt < 2; attempt++) {
      const payload = JSON.stringify({ ...data, timestamp: now() + clockOffsetMs });
      const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
      const response = await fetchImpl(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, signature }), redirect: 'follow', signal
      });
      if (!response.ok) throw new Error('GOOGLE_HTTP_ERROR');
      const result = await response.json();
      if (result?.code === 'EXPIRED' && attempt === 0) {
        const googleTime = Date.parse(response.headers.get('date') || '');
        if (Number.isFinite(googleTime)) {
          clockOffsetMs = googleTime - now();
          continue;
        }
      }
      return result;
    }
  };
}
