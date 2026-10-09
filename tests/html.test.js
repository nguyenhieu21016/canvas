import { describe, expect, it } from 'vitest';
import { escapeHtml, renderLatexText, option } from '../src/lib/html.js';

describe('escapeHtml', () => {
  it('escapes dangerous HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });
});

describe('renderLatexText', () => {
  it('renders bold, italic and latex math properly', () => {
    const raw = 'Cho hàm số \\textbf{f(x)} thỏa mãn $x^2 + 1 = 0$.';
    const output = renderLatexText(raw);
    expect(output).toContain('<strong>f(x)</strong>');
    expect(output).toContain('$x^2 + 1 = 0$');
  });

  it('escapes malicious attributes in markdown images', () => {
    const malicious = '![hack](https://example.com/test.jpg" onerror="alert(1))';
    const output = renderLatexText(malicious);
    expect(output).not.toContain('onerror="alert(1)"');
    expect(output).toContain('&amp;quot;');
  });

  it('strips dangerous protocols in markdown images', () => {
    const dangerous = '![hack](javascript:alert(1))';
    const output = renderLatexText(dangerous);
    expect(output).not.toContain('<img');
  });
});

describe('option', () => {
  it('creates option element with selected state', () => {
    expect(option('admin', 'Quản trị viên', 'admin')).toContain('selected');
    expect(option('student', 'Học sinh', 'admin')).not.toContain('selected');
  });
});
