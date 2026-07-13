export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Render LaTeX text commands to HTML.
 * Splits the input by $...$ math segments to preserve them,
 * then processes text-formatting commands only outside math mode.
 * Supports: \textbf, \textit, \emph, \underline, \text, \textrm, \texttt
 */
export function renderLatexText(raw) {
  const str = String(raw ?? '');

  // Helper: extract content of the first balanced {...} starting at index `pos`
  // Returns { content, end } where end is the index AFTER the closing '}'
  function extractBraced(s, pos) {
    if (s[pos] !== '{') return null;
    let depth = 0;
    for (let i = pos; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') {
        depth--;
        if (depth === 0) return { content: s.slice(pos + 1, i), end: i + 1 };
      }
    }
    return null;
  }

  // Apply text-formatting commands to a plain-text segment (outside math)
  function applyTextCommands(seg) {
    // Escape HTML first so we don't double-escape later
    let result = escapeHtml(seg);

    // We work on the raw (unescaped) segment with a recursive approach
    // because the braced content may itself contain commands.
    // Re-do on raw and escape leaves:
    function processSegment(s) {
      const cmdPattern = /\\(textbf|textit|emph|underline|text|textrm|texttt|textsc)\s*\{/g;
      let out = '';
      let lastIdx = 0;
      let m;
      cmdPattern.lastIndex = 0;
      while ((m = cmdPattern.exec(s)) !== null) {
        // Text before the command
        out += escapeHtml(s.slice(lastIdx, m.index));
        const braceStart = m.index + m[0].length - 1; // position of '{'
        const match = extractBraced(s, braceStart);
        if (!match) {
          out += escapeHtml(s.slice(m.index, m.index + m[0].length));
          lastIdx = m.index + m[0].length;
          continue;
        }
        const inner = processSegment(match.content);
        const cmd = m[1];
        if (cmd === 'textbf') {
          out += `<strong>${inner}</strong>`;
        } else if (cmd === 'textit' || cmd === 'emph') {
          out += `<em>${inner}</em>`;
        } else if (cmd === 'underline') {
          out += `<u>${inner}</u>`;
        } else if (cmd === 'textsc') {
          out += `<span style="font-variant:small-caps">${inner}</span>`;
        } else if (cmd === 'texttt') {
          out += `<code>${inner}</code>`;
        } else {
          // \text, \textrm — just render content
          out += inner;
        }
        lastIdx = match.end;
        cmdPattern.lastIndex = lastIdx;
      }
      out += escapeHtml(s.slice(lastIdx));
      return out;
    }

    return processSegment(seg);
  }

  // Split by $...$ (inline math) and $$...$$ (display math)
  // Math content is HTML-escaped so `<`, `>`, `&` inside math don't break the DOM.
  // MathJax reads from text nodes, so it sees the decoded characters correctly.
  const segments = [];
  const mathRe = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;
  let last = 0;
  let mm;
  while ((mm = mathRe.exec(str)) !== null) {
    if (mm.index > last) segments.push({ type: 'text', value: str.slice(last, mm.index) });
    segments.push({ type: 'math', value: mm[0] });
    last = mm.index + mm[0].length;
  }
  if (last < str.length) segments.push({ type: 'text', value: str.slice(last) });

  return segments
    .map((seg) => {
      if (seg.type === 'math') {
        // Keep $ delimiters, escape only the inner content so HTML stays valid
        const delim = seg.value.startsWith('$$') ? '$$' : '$';
        const inner = seg.value.slice(delim.length, seg.value.length - delim.length);
        return delim + escapeHtml(inner) + delim;
      }
      return applyTextCommands(seg.value).replace(/\\\\(\s*\n)?/g, '\n');
    })
    .join('')
    .replace(/!\[([^\]]*?)\]\(([^)]+?)\)/g, (match, alt, url) => {
      return `<img src="${url}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;">`;
    })
    .replace(/\n/g, '<br>');
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
