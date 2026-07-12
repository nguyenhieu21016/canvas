import re

with open('src/main.js', 'r') as f:
    content = f.read()

# Extract renderAuth
auth_pattern = re.compile(r'(function renderAuth\(\) \{.*?\n\})', re.DOTALL)
auth_match = auth_pattern.search(content)

if auth_match:
    auth_code = auth_match.group(1)
    # Remove from main
    content = content[:auth_match.start()] + '\n' + content[auth_match.end():]
    
    with open('src/pages/Auth.js', 'w') as f:
        f.write("import { state, isManager, pageRoot, toast, wireMaterialFormButtons, render } from '../main.js';\n")
        f.write("import { hasSupabaseConfig } from '../services/supabaseClient.js';\n")
        f.write("import { setButtonLoading } from '../lib/html.js';\n")
        f.write("import { requestPasswordReset, updateCurrentUserPassword, getCurrentProfile, getSession, signIn, signUpStudent } from '../services/lmsApi.js';\n\n")
        f.write(auth_code.replace("app.innerHTML", "document.querySelector('#app').innerHTML"))
        f.write("\nexport { renderAuth };\n")
    print("Extracted renderAuth")

with open('src/main.js', 'w') as f:
    f.write(content)
