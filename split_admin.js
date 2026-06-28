const fs = require('fs');
const path = require('path');

const mainFile = path.join(__dirname, 'src/main.js');
const adminFile = path.join(__dirname, 'src/admin.js');

let content = fs.readFileSync(mainFile, 'utf8');

const functionsToExtract = [
  'mountManageHub',
  'mountSolutionRequestsManager',
  'mountContentManager',
  'mountAssignmentManager',
  'mountStudents',
  'mountGrades',
  'renderAttemptsTable'
];

let adminContent = `// admin.js - Lazy loaded module for admin routes
import { 
  state, pageRoot, renderLoading, renderErrorState, wireRouteRetry, 
  escapeHtml, formatDate, wireTableSearch, fetchSolutionRequests,
  supabase, lmsApi, toast
} from './main.js';

`;

// A simple function to extract a top-level function by name using brace counting
function extractFunction(name, str) {
  const asyncPrefix = `async function ${name}(`;
  const syncPrefix = `function ${name}(`;
  
  let startIndex = str.indexOf(asyncPrefix);
  if (startIndex === -1) {
    startIndex = str.indexOf(syncPrefix);
  }
  
  if (startIndex === -1) return null;

  let braceCount = 0;
  let inFunction = false;
  let endIndex = -1;

  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (str[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex !== -1) {
    const fnText = str.substring(startIndex, endIndex + 1);
    return { fnText, startIndex, endIndex };
  }
  return null;
}

const extracted = [];
for (const fn of functionsToExtract) {
  const result = extractFunction(fn, content);
  if (result) {
    adminContent += `export ` + result.fnText + `\n\n`;
    // Replace function in original content with empty string or comment
    // Actually, we must remove it carefully to avoid messing up indices for next extraction
    // Better to just push to an array and remove them all at the end by slicing
    extracted.push(result);
  } else {
    console.warn(`Function ${fn} not found.`);
  }
}

// Sort extracted by startIndex descending so we can remove them safely
extracted.sort((a, b) => b.startIndex - a.startIndex);
for (const ex of extracted) {
  content = content.substring(0, ex.startIndex) + content.substring(ex.endIndex + 1);
}

// Ensure exports at the end of main.js
if (!content.includes('export {')) {
  content += `\n// Exported for lazy loaded modules\nexport { state, pageRoot, renderLoading, renderErrorState, wireRouteRetry, escapeHtml, formatDate, wireTableSearch };\n`;
}

fs.writeFileSync(mainFile, content);
fs.writeFileSync(adminFile, adminContent);
console.log('Admin code extracted successfully.');
