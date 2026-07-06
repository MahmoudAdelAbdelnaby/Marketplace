import os, glob

for path in glob.glob('apps/web/src/components/**/*.jsx', recursive=True):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace inline style usage
    new_content = content.replace("color: 'var(--primary)'", "color: 'var(--primary-text)'")
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated', path)
