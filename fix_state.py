import re
import os

with open('src/main.js', 'r') as f:
    content = f.read()

# 1. Remove colorThemes and state definition
content = re.sub(r'const colorThemes = \[.*?\];', '', content, flags=re.DOTALL)
content = re.sub(r"const storedColorTheme = localStorage\.getItem\('lms:colorTheme'\);", '', content)
content = re.sub(r'const state = \{.*?\n\};', '', content, flags=re.DOTALL)

# 2. Remove isManager, isAdmin
content = re.sub(r'function isManager\(\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'function isAdmin\(\) \{.*?\}', '', content, flags=re.DOTALL)

# 3. Replace pageRoot with storePageRoot
content = re.sub(r'function pageRoot\(\) \{.*?\}', 'function pageRoot() { return storePageRoot(); }', content, flags=re.DOTALL)

with open('src/main.js', 'w') as f:
    f.write(content)

print("Fixed main.js state!")
