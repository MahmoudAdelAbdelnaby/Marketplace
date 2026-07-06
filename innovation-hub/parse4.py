import re
with open('concentrix.html', 'r', encoding='utf-16') as f:
    html = f.read()

for match in re.finditer(r'.{0,40}mp4.{0,40}', html, re.IGNORECASE):
    print("MP4:", match.group(0))

for match in re.finditer(r'.{0,40}canvas.{0,40}', html, re.IGNORECASE):
    print("CANVAS:", match.group(0))
