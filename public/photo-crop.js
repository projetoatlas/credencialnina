export function cropRectangle(width, height, zoom = 1, x = 50, y = 50) {
  const side = Math.min(width, height) / Math.max(1, Math.min(3, zoom));
  return { x: (width - side) * Math.max(0, Math.min(100, x)) / 100,
    y: (height - side) * Math.max(0, Math.min(100, y)) / 100, side };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir essa foto. Escolha uma imagem JPG, PNG ou WebP.'));
    image.src = src;
  });
}

// O resultado é o mesmo JPEG usado na prévia, na planilha/Drive e no download.
export async function cropPhoto(file) {
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem JPG, PNG ou WebP. Para HEIC, exporte a foto como JPG.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A foto deve ter no máximo 10 MB.');
  const url = URL.createObjectURL(file);
  let image;
  try { image = await loadImage(url); } finally { URL.revokeObjectURL(url); }
  if (image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('Escolha uma foto com resolução menor.');
  const dialog = document.querySelector('#crop-dialog');
  const canvas = dialog.querySelector('canvas');
  const context = canvas.getContext('2d');
  const zoom = dialog.querySelector('#crop-zoom');
  const horizontal = dialog.querySelector('#crop-x');
  const vertical = dialog.querySelector('#crop-y');
  zoom.value = 1; horizontal.value = vertical.value = 50;
  const rectangle = () => cropRectangle(image.naturalWidth, image.naturalHeight, Number(zoom.value), Number(horizontal.value), Number(vertical.value));
  const draw = () => {
    const { x, y, side } = rectangle();
    context.fillStyle = '#fff6df'; context.fillRect(0, 0, 600, 600);
    context.drawImage(image, x, y, side, side, 0, 0, 600, 600);
  };
  draw();
  return new Promise(resolve => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let result = null, pointer = null;
    [zoom, horizontal, vertical].forEach(input => input.addEventListener('input', draw, options));
    canvas.addEventListener('pointerdown', event => {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { side } = rectangle();
      const scale = side / canvas.getBoundingClientRect().width;
      const dx = image.naturalWidth - side, dy = image.naturalHeight - side;
      if (dx) horizontal.value = Math.max(0, Math.min(100, Number(horizontal.value) - (event.clientX - pointer.x) * scale / dx * 100));
      if (dy) vertical.value = Math.max(0, Math.min(100, Number(vertical.value) - (event.clientY - pointer.y) * scale / dy * 100));
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; draw();
    }, options);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, () => { pointer = null; }, options));
    dialog.querySelector('#crop-confirm').addEventListener('click', () => {
      for (const quality of [.88, .78, .65, .5]) {
        result = canvas.toDataURL('image/jpeg', quality);
        if (result.length <= 470_000) break;
      }
      if (result.length > 470_000) { result = null; return; }
      dialog.close();
    }, options);
    dialog.querySelector('#crop-cancel').addEventListener('click', () => dialog.close(), options);
    dialog.addEventListener('close', () => { controller.abort(); resolve(result); }, { once: true });
    dialog.showModal();
  });
}
