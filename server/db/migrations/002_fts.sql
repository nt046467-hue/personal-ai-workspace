-- Drop legacy triggers and virtual tables if they exist with older schema
DROP TRIGGER IF EXISTS trg_knowledge_fts_insert;
DROP TRIGGER IF EXISTS trg_knowledge_fts_update;
DROP TRIGGER IF EXISTS trg_knowledge_fts_delete;
DROP TRIGGER IF EXISTS trg_ki_fts_insert;
DROP TRIGGER IF EXISTS trg_ki_fts_update;
DROP TRIGGER IF EXISTS trg_ki_fts_delete;
DROP TRIGGER IF EXISTS trg_dc_fts_insert;
DROP TRIGGER IF EXISTS trg_dc_fts_update;
DROP TRIGGER IF EXISTS trg_dc_fts_delete;
DROP TRIGGER IF EXISTS trg_tasks_fts_insert;
DROP TRIGGER IF EXISTS trg_tasks_fts_update;
DROP TRIGGER IF EXISTS trg_tasks_fts_delete;

DROP TABLE IF EXISTS knowledge_fts;
DROP TABLE IF EXISTS chunks_fts;
DROP TABLE IF EXISTS tasks_fts;
DROP TABLE IF EXISTS workspace_fts;

-- FTS5 Virtual Table for Knowledge Items
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  workspace_id UNINDEXED,
  item_id UNINDEXED,
  title,
  content,
  tokenize = 'porter unicode61'
);

-- FTS5 Virtual Table for Document Chunks
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  workspace_id UNINDEXED,
  chunk_id UNINDEXED,
  document_id UNINDEXED,
  content,
  tokenize = 'porter unicode61'
);

-- FTS5 Virtual Table for Tasks
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  workspace_id UNINDEXED,
  task_id UNINDEXED,
  title,
  notes,
  tokenize = 'porter unicode61'
);

-- General Workspace FTS for unified search
CREATE VIRTUAL TABLE IF NOT EXISTS workspace_fts USING fts5(
  workspace_id UNINDEXED,
  item_id UNINDEXED,
  item_type UNINDEXED,
  title,
  content,
  tokenize = 'porter unicode61'
);

-- Triggers for knowledge_items
CREATE TRIGGER IF NOT EXISTS trg_ki_fts_insert AFTER INSERT ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(workspace_id, item_id, title, content)
  VALUES (new.workspace_id, new.id, new.title, COALESCE(new.content, ''));
  INSERT INTO workspace_fts(workspace_id, item_id, item_type, title, content)
  VALUES (new.workspace_id, new.id, new.type, new.title, COALESCE(new.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_ki_fts_update AFTER UPDATE ON knowledge_items BEGIN
  DELETE FROM knowledge_fts WHERE item_id = old.id;
  DELETE FROM workspace_fts WHERE item_id = old.id;
  INSERT INTO knowledge_fts(workspace_id, item_id, title, content)
  VALUES (new.workspace_id, new.id, new.title, COALESCE(new.content, ''));
  INSERT INTO workspace_fts(workspace_id, item_id, item_type, title, content)
  VALUES (new.workspace_id, new.id, new.type, new.title, COALESCE(new.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_ki_fts_delete AFTER DELETE ON knowledge_items BEGIN
  DELETE FROM knowledge_fts WHERE item_id = old.id;
  DELETE FROM workspace_fts WHERE item_id = old.id;
END;

-- Triggers for document_chunks
CREATE TRIGGER IF NOT EXISTS trg_dc_fts_insert AFTER INSERT ON document_chunks BEGIN
  INSERT INTO chunks_fts(workspace_id, chunk_id, document_id, content)
  VALUES (new.workspace_id, new.id, new.document_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_dc_fts_update AFTER UPDATE ON document_chunks BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = old.id;
  INSERT INTO chunks_fts(workspace_id, chunk_id, document_id, content)
  VALUES (new.workspace_id, new.id, new.document_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_dc_fts_delete AFTER DELETE ON document_chunks BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = old.id;
END;

-- Triggers for tasks
CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_insert AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(workspace_id, task_id, title, notes)
  VALUES (new.workspace_id, new.id, new.title, COALESCE(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_update AFTER UPDATE ON tasks BEGIN
  DELETE FROM tasks_fts WHERE task_id = old.id;
  INSERT INTO tasks_fts(workspace_id, task_id, title, notes)
  VALUES (new.workspace_id, new.id, new.title, COALESCE(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_delete AFTER DELETE ON tasks BEGIN
  DELETE FROM tasks_fts WHERE task_id = old.id;
END;
