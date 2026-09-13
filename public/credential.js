import { loadImage } from './photo-crop.js';
import QRCode from 'qrcode';

export const AVATAR_EMOJI = { disco: '🪩', cool: '😎', fox: '🦊', cat: '🐱', butterfly: '🦋', robot: '🤖' };

export async function generateQRCode(serial, size = 200) {
  if (!/^\d{13}$/.test(serial)) throw new Error('Número de série inválido.');
  return await QRCode.toCanvas(serial, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.95,
    margin: 1,
    width: size,
    color: { dark: '#211d27', light: '#fffdf9' }
  });
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
  const img = await loadImage(src); cachedPhoto = src; cachedImage = img; return img;
}

const renders = new WeakMap();

export async function drawCredential(canvas, card) {
  const version = (renders.get(canvas) || 0) + 1; renders.set(canvas, version);
  let photoImage = null;
  if (card.photo) photoImage = await loadPhoto(card.photo);
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
  else { ctx.fillStyle = '#eecdf0'; ctx.fillRect(225, 133, 270, 270); ctx.font = '142px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(AVATAR_EMOJI[card.avatar] || '🪩', 360, 268); }
  ctx.restore(); ctx.beginPath(); ctx.arc(360, 268, 139, 0, Math.PI * 2); ctx.strokeStyle = '#ffffffb3'; ctx.lineWidth = 5; ctx.stroke();
  
  ctx.textAlign = 'center'; ctx.fillStyle = '#261b37';
  textFit(ctx, card.firstName || 'Seu nome', 360, 499, 89, 608, 800, 30);
  ctx.font = '500 27px "Segoe UI", Arial, sans-serif'; wrapText(ctx, card.fullName || 'Nome e sobrenome', 360, 546, 610, 32);
  
  ctx.fillStyle = '#ffffff80'; ctx.beginPath(); ctx.roundRect(65, 612, 590, 51, 26); ctx.fill(); ctx.fillStyle = '#33213e'; textFit(ctx, card.category || 'SUA CATEGORIA DE PARTICIPAÇÃO', 360, 645, 23, 600, 600);
  
  textFit(ctx, card.event?.title || 'Aulão de aniversário', 360, 713, 28, 610, 700);
  const dateTime = `${eventDate(card.event?.date)}${card.event?.time ? ` · ${card.event.time}` : ' · Horário a confirmar'}`;
  textFit(ctx, dateTime, 360, 753, 23, 610, 500);
  textFit(ctx, card.event?.unit || 'Smart Fit Castelo', 360, 790, 24, 610, 600);
  
  ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 823, 720, 237);
  ctx.strokeStyle = '#ddd8e0'; ctx.lineWidth = 2; ctx.setLineDash([9, 9]); ctx.beginPath(); ctx.moveTo(0, 823); ctx.lineTo(720, 823); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#211d27';
  
  if (card.serial) {
    try {
      // Gerar QR Code
      const qrCanvas = await generateQRCode(card.serial, 200);
      const qrSize = 180;
      const qrX = (720 - qrSize) / 2;
      ctx.drawImage(qrCanvas, qrX, 855, qrSize, qrSize);
      
      // Número de série abaixo do QR Code
      ctx.font = '24px Consolas, monospace'; ctx.fillText(card.serial, 360, 1010);
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      ctx.fillStyle = '#dfd9e1'; ctx.beginPath(); ctx.roundRect(112, 861, 496, 79, 9); ctx.fill(); ctx.fillStyle = '#746b7c'; ctx.font = '600 19px "Segoe UI", Arial, sans-serif'; ctx.fillText('QR Code não disponível', 360, 907);
    }
  } else { 
    ctx.fillStyle = '#dfd9e1'; ctx.beginPath(); ctx.roundRect(112, 861, 496, 79, 9); ctx.fill(); ctx.fillStyle = '#746b7c'; ctx.font = '600 19px "Segoe UI", Arial, sans-serif'; ctx.fillText('Prévia · Código será gerado', 360, 907);
  }
  
  ctx.fillStyle = card.demo ? '#9d3153' : '#716975'; ctx.font = '600 17px "Segoe UI", Arial, sans-serif';
  ctx.fillText(card.demo ? 'DEMONSTRAÇÃO · SEM VALIDADE PARA ENTRADA' : card.serial ? 'SCANEIE O QR CODE NA RECEPÇÃO' : 'PRÉVIA · NÃO VÁLIDA PARA ENTRADA', 360, 1050);
  
  ctx.restore();
  canvas.setAttribute('aria-label', `${card.serial ? 'Credencial' : 'Prévia'} de ${card.fullName || 'nome e sobrenome'}. ${card.category || 'Categoria a selecionar'}.${card.serial ? ` Série ${card.serial}` : ''}`);
}
