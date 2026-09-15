import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';

const base = 'https://projetoatlas.github.io/credencialnina/';
const card = {
  id: 'browser-test', serial: '4006381333931', firstName: 'Convidada', fullName: 'Convidada Teste',
  category: 'CONVIDADO · NÃO ALUNO', palette: ['#ff62b4', '#955dff', '#ffb65d'], demo: false,
  event: { title: 'Aulão de aniversário', date: '2026-09-17', time: '19h30', unit: 'Smart Fit Castelo' },
  dayPassRequested: true, avatar: 'disco'
};

test.beforeEach(async ({ context }) => {
  // Usa exatamente os arquivos publicados em public/, incluindo imports relativos.
  await context.route(`${base}**`, async route => {
    const pathname = new URL(route.request().url()).pathname.slice('/credencialnina/'.length) || 'index.html';
    try {
      const body = await readFile(new URL(`../public/${pathname}`, import.meta.url));
      const extension = pathname.split('.').pop();
      await route.fulfill({ body, contentType: { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', jpg: 'image/jpeg', png: 'image/png' }[extension] || 'application/octet-stream' });
    } catch { await route.fulfill({ status: 404, body: 'Not found' }); }
  });
});

async function fillForm(page) {
  await page.locator('#fullName').fill(card.fullName);
  await page.locator('#age').fill('25');
  await page.locator('#whatsapp').fill('19999991234');
  await page.locator('input[name="membership"][value="guest"]').check();
  await page.locator('input[name="interest"][value="yes"]').check();
  await page.locator('input[name="contribution"][value="no"]').check();
  await page.locator('#consent').check();
}

for (const withPhoto of [false, true]) {
  test(`Pages cria a credencial, baixa PNG e o QR pode ser lido (${withPhoto ? 'foto recortada' : 'personagem'})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let downloads = 0;
    page.on('download', () => downloads++);
    let submissions = 0;
    await page.route('https://script.google.com/macros/s/**', async route => {
      const submitted = route.request().postDataJSON();
      expect(submitted.action).toBe('register');
      expect(submitted.registration.fullName).toBe(card.fullName);
      expect(Boolean(submitted.registration.photo)).toBe(withPhoto);
      if (withPhoto) expect(submitted.registration.photo).toMatch(/^data:image\/jpeg;base64,/);
      submissions++;
      await route.fulfill({ json: { ok: true, storage: 'google', credential: card } });
    });
    await page.goto(`${base}cadastro.html`);
    await expect(page.locator('#submit-button')).toBeEnabled();
    await fillForm(page);
    if (withPhoto) {
      const image = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0066ff'; ctx.fillRect(0, 0, 200, 300);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await page.locator('#gallery-input').setInputFiles({ name: 'foto-teste.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
      await expect(page.locator('#crop-dialog')).toBeVisible();
      await page.locator('#crop-confirm').click();
      await expect(page.locator('#photo-status')).toContainText('Foto pronta');
    }
    const downloading = page.waitForEvent('download');
    await page.locator('#submit-button').click();
    await expect(page).toHaveURL(`${base}credencial.html`);
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`credencial-${card.serial}.png`);
    expect(await download.failure()).toBeNull();
    const imageFile = await readFile(await download.path());
    expect(imageFile.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const pixels = await page.evaluate(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, qr: Array.from(ctx.getImageData(260, 826, 200, 190).data), photo: Array.from(ctx.getImageData(360, 268, 1, 1).data) };
    }, imageFile.toString('base64'));
    expect([pixels.width, pixels.height]).toEqual([720, 1060]);
    expect(jsQR(new Uint8ClampedArray(pixels.qr), 200, 190)?.data).toBe(card.serial);
    if (withPhoto) expect(pixels.photo[2]).toBeGreaterThan(220);
    await expect(page.locator('#success-name')).toHaveText(card.fullName);
    await expect(page.locator('#demo-banner')).toBeHidden();
    await expect(page.locator('.group-button')).toHaveAttribute('href', /chat\.whatsapp\.com\/DqiRIhrmoZ8KTEXLYcn97C/);
    await page.reload();
    await expect(page.locator('#success-name')).toHaveText(card.fullName);
    await expect(page.locator('#download-button')).toBeEnabled();
    expect(downloads).toBe(1);
    const secondDownload = page.waitForEvent('download');
    await page.locator('#download-button').click();
    expect(await (await secondDownload).failure()).toBeNull();
    expect(submissions).toBe(1);
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('credencial.png'), fullPage: true });
  });
}

test('falha da planilha permite tentar novamente sem emitir credencial falsa ou perder o envio', async ({ page }) => {
  let requestId;
  await page.route('https://script.google.com/macros/s/**', async route => {
    const body = route.request().postDataJSON();
    if (requestId) expect(body.registration.requestId).toBe(requestId);
    requestId = body.registration.requestId;
    await route.fulfill({ json: { ok: false, code: 'SAVE_FAILED' } });
  });
  await page.goto(`${base}cadastro.html`);
  await fillForm(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#submit-button').click();
    await expect(page.locator('#form-error')).toContainText('não confirmou');
    await expect(page.locator('#submit-button')).toBeEnabled();
    await expect(page).toHaveURL(`${base}cadastro.html`);
  }
  expect(await page.evaluate(() => sessionStorage.getItem('fitdance:credential:v1'))).toBeNull();
});
