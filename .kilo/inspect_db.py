import sqlite3, os, sys

path = os.path.join("resources", "sermons.db")
if not os.path.exists(path):
    print("missing")
    sys.exit(0)

conn = sqlite3.connect(path)
cur = conn.cursor()

print("--- tables ---")
for r in cur.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','virtual table') ORDER BY name").fetchall():
    print(r)

print("--- triggers ---")
for r in cur.execute("SELECT name, tbl_name, sql FROM sqlite_trigger").fetchall():
    print(r)

print("--- indexes with sql ---")
for r in cur.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").fetchall():
    print(r)

print("--- row counts ---")
for t in ["sermons"]:
    n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(t, n)

conn.close()
