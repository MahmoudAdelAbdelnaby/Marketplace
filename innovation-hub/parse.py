import re
import json

with open('concentrix.html', 'r', encoding='utf-16') as f:
    html = f.read()

urls = re.findall(r'https?://[^\s"\'\>]+?(?:\.svg|\.mp4|\.jpg|\.png|\.webp)', html)
bg_urls = re.findall(r'url\([^\)]+\)', html)

interesting = set()
for u in set(urls):
    u_lower = u.lower()
    if 'wave' in u_lower or 'bg' in u_lower or 'background' in u_lower or 'hero' in u_lower or 'abstract' in u_lower or 'gradient' in u_lower:
        interesting.add(u)

print("Interesting URLs:")
for u in interesting:
    print(u)
