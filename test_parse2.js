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

const text1 = "\\loigiai{ \\left\\{ \\right. }";
console.log(extractBracketMatch(text1, text1.indexOf('{')));

const text2 = "\\loigiai{ a \\\\{ b }";
console.log(extractBracketMatch(text2, text2.indexOf('{')));

