const WORDS_PER_MINUTE = 150;

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(Math.round(totalSeconds % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function describe(seconds, budget) {
  if (seconds === 0) return ['Nothing yet', 'var(--ink-faint)'];
  if (seconds > budget) return ['Over — cut it', 'var(--accent)'];
  if (seconds > budget * 0.9) return ['Cutting it fine', 'var(--warn)'];
  if (seconds < budget * 0.45) return ['Room to say more', 'var(--warn)'];
  return ['Fits comfortably', 'var(--good)'];
}

function wireTimer(timer) {
  const box = timer.querySelector('textarea');
  const fill = timer.querySelector('[data-meter-fill]');
  const clock = timer.querySelector('[data-meter-clock]');
  const verdict = timer.querySelector('[data-meter-verdict]');
  const budget = Number(timer.dataset.budgetSeconds || 180);
  const storageKey = timer.dataset.storageKey;

  const update = () => {
    const words = box.value.trim().split(/\s+/).filter(Boolean).length;
    const seconds = (words / WORDS_PER_MINUTE) * 60;
    const [label, colour] = describe(seconds, budget);
    fill.style.width = `${Math.min(100, (seconds / budget) * 100)}%`;
    fill.style.background = colour;
    clock.textContent = `${words} words — about ${formatClock(seconds)} spoken`;
    verdict.textContent = label;
    verdict.style.color = colour;
    if (storageKey) {
      try { localStorage.setItem(storageKey, box.value); } catch (ignored) {}
    }
  };

  if (storageKey) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) box.value = saved;
    } catch (ignored) {}
  }

  box.addEventListener('input', update);
  update();
}

document.querySelectorAll('[data-script-timer]').forEach(wireTimer);
