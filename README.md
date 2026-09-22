# MySpace AI — Calm, Intelligent Personal Workspace

MySpace AI is a modern, privacy-first personal workspace combining task management, knowledge notes, multi-document research, and grounded semantic AI intelligence.

Built with **React 19 + Vite** on the frontend, and a serverless **Node / Express** architecture backed by **Turso (libSQL)** and **Vercel Blob** storage.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
```env
TURSO_DATABASE_URL=      # e.g. libsql://your-db.turso.io (or leave empty for local file storage in dev)
TURSO_AUTH_TOKEN=         # Turso database authentication token
BLOB_READ_WRITE_TOKEN=    # Vercel Blob store token
JWT_SECRET=               # Random secret (≥ 32 characters in production)
APP_ENCRYPTION_KEY=       # 32-byte key
APP_ORIGIN=               # e.g. http://localhost:5173 or https://your-app.vercel.app
AI_PROVIDER=              # openai | gemini | groq | ollama (optional)
AI_API_KEY=               # API key for the AI provider
AI_MODEL=                 # e.g. gpt-4o-mini
AI_BASE_URL=              # Optional custom base URL
SEED_DEMO=false           # Set to true only for local dev demo fixtures
```

### 3. Database Migrations
Apply schema and FTS5 migrations to your database:
```bash
npm run db:migrate
```
*Note: In local development, if `TURSO_DATABASE_URL` is omitted, the system will automatically use a local SQLite file at `./storage/myspace.sqlite`.*

### 4. Run Development Servers
- **Option 1: Standard local dev (fast iteration)**
  ```bash
  npm run dev
  ```
  Runs the backend at `http://localhost:3001` and Vite frontend at `http://localhost:5173`.

- **Option 2: Vercel CLI (production-accurate)**
  ```bash
  vercel dev
  ```
  Emulates Vercel's serverless functions and routing locally.

---

## 🚀 Production Deployment (Primary Target: Vercel)

### 1. Create Projects on Vercel & Turso
1. **Turso**:
   - Create a database: `turso db create myspace-db`
   - Retrieve URL: `turso db show myspace-db --url`
   - Create token: `turso db tokens create myspace-db`
2. **Vercel Blob**:
   - In your Vercel Dashboard, go to **Storage** → **Create Database** → **Blob**.
   - Copy the generated `BLOB_READ_WRITE_TOKEN`.

### 2. Configure Vercel Environment Variables
In **Project Settings → Environment Variables**, add the following for both **Production** and **Preview**:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `JWT_SECRET` (Must be at least 32 characters; production boot fails if missing)
- `APP_ENCRYPTION_KEY`
- `APP_ORIGIN` (Your Vercel deployment URL, e.g. `https://myspace-ai.vercel.app`)
- `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` (Optional — falls back to Search Mode if unset)
- `SEED_DEMO=false`
- `VITE_SHOW_DEMO_LOGIN=false` (Must stay unset or 'false' in production so the demo shortcut is never exposed)

### 3. Deploy
Vercel will execute the `vercel-build` script (`npm run db:migrate && vite build`), applying any unapplied migrations before bundling the client into `dist`. Serverless API handlers under `api/` automatically serve all `/api/*` endpoints.

---

## 💾 Database Backups & Branching (Turso)

Turso manages replication, backups, and point-in-time recovery automatically:
- **Export a full database dump**:
  ```bash
  turso db shell myspace-db .dump > backup.sql
  ```
- **Fork or create a database from a source snapshot**:
  ```bash
  turso db create myspace-db-clone --from-db myspace-db
  ```

---

## 🐳 Alternative Deployments (Docker & Render)

The repository retains support for containerized and monolithic deployments:

- **Docker Container**:
  ```bash
  docker build -t myspace-ai .
  docker run -d -p 3001:3001 -v myspace_data:/app/storage -e NODE_ENV=production myspace-ai
  ```
- **Render.com Blueprint**:
  Use the included [`render.yaml`](./render.yaml) with a persistent disk.

---

## 🧪 Testing & Quality Checks

- **Run Security & Multi-Tenant Test Suite:**
  ```bash
  npm test
  ```
- **Run Fast Linter:**
  ```bash
  npm run lint
  ```
- **Build Client Bundle for Production:**
  ```bash
  npm run build
  ```

---

## 📁 Architecture

```
├── api/                  # Vercel serverless function entrypoints (api/[[...path]].ts)
├── server/               # Express core application & business logic
│   ├── ai/               # OpenAICompatibleProvider & RAG pipeline
│   ├── auth/             # JWT & HttpOnly session cookie utilities
│   ├── db/               # Turso libSQL client, ownership checks, migrations
│   │   └── migrations/   # Numbered SQL migrations (001_initial.sql, 002_fts.sql)
│   ├── pipeline/         # Document extraction (PDF, DOCX) and text chunking
│   ├── routes/           # Express routers (auth, tasks, notes, search, ai, etc.)
│   ├── search/           # BM25 full-text search with SQLite FTS5
│   ├── storage/          # Vercel Blob file management with local fallback
│   └── tests/            # Automated security & multi-tenant isolation tests
├── src/                  # React 19 Frontend
│   ├── components/       # UI components & AppShell (Desktop & Mobile)
│   ├── services/         # API & SSE streaming client with CSRF double-submit
│   └── views/            # Workspace views (Home, Knowledge, Tasks, AI, Projects)
└── vercel.json           # Vercel deployment and routing configuration
```