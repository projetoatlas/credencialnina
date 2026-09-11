export function initializeCardStack() {
  const stack = document.querySelector('#party-cards');
  if (!stack) return;
  const cards = [...stack.querySelectorAll('.stack-card')];
  if (cards.length < 2) return;
  const order = [...cards];
  const pauseButton = stack.querySelector('#stack-pause');
  const nextButton = stack.querySelector('#stack-next');
  const count = stack.querySelector('#stack-count');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  let timer;
  let busy = false;
  let hovering = false;
  let visible = true;

  function render() {
    order.forEach((card, position) => {
      card.dataset.position = String(position);
      card.setAttribute('aria-hidden', String(position !== 0));
      card.inert = position !== 0;
    });
    count.textContent = `${cards.indexOf(order[0]) + 1} / ${cards.length}`;
  }

  function schedule() {
    clearTimeout(timer);
    if (paused || busy || hovering || !visible || document.hidden || stack.contains(document.activeElement)) return;
    timer = setTimeout(advance, 5000);
  }

  async function advance() {
    if (busy) return;
    clearTimeout(timer);
    busy = true;
    nextButton.setAttribute('aria-disabled', 'true');
    const outgoing = order[0];
    if (!reducedMotion.matches) {
      outgoing.classList.add('is-cycling');
      await new Promise(resolve => setTimeout(resolve, 340));
    }
    order.push(order.shift());
    render();
    if (!reducedMotion.matches) await new Promise(resolve => setTimeout(resolve, 420));
    outgoing.classList.remove('is-cycling');
    busy = false;
    nextButton.removeAttribute('aria-disabled');
    schedule();
  }

  function updatePauseLabel() {
    pauseButton.textContent = paused ? 'Reproduzir' : 'Pausar';
    pauseButton.setAttribute('aria-label', `${paused ? 'Iniciar' : 'Pausar'} troca automática dos cards`);
  }

  pauseButton.addEventListener('click', () => {
    paused = !paused;
    updatePauseLabel();
    schedule();
  });
  nextButton.addEventListener('click', advance);
  stack.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hovering = true; schedule(); }
  });
  stack.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  stack.addEventListener('focusin', () => { count.setAttribute('aria-live', 'polite'); schedule(); });
  stack.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!stack.contains(document.activeElement)) count.setAttribute('aria-live', 'off');
      schedule();
    }, 0);
  });
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) paused = true;
    updatePauseLabel();
    schedule();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { threshold: 0.2 }).observe(stack);
  }
  stack.querySelector('.stack-controls').hidden = false;
  updatePauseLabel();
  render();
  schedule();
}
