const latexText = `\\begin{ex}
Cho hàm số $f(x) = 2\\sin x - \\sqrt{2}x$.
\\choiceTF
{\\True $f(0) = 0$; $\\left(\\dfrac{\\pi}{4}\\right) = \\sqrt{2} - \\dfrac{\\sqrt{2}}{4}\\pi$}
{\\False Đạo hàm của hàm số đã cho là $f'(x) = 2\\cos x + \\sqrt{2}$}
{\\True Nghiệm của phương trình $f'(x) = 0$ trên đoạn $[0; \\pi]$ là $\\dfrac{\\pi}{4}$}
{\\False Giá trị nhỏ nhất của $f(x)$ trên đoạn $\\left[-\\dfrac{\\pi}{2}; \\dfrac{\\pi}{2}\\right]$ là $-2 + \\dfrac{\\sqrt{2}\\pi}{2}$}
\\loigiai{
a) đúng
}
\\end{ex}`;

const regex = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g;
let match;
const questions = [];

const extractBracketMatch = (text, startIndex) => {
  let depth = 0;
  let start = startIndex + 1;
  for (let i = start; i < text.length; i++) {
    let backslashCount = 0;
    let j = i - 1;
    while (j >= 0 && text[j] === '\\') {
      backslashCount++;
      j--;
    }
    if (backslashCount % 2 === 1) {
      continue;
    }

    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      if (depth === 0) {
        return { content: text.substring(start, i), endIndex: i };
      }
      depth--;
    }
  }
  return null;
};

while ((match = regex.exec(latexText)) !== null) {
  let rawContent = match[1].trim();
  let explanation = '';

  const loigiaiIdx = rawContent.indexOf('\\loigiai');
  if (loigiaiIdx !== -1) {
    const openBracketIdx = rawContent.indexOf('{', loigiaiIdx);
    if (openBracketIdx !== -1) {
      const loigiaiMatch = extractBracketMatch(rawContent, openBracketIdx);
      if (loigiaiMatch) {
        explanation = loigiaiMatch.content.trim();
        rawContent = rawContent.substring(0, loigiaiIdx) + rawContent.substring(loigiaiMatch.endIndex + 1);
      }
    }
  }

  let type = 'mcq';
  let prompt = rawContent.trim();
  let choices = [];
  let correctAnswer = 'A';
  let tfStatements = ['', '', '', ''];
  let tfCorrect = [false, false, false, false];
  let shortAnswer = '';

  const choiceIdx = rawContent.indexOf('\\choice');
  const choiceTFIdx = rawContent.indexOf('\\choiceTF');
  const shortansIdx = rawContent.indexOf('\\shortans');

  if (choiceTFIdx !== -1) {
    type = 'tf4';
    prompt = rawContent.substring(0, choiceTFIdx).trim();
    let currentIdx = choiceTFIdx + '\\choiceTF'.length;

    for (let c = 0; c < 4; c++) {
      while (currentIdx < rawContent.length && /\s/.test(rawContent[currentIdx])) currentIdx++;
      if (rawContent[currentIdx] === '{') {
        const choiceMatch = extractBracketMatch(rawContent, currentIdx);
        if (choiceMatch) {
          let content = choiceMatch.content.trim();
          tfCorrect[c] = content.includes('\\True') || content.startsWith('\\True');
          tfStatements[c] = content.replace(/\\True\s*/g, '').replace(/\\False\s*/g, '').trim();
          currentIdx = choiceMatch.endIndex + 1;
        } else {
          break;
        }
      } else {
        break;
      }
    }
  } else if (choiceIdx !== -1) {
      // mcq logic
  } else if (shortansIdx !== -1) {
      // short logic
  } else {
    type = 'short';
  }

  questions.push({
    type: type,
    prompt: prompt,
    tfStatements
  });
}

console.log(JSON.stringify(questions, null, 2));
