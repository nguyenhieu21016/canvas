const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, 'src', 'main.js');
let mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

// We will just do the Router integration first since that is easier to script.
// For splitting files, we will extract the exact string of renderAuth and put it in auth.js.

function extractFunction(content, funcName) {
    const regex = new RegExp(`(async )?function ${funcName}\\s*\\([^{]*\\)\\s*\\{`);
    const match = content.match(regex);
    if (!match) return null;
    
    let startIndex = match.index;
    let braceCount = 0;
    let endIndex = startIndex;
    let started = false;
    
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            started = true;
        } else if (content[i] === '}') {
            braceCount--;
        }
        
        if (started && braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }
    
    return {
        code: content.slice(startIndex, endIndex),
        startIndex,
        endIndex
    };
}

// Extract auth
const renderAuthData = extractFunction(mainJsContent, 'renderAuth');
if (renderAuthData) {
    fs.writeFileSync(path.join(__dirname, 'src', 'pages', 'Auth.js'), `
import { state, toast, render, wireMaterialFormButtons } from '../main.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { requestPasswordReset, updateCurrentUserPassword, getCurrentProfile, getSession, signIn, signUpStudent } from '../services/lmsApi.js';
import { setButtonLoading } from '../lib/html.js';

${renderAuthData.code.replace(/app\.innerHTML/g, 'document.querySelector("#app").innerHTML')}

export { renderAuth };
    `.trim());
    
    // Replace in main.js
    mainJsContent = mainJsContent.slice(0, renderAuthData.startIndex) + '\n/* extracted renderAuth */\n' + mainJsContent.slice(renderAuthData.endIndex);
    // Add import
    mainJsContent = `import { renderAuth } from './pages/Auth.js';\n` + mainJsContent;
    fs.writeFileSync(mainJsPath, mainJsContent, 'utf8');
    console.log('Extracted renderAuth');
}

