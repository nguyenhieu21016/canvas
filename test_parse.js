const extractBracketMatch = (text, startIndex) => {
  let depth = 0;
  let start = startIndex + 1;
  for (let i = start; i < text.length; i++) {
    // Ignore escaped braces
    if (text[i-1] === '\\') {
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

const text = "\\loigiai{ \\left\\{ \\right. }";
const idx = text.indexOf('{');
console.log(extractBracketMatch(text, idx));
