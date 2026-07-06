import re
with open('concentrix.html', 'r', encoding='utf-16') as f:
    html = f.read()
urls = re.findall(r'https?://[^\s"\'\>]+?(?:\.mp4|\.webm)', html)
for u in set(urls):
    print(u)
