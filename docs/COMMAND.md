sqlite3 reddit.db "SELECT company, type, COUNT(*) FROM posts WHERE about_checked=1 GROUP BY company, type;"


tail -f /tmp/mercuric-server.log