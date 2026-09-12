import { initializeCardStack } from './card-stack.js';
import { staticEventConfig } from './site-config.js';

initializeCardStack();

const $ = selector => document.querySelector(selector);
const countdownTarget = new Date('2026-09-17T18:30:00-03:00').getTime();
let countdownTimer = null;
function updateCountdown() {
  const remaining = Math.max(0, countdownTarget - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  $('#countdown-days').textContent = String(days).padStart(2, '0');
  $('#countdown-hours').textContent = String(hours).padStart(2, '0');
  $('#countdown-minutes').textContent = String(minutes).padStart(2, '0');
  $('#countdown-seconds').textContent = String(seconds).padStart(2, '0');
  const message = $('#countdown-message');
  if (message) {
  if (remaining === 0) message.textContent = 'O aulão começou! Bem-vinda à festa.';
  else if (days > 0) message.textContent = `Faltam ${days} ${days === 1 ? 'dia' : 'dias'} para o aulão. No dia, o relógio mostra horas, minutos e segundos.`;
  else if (hours > 0) message.textContent = `Faltam ${hours} ${hours === 1 ? 'hora' : 'horas'} — já estamos no dia do aulão!`;
  else if (minutes > 0) message.textContent = `Faltam ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} para começar.`;
  else message.textContent = `Faltam ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}!`;
  }
  if (remaining === 0 && countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}
updateCountdown();
if (Date.now() < countdownTarget) countdownTimer = setInterval(updateCountdown, 1000);

async function initialize() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('config');
    const config = await response.json();
    $('#hero-unit').textContent = config.unit;
    $('#hero-city').textContent = config.city;
    $('#location-address').textContent = config.address || config.city;
    const encodedAddress = encodeURIComponent(`${config.unit}, ${config.address || config.city}`);
    $('#map-link').href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    $('#map-frame').src = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
    $('#what-to-bring').textContent = config.whatToBring;
    $('#entry-note').textContent = config.entryNote;
    $('#demo-banner').hidden = config.mode !== 'local';
    document.title = `${config.title}${config.instructorName ? ` · ${config.instructorName}` : ''} · Bora dançar`;
  } catch {
    const config = staticEventConfig;
    $('#hero-unit').textContent = config.unit; $('#hero-city').textContent = config.city;
    $('#location-address').textContent = config.address;
    $('#what-to-bring').textContent = config.whatToBring; $('#entry-note').textContent = config.entryNote;
    $('#demo-banner').hidden = config.mode !== 'local';
    updateCountdown();
  }
}
initialize();
