import sqlite3
import os

db_path = r'c:\Users\mahmoud.abdelnaby\Downloads\CnxMarketplace1\Analytics AI Tool\Analytics AI Tool\Analytics AI Tool\innovation-hub\apps\api\hub.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

def add_column(table, col_name, col_type, default_val=''):
    try:
        if isinstance(default_val, str):
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT '{default_val}'")
        else:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")
        print(f'Added {col_name} to {table}')
    except sqlite3.OperationalError as e:
        print(f'Skip {col_name} on {table}: {e}')

add_column('tool', 'department', 'VARCHAR', '')
add_column('tool', 'idea_id', 'INTEGER', 'NULL')

add_column('idea', 'voc_id', 'INTEGER', 'NULL')
add_column('idea', 'team', 'VARCHAR', '')
add_column('idea', 'tool_id', 'INTEGER', 'NULL')

try:
    c.execute('''
    CREATE TABLE vocissue (
        id INTEGER NOT NULL PRIMARY KEY,
        owner_id INTEGER NOT NULL,
        owner_name VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        problem_statement VARCHAR NOT NULL,
        department VARCHAR NOT NULL,
        votes INTEGER NOT NULL,
        voters JSON,
        status VARCHAR NOT NULL,
        created_at FLOAT NOT NULL
    )
    ''')
    print('Created vocissue table')
except sqlite3.OperationalError as e:
    print(f'Skip creating vocissue: {e}')

conn.commit()
conn.close()
