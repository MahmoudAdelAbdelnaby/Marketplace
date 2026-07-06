import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "hub.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

try:
    c.execute("ALTER TABLE vocissue ADD COLUMN client VARCHAR DEFAULT ''")
    print('Added client to vocissue')
except Exception as e:
    print(e)

try:
    c.execute("ALTER TABLE tool ADD COLUMN achieved_through VARCHAR DEFAULT ''")
    print('Added achieved_through to tool')
except Exception as e:
    print(e)

conn.commit()
conn.close()
