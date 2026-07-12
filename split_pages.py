import re

with open('src/main.js', 'r') as f:
    content = f.read()

# EXTRACT Settings
settings_pattern = re.compile(r'(function mountSettings\(\) \{.*?\n\})', re.DOTALL)
settings_match = settings_pattern.search(content)
if settings_match:
    settings_code = settings_match.group(1)
    content = content[:settings_match.start()] + content[settings_match.end():]
    
    with open('src/pages/Settings.js', 'w') as f:
        f.write("import { state, colorThemes } from '../store.js';\n")
        f.write("import { pageRoot } from '../main.js';\n")
        f.write("import { escapeHtml, setButtonLoading } from '../lib/html.js';\n")
        f.write("import { renderAccountAvatar, render, toast, setThemeMode, setColorTheme } from '../main.js';\n")
        f.write("import { updateProfileAvatar, removeProfileAvatar, updateProfileName } from '../services/lmsApi.js';\n\n")
        f.write(settings_code.replace('function mountSettings()', 'export function mountSettings()'))

# EXTRACT Countdown
countdown_pattern = re.compile(r'(function mountCountdown\(\) \{.*?\n\})', re.DOTALL)
countdown_match = countdown_pattern.search(content)
if countdown_match:
    countdown_code = countdown_match.group(1)
    content = content[:countdown_match.start()] + content[countdown_match.end():]
    
    with open('src/pages/Countdown.js', 'w') as f:
        f.write("import { pageRoot, daysUntilExam } from '../main.js';\n")
        f.write("import { escapeHtml } from '../lib/html.js';\n\n")
        f.write(countdown_code.replace('function mountCountdown()', 'export function mountCountdown()'))

with open('src/main.js', 'w') as f:
    f.write(content)
