export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function option(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(selectedValue ?? '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

export function setButtonLoading(button, loadingText = 'Đang xử lý...') {
  if (!button) return () => {};
  
  // Backup previous children to preserve DOM nodes (important for Lit slots)
  const previousNodes = Array.from(button.childNodes);
  
  const loadingSpan = document.createElement('span');
  loadingSpan.textContent = loadingText;
  loadingSpan.style.display = 'flex';
  loadingSpan.style.alignItems = 'center';
  loadingSpan.style.gap = '8px';

  button.disabled = true;
  button.replaceChildren(loadingSpan);

  return () => {
    button.disabled = false;
    button.replaceChildren(...previousNodes);
  };
}
