document.querySelectorAll('.checklist input[type="checkbox"]').forEach((box) => {
  const key = `checklist:${document.title}:${box.id}`;
  try {
    box.checked = localStorage.getItem(key) === 'true';
  } catch (ignored) {}
  box.addEventListener('change', () => {
    try { localStorage.setItem(key, String(box.checked)); } catch (ignored) {}
  });
});
