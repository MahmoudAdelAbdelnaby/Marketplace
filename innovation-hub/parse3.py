import re
with open('concentrix.html', 'r', encoding='utf-16') as f:
    html = f.read()
canvas_tags = re.findall(r'<canvas[^>]*>', html)
for t in canvas_tags:
    print(t)
