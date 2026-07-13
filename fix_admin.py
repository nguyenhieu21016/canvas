import re

with open('src/admin.js', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import { normalizeAssignmentEditor, normalizeEditorQuestion } from './lib/assignment.js';\n"
content = import_stmt + content

# Remove functions
content = re.sub(r'export function normalizeEditorQuestion\(raw\) \{.*?\n\}\n*', '', content, flags=re.DOTALL)
content = re.sub(r'export function normalizeAssignmentEditor\(editor\) \{.*?\n\}\n*', '', content, flags=re.DOTALL)

with open('src/admin.js', 'w') as f:
    f.write(content)

print("Fixed admin.js!")
