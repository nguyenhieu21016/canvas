import re
import os

def get_defined_functions(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    # Find all function definitions
    funcs = re.findall(r'function\s+([a-zA-Z0-9_]+)\s*\(', content)
    # Find all top-level variables (let, const, var)
    vars = re.findall(r'(?:let|const|var)\s+([a-zA-Z0-9_]+)\s*=', content)
    # Find all imports
    imports = re.findall(r'import\s+{([^}]+)}\s+from', content)
    imported_names = []
    for imp in imports:
        for name in imp.split(','):
            name = name.strip()
            if name:
                imported_names.append(name.split(' as ')[0].strip())
    
    return set(funcs + vars + imported_names)

def check_file(filepath, global_funcs):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Strip comments and strings to avoid false positives
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r"'(?:\\'|[^'])*'", "''", content)
    content = re.sub(r'"(?:\\"|[^"])*"', '""', content)
    content = re.sub(r'`(?:\\`|[^`])*`', '``', content)

    # Find all function calls
    calls = re.findall(r'\b([a-zA-Z0-9_]+)\s*\(', content)
    
    defined = get_defined_functions(filepath)
    # Built-in JS functions/objects
    builtins = {'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'alert', 'prompt', 'confirm', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'String', 'Number', 'Boolean', 'Object', 'Array', 'Math', 'Date', 'RegExp', 'Error', 'Promise', 'Map', 'Set', 'JSON', 'document', 'window', 'import', 'require', 'Event', 'CustomEvent', 'FormData', 'URLSearchParams', 'URL', 'Blob', 'File', 'FileReader', 'crypto', 'btoa', 'atob', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'matchMedia', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'MutationObserver', 'ResizeObserver', 'AbortController', 'Headers', 'Request', 'Response', 'TextEncoder', 'TextDecoder'}
    
    # Common DOM methods (false positives if called on objects)
    dom_methods = {'getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'appendChild', 'removeChild', 'addEventListener', 'removeEventListener', 'getAttribute', 'setAttribute', 'removeAttribute', 'classList', 'focus', 'blur', 'click', 'submit', 'reset', 'preventDefault', 'stopPropagation', 'some', 'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'includes', 'join', 'split', 'replace', 'match', 'test', 'exec', 'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'sort', 'reverse', 'concat', 'indexOf', 'lastIndexOf', 'keys', 'values', 'entries', 'from', 'isArray', 'of', 'assign', 'create', 'defineProperty', 'defineProperties', 'freeze', 'seal', 'preventExtensions', 'isExtensible', 'isSealed', 'isFrozen', 'getPrototypeOf', 'setPrototypeOf', 'is', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toString', 'toLocaleString', 'valueOf', 'trim', 'toLowerCase', 'toUpperCase', 'substring', 'substr', 'charAt', 'charCodeAt', 'padEnd', 'padStart', 'repeat', 'startsWith', 'endsWith'}
    
    missing = []
    for call in set(calls):
        if call not in defined and call not in builtins and call not in dom_methods and call in global_funcs:
            missing.append(call)
            
    return missing

# Get all global functions from main.js and lib/html.js
global_funcs = get_defined_functions('src/main.js') | get_defined_functions('src/lib/html.js') | get_defined_functions('src/lib/format.js')

print("Missing in admin.js:", check_file('src/admin.js', global_funcs))
print("Missing in student.js:", check_file('src/student.js', global_funcs))

