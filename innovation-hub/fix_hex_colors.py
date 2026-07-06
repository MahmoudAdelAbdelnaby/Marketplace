import os, glob

replacements = {
    "color: '#b45309'": "color: 'var(--warning-text)'",
    "color: '#15803D'": "color: 'var(--success-text)'",
    "color: '#00897b'": "color: 'var(--success-text)'",
}

for path in glob.glob('apps/web/src/components/**/*.jsx', recursive=True):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated', path)
