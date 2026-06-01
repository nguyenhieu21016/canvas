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
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.textContent = previous;
  };
}
