-- Glorian System: Embedded SQLite Schema with FTS5 and Vector BLOB Storage
-- Conforms to SPEC-287 / CHANGE-149

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  vector BLOB,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- FTS5 Full-Text Search Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  category,
  content='documents',
  content_rowid='rowid'
);

-- Triggers for FTS5 synchronization
CREATE TRIGGER IF NOT EXISTS trg_documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, id, title, content, category)
  VALUES (new.rowid, new.id, new.title, new.content, new.category);
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, id, title, content, category)
  VALUES ('delete', old.rowid, old.id, old.title, old.content, old.category);
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, id, title, content, category)
  VALUES ('delete', old.rowid, old.id, old.title, old.content, old.category);
  INSERT INTO documents_fts(rowid, id, title, content, category)
  VALUES (new.rowid, new.id, new.title, new.content, new.category);
END;
