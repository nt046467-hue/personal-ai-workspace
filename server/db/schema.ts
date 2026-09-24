export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'Product Engineer',
  token_version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferences TEXT DEFAULT '{}',
  theme TEXT DEFAULT 'dark',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Folders
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in_review', 'planning', 'completed')),
  color TEXT DEFAULT '#38bdf8',
  category TEXT DEFAULT 'Engineering',
  deadline TEXT,
  progress INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date TEXT,
  due_category TEXT DEFAULT 'today' CHECK (due_category IN ('today', 'tomorrow', 'upcoming', 'completed')),
  estimated_minutes INTEGER DEFAULT 30,
  completed INTEGER DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Items (Notes, Specs, Research, Code)
CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  type TEXT DEFAULT 'note' CHECK (type IN ('note', 'document', 'research', 'code')),
  source_url TEXT,
  summary TEXT,
  pinned INTEGER DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata TEXT DEFAULT '{}',
  last_viewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents (Uploaded Files, PDFs, DOCX, etc.)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  knowledge_item_id TEXT REFERENCES knowledge_items(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  page_count INTEGER DEFAULT 1,
  extracted_text TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  summary TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks for Semantic Search & RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT, -- JSON array of floats
  token_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  favicon TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources TEXT, -- JSON array of { id, title, type }
  actions TEXT, -- JSON array of { label, action, targetId }
  metadata TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

-- Item Tags
CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  PRIMARY KEY (item_id, tag_id)
);

-- Relationships (Graph connections between projects, notes, docs, tasks)
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'references',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activities / Workspace Audit Log
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'document', 'project', 'ai', 'note')),
  target_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspace Memory
CREATE TABLE IF NOT EXISTS workspace_memories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Security Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_workspace ON tasks(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(workspace_id, completed, due_category);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_user_workspace ON knowledge_items(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(workspace_id, type);
CREATE INDEX IF NOT EXISTS idx_documents_user_workspace ON documents(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_workspace ON projects(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id, created_at DESC);

-- Full-Text Search (FTS5) for Grounded Retrieval & Fast Workspace Search
CREATE VIRTUAL TABLE IF NOT EXISTS workspace_fts USING fts5(
  workspace_id UNINDEXED,
  item_id UNINDEXED,
  item_type UNINDEXED,
  title,
  content,
  tokenize = 'porter unicode61'
);

-- Dedicated knowledge FTS for high-accuracy RAG retrieval
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  workspace_id UNINDEXED,
  title,
  content,
  content=knowledge_items,
  content_rowid=rowid,
  tokenize = 'porter unicode61'
);

-- FTS5 triggers: keep workspace_fts in sync with knowledge_items
CREATE TRIGGER IF NOT EXISTS trg_knowledge_fts_insert
AFTER INSERT ON knowledge_items BEGIN
  INSERT INTO workspace_fts(workspace_id, item_id, item_type, title, content)
  VALUES (new.workspace_id, new.id, new.type, new.title, COALESCE(new.content, ''));
  INSERT INTO knowledge_fts(workspace_id, title, content)
  VALUES (new.workspace_id, new.title, COALESCE(new.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_fts_update
AFTER UPDATE ON knowledge_items BEGIN
  DELETE FROM workspace_fts WHERE item_id = old.id;
  INSERT INTO workspace_fts(workspace_id, item_id, item_type, title, content)
  VALUES (new.workspace_id, new.id, new.type, new.title, COALESCE(new.content, ''));
  INSERT INTO knowledge_fts(knowledge_fts, rowid, workspace_id, title, content)
  VALUES ('delete', old.rowid, old.workspace_id, old.title, COALESCE(old.content, ''));
  INSERT INTO knowledge_fts(rowid, workspace_id, title, content)
  VALUES (new.rowid, new.workspace_id, new.title, COALESCE(new.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_fts_delete
AFTER DELETE ON knowledge_items BEGIN
  DELETE FROM workspace_fts WHERE item_id = old.id;
  INSERT INTO knowledge_fts(knowledge_fts, rowid, workspace_id, title, content)
  VALUES ('delete', old.rowid, old.workspace_id, old.title, COALESCE(old.content, ''));
END;
`;
