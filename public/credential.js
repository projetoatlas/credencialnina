export const AVATAR_EMOJI = { disco: '🪩', cool: '😎', fox: '🦊', cat: '🐱', butterfly: '🦋', robot: '🤖' };
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
export function barcodeBits(serial) {
  if (!/^\d{13}$/.test(serial)) throw new Error('Número de série inválido.');
  const check = (10 - [...serial.slice(0, 12)].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) % 10) % 10;
  if (check !== Number(serial[12])) throw new Error('Dígito verificador inválido.');
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[Number(serial[0])][i - 1] === 'L' ? L : G)[Number(serial[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(serial[i])];
  return bits + '101';
}
export function eventDate(date) {
  if (!date) return 'Data a confirmar';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Data a confirmar' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(parsed);
}
function textFit(ctx, text, x, y, size, maxWidth, weight = 600, min = 20) {
  while (size > min) { ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`; if (ctx.measureText(text).width <= maxWidth) break; size--; }
  ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  if (ctx.measureText(text).width > maxWidth) { while (text.length && ctx.measureText(text + '…').width > maxWidth) text = text.slice(0, -1); text += '…'; }
  ctx.fillText(text, x, y);
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = text.split(' '); const lines = []; let line = '';
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => textFit(ctx, value, x, y + index * lineHeight, 27, maxWidth, 500, 20));
}
let cachedPhoto = null;
let cachedImage = null;
async function loadPhoto(src) {
  if (cachedPhoto === src && cachedImage) return cachedImage;
  const img = new Image(); img.src = src; await img.decode(); cachedPhoto = src; cachedImage = img; return img;
}
const renders = new WeakMap();
export async function drawCredential(canvas, card) {
  const version = (renders.get(canvas) || 0) + 1; renders.set(canvas, version);
  let photoImage = null;
  if (card.photo) { try { photoImage = await loadPhoto(card.photo); } catch { /* Use the selected persona if the image cannot be decoded. */ } }
  if (renders.get(canvas) !== version) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 720, 1060);
  ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, 720, 1060, 30); ctx.clip();
  const colors = card.palette || ['#ff62b4', '#955dff', '#ffb65d'];
  const gradient = ctx.createLinearGradient(0, 0, 720, 820); colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 720, 1060);
  const glow = ctx.createRadialGradient(590, 270, 0, 590, 270, 620); glow.addColorStop(0, '#ffffff55'); glow.addColorStop(1, '#ffffff00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 720, 850);
  ctx.textAlign = 'left'; ctx.fillStyle = '#251a36'; ctx.font = '700 23px "Segoe UI", Arial, sans-serif'; ctx.fillText('bora dançar.', 47, 62);
  ctx.textAlign = 'right'; ctx.font = '600 16px "Segoe UI", Arial, sans-serif'; ctx.fillText('BIRTHDAY EDITION', 671, 59);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff38'; ctx.beginPath(); ctx.roundRect(277, 84, 166, 13, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(360, 268, 135, 0, Math.PI * 2); ctx.fillStyle = '#fff6'; ctx.fill(); ctx.clip();
  if (photoImage) ctx.drawImage(photoImage, 225, 133, 270, 270);
  else { ctx.fillStyle = '#eecdf0'; ctx.fillRect(225, 133, 270, 270); ctx.font = '142px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(AVATAR_EMOJI[card.avatar] || AVATAR_EMOJI.disco, 360, 280); }
  ctx.restore(); ctx.beginPath(); ctx.arc(360, 268, 139, 0, Math.PI * 2); ctx.strokeStyle = '#ffffffb3'; ctx.lineWidth = 5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#261b37';
  textFit(ctx, card.firstName || 'Seu nome', 360, 499, 89, 608, 800, 30);
  ctx.font = '500 27px "Segoe UI", Arial, sans-serif'; wrapText(ctx, card.fullName || 'Nome e sobrenome', 360, 546, 610, 32);
  ctx.fillStyle = '#ffffff80'; ctx.beginPath(); ctx.roundRect(65, 612, 590, 51, 26); ctx.fill(); ctx.fillStyle = '#33213e'; textFit(ctx, card.category || 'SUA CATEGORIA DE PARTICIPAÇÃO', 360, 645, 21, 540, 750, 18);
  textFit(ctx, card.event?.title || 'Aulão de aniversário', 360, 713, 28, 610, 700);
  const dateTime = `${eventDate(card.event?.date)}${card.event?.time ? ` · ${card.event.time}` : ' · Horário a confirmar'}`;
  textFit(ctx, dateTime, 360, 753, 23, 610, 500);
  textFit(ctx, card.event?.unit || 'Smart Fit Castelo', 360, 790, 24, 610, 600);
  ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 823, 720, 237);
  ctx.strokeStyle = '#ddd8e0'; ctx.lineWidth = 2; ctx.setLineDash([9, 9]); ctx.beginPath(); ctx.moveTo(0, 823); ctx.lineTo(720, 823); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#211d27';
  if (card.serial) {
    const bits = barcodeBits(card.serial); const barWidth = 5; const left = (720 - bits.length * barWidth) / 2;
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') ctx.fillRect(left + i * barWidth, 855, barWidth, (i < 3 || (i >= 45 && i < 50) || i >= 92) ? 91 : 82);
    ctx.font = '24px Consolas, monospace'; ctx.fillText(card.serial, 360, 977);
  } else { ctx.fillStyle = '#dfd9e1'; ctx.beginPath(); ctx.roundRect(112, 861, 496, 79, 9); ctx.fill(); ctx.fillStyle = '#746b7c'; ctx.font = '600 19px "Segoe UI", Arial, sans-serif'; ctx.fillText('SEU CÓDIGO APARECE AQUI', 360, 909); ctx.font = '18px "Segoe UI", Arial, sans-serif'; ctx.fillText('Gerado após o cadastro', 360, 973); }
  ctx.fillStyle = card.demo ? '#9d3153' : '#716975'; ctx.font = '600 17px "Segoe UI", Arial, sans-serif';
  ctx.fillText(card.demo ? 'DEMONSTRAÇÃO · SEM VALIDADE PARA ENTRADA' : card.serial ? 'APRESENTE COM DOCUMENTO NA RECEPÇÃO' : 'PRÉVIA · NÃO VÁLIDA PARA ENTRADA', 360, 1023);
  ctx.restore();
  canvas.setAttribute('aria-label', `${card.serial ? 'Credencial' : 'Prévia'} de ${card.fullName || 'nome e sobrenome'}. ${card.category || 'Categoria a selecionar'}.${card.serial ? ` Série ${card.serial}.` : ''}${card.demo ? ' Demonstração sem validade para entrada.' : ''}`);
}
