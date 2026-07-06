import sqlite3
import os

db_path = r'c:\Users\mahmoud.abdelnaby\Downloads\CnxMarketplace1\Analytics AI Tool\Analytics AI Tool\Analytics AI Tool\innovation-hub\apps\api\hub.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()
try:
    c.execute("ALTER TABLE tool ADD COLUMN review_history JSON DEFAULT '[]'")
    print('Added review_history to tool')
except Exception as e:
    print(e)

try:
    c.execute("ALTER TABLE idea ADD COLUMN review_history JSON DEFAULT '[]'")
    print('Added review_history to idea')
except Exception as e:
    print(e)
conn.commit()
conn.close()
