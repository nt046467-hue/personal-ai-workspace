import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { SCHEMA_SQL } from './schema';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  // Ensure storage directory exists
  if (!fs.existsSync(config.storageDir)) {
    fs.mkdirSync(config.storageDir, { recursive: true });
  }

  const db = new DatabaseSync(config.dbPath);
  dbInstance = db;

  // Initialize schema
  db.exec(SCHEMA_SQL);

  // Seed default workspace and user if empty
  seedDatabaseIfEmpty(db);

  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function seedDatabaseIfEmpty(db: DatabaseSync) {
  const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existingUser) return;

  console.log('[DB] Seeding initial production data for Nabin Thapa...');

  const userId = 'u-nabin';
  const workspaceId = 'w-nabin-eng';
  const hashedPassword = bcrypt.hashSync('password123', 10);

  // 1. User & Profile
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, avatar_url, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    'nabin@workspace.ai',
    hashedPassword,
    'Nabin Thapa',
    'NT',
    'Product Engineer'
  );

  db.prepare(`
    INSERT INTO profiles (user_id, display_name, avatar_url, timezone, theme)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, 'Nabin Thapa', 'NT', 'Asia/Kathmandu', 'dark');

  // 2. Workspace
  db.prepare(`
    INSERT INTO workspaces (id, user_id, name, description)
    VALUES (?, ?, ?, ?)
  `).run(workspaceId, userId, 'Engineering & Strategy', 'Core engineering, system architecture, and AI models');

  // 3. Projects
  const projects = [
    {
      id: 'p-1',
      name: 'Personal AI Workspace',
      description: 'Zero-latency personal knowledge engine, local vector index, and cross-platform desktop & mobile client.',
      status: 'active',
      color: '#38bdf8',
      category: 'Engineering',
      deadline: 'Oct 15, 2026',
      progress: 68,
    },
    {
      id: 'p-2',
      name: 'Cloud Infrastructure Audit',
      description: 'Per-tenant IAM isolation, database security rules review, and compliance verification across distributed clusters.',
      status: 'active',
      color: '#818cf8',
      category: 'DevOps',
      deadline: 'Oct 04, 2026',
      progress: 42,
    },
    {
      id: 'p-3',
      name: 'Q3 Product Strategy',
      description: 'Roadmap planning, user research synthesis, and executive deliverables for quarterly strategy review.',
      status: 'in_review',
      color: '#fbbf24',
      category: 'Product',
      deadline: 'Oct 28, 2026',
      progress: 85,
    },
    {
      id: 'p-4',
      name: 'Design System v2',
      description: 'Refined dark/light surface elevation, iOS 18 Safari touch hit target audits, and mobile micro-interactions.',
      status: 'planning',
      color: '#34d399',
      category: 'Design',
      deadline: 'Nov 12, 2026',
      progress: 25,
    },
  ];

  for (const p of projects) {
    db.prepare(`
      INSERT INTO projects (id, workspace_id, user_id, name, description, status, color, category, deadline, progress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(p.id, workspaceId, userId, p.name, p.description, p.status, p.color, p.category, p.deadline, p.progress);
  }

  // 4. Tasks
  const tasks = [
    {
      id: 't-1',
      title: 'Audit Firestore security rules for per-user tenant isolation',
      projectId: 'p-2',
      dueDate: 'Today, 5:00 PM',
      dueCategory: 'today',
      priority: 'high',
      completed: 0,
      notes: 'Verify request.auth.uid matches resource.data.ownerId on all subcollections. Ensure read/write quotas.',
      estimatedMinutes: 45,
    },
    {
      id: 't-2',
      title: 'Verify mobile touch targets and bottom sheet gestures (iOS Safari)',
      projectId: 'p-4',
      dueDate: 'Today, 7:30 PM',
      dueCategory: 'today',
      priority: 'high',
      completed: 0,
      notes: 'Confirm 44px hit target on all icon buttons and verify pull-to-dismiss threshold.',
      estimatedMinutes: 30,
    },
    {
      id: 't-3',
      title: 'Review Stripe webhook retry exponential backoff semantics',
      projectId: 'p-1',
      dueDate: 'Today, 9:00 PM',
      dueCategory: 'today',
      priority: 'medium',
      completed: 0,
      notes: 'Handle duplicate invoice.payment_succeeded events with Redis idempotency key lock.',
      estimatedMinutes: 60,
    },
    {
      id: 't-4',
      title: 'Finalize offline sync conflict resolution strategy (LWW vs CRDT)',
      projectId: 'p-2',
      dueDate: 'Tomorrow',
      dueCategory: 'tomorrow',
      priority: 'medium',
      completed: 0,
      notes: 'Draft benchmark comparison between SQLite client-side delta sync and CouchDB.',
      estimatedMinutes: 90,
    },
    {
      id: 't-5',
      title: 'Draft engineering brief for vector embeddings chunking & indexing',
      projectId: 'p-1',
      dueDate: 'In 2 days',
      dueCategory: 'upcoming',
      priority: 'low',
      completed: 0,
      notes: 'Evaluate recursive character splitter at 512 tokens with 64 token overlap.',
      estimatedMinutes: 45,
    },
    {
      id: 't-6',
      title: 'Benchmark LLM streaming latency over WebSocket vs SSE',
      projectId: 'p-1',
      dueDate: 'Sep 18',
      dueCategory: 'completed',
      priority: 'low',
      completed: 1,
      notes: 'SSE showed 14% lower CPU overhead on mobile browsers with native fetch ReadableStream.',
      estimatedMinutes: 40,
    },
  ];

  for (const t of tasks) {
    db.prepare(`
      INSERT INTO tasks (id, workspace_id, user_id, project_id, title, notes, status, priority, due_date, due_category, estimated_minutes, completed, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t.id,
      workspaceId,
      userId,
      t.projectId,
      t.title,
      t.notes,
      t.completed ? 'completed' : 'todo',
      t.priority,
      t.dueDate,
      t.dueCategory,
      t.estimatedMinutes,
      t.completed,
      t.completed ? new Date().toISOString() : null
    );
  }

  // 5. Knowledge Items (Notes & Specs)
  const knowledgeItems = [
    {
      id: 'k-1',
      title: 'Firebase Security Architecture & Multi-Tenant Rules',
      type: 'note',
      excerpt: 'Detailed specification of database security rules, role-based authorization tokens, and partition schemas for tenant workspaces.',
      tags: ['Security', 'Backend', 'Firebase'],
      readTime: '6 min read',
      pinned: 1,
      content: `# Firebase Security Architecture & Multi-Tenant Rules

## Overview
This document specifies the authorization invariants for client-direct database reads and writes. Every tenant workspace is isolated via custom claims attached to the user's Firebase Authentication JWT.

### Key Invariants:
1. **Tenant Isolation**: Direct queries must include \`where("tenantId", "==", request.auth.token.tenantId)\`.
2. **Owner Write Rules**: Modifications require matching \`request.auth.uid == resource.data.authorId\` or admin membership.
3. **Audit Immutability**: Appending to \`audit_logs\` subcollections is write-once; updates and deletes are rejected at the rule engine level.

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function belongsToTenant(tenantId) {
      return request.auth.token.tenantId == tenantId;
    }
    
    match /workspaces/{workspaceId}/{document=**} {
      allow read, write: if belongsToTenant(workspaceId);
    }
  }
}
\`\`\`

## Testing & Verification
- Unit test suite runs with \`@firebase/rules-unit-testing\` in isolated emulator container.
- Rate limits enforced by edge Cloud Armor gateway (max 100 req/sec per origin IP).
`,
    },
    {
      id: 'k-2',
      title: 'Distributed Event-Driven Architecture Spec.pdf',
      type: 'document',
      excerpt: 'Architecture decision record (ADR-042) covering partition key hashing, dead-letter queues, and end-to-end delivery SLAs.',
      tags: ['Architecture', 'Distributed Systems', 'Spec'],
      readTime: '12 min read',
      pinned: true,
      fileSize: '2.4 MB',
      pageCount: 18,
      content: `# Distributed Event-Driven Architecture Spec
**Author**: Nabin Thapa  
**Status**: APPROVED  
**Target Delivery SLA**: p95 delivery latency < 45ms across multi-region edge brokers.

## Section 1: Ingress Gateway
The ingress gateway accepts batch payloads via HTTP/3 and WebSockets. Idempotency tokens are validated in an edge Redis memory tier before committing events to the primary cluster queue.

## Section 2: DLQ & Poison Pill Policy
Failed events are retried up to 5 times with exponential backoff and jitter. If persistent serialization or deserialization failures occur, the message payload is safely dispatched to a dead-letter quarantine bucket with complete trace headers for inspection.

## Section 3: Data Isolation & Partition Key Hashing
Partition keys are computed as \`sha256(tenant_id + ":" + entity_type)\`. This guarantees in-order event processing within an individual workspace while distributing workspace traffic evenly across worker shards.
`,
    },
    {
      id: 'k-3',
      title: 'Vector Search & Local Embeddings Benchmark',
      type: 'research',
      excerpt: 'Empirical comparison of cosine similarity indexing with chunk sizes of 256, 512, and 1024 tokens on mobile client engines.',
      tags: ['AI', 'Embeddings', 'Performance'],
      readTime: '8 min read',
      pinned: false,
      content: `# Vector Search & Local Embeddings Benchmark

## Objective
Evaluate local client vs server vector search latency, index size overhead, and retrieval precision across typical engineering documents.

## Findings
- **Chunk Size 512 tokens with 64 overlap** yielded the highest Mean Reciprocal Rank (MRR@5: 0.89) without bloating metadata memory footprint.
- **Quantization**: Int8 quantization reduced embedding memory usage by 74% with less than 0.8% loss in retrieval fidelity.
- **Latency**: SQLite vector cosine index queries completed in < 6ms for collections under 50,000 chunks.
`,
    },
    {
      id: 'k-4',
      title: 'Design System Elevation & HSL Tokens',
      type: 'code',
      excerpt: 'Complete CSS custom properties design token hierarchy for the Obsidian Dark and Clean Light themes.',
      tags: ['Frontend', 'CSS', 'Design System'],
      readTime: '4 min read',
      pinned: false,
      content: `:root[data-theme="dark"] {
  --bg-primary: #0a0c10;
  --bg-secondary: #12151c;
  --bg-tertiary: #1a1e28;
  --text-primary: #f0f3f8;
  --text-secondary: #94a3b8;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --accent-cyan: #38bdf8;
  --accent-glow: rgba(56, 189, 248, 0.15);
}
`,
    },
    {
      id: 'k-5',
      title: 'Stripe Webhook Idempotency & Edge Retry',
      type: 'note',
      excerpt: 'Implementation blueprint for distributed idempotency locks, replay attack mitigation, and automated subscription status sync.',
      tags: ['Payments', 'Stripe', 'Backend'],
      readTime: '5 min read',
      pinned: false,
      content: `# Stripe Webhook Idempotency & Edge Retry
Verify signature with \`stripe.webhooks.constructEvent\`. Lock event ID in Redis with 24-hour TTL before processing.
`,
    },
  ];

  for (const k of knowledgeItems) {
    db.prepare(`
      INSERT INTO knowledge_items (id, workspace_id, user_id, title, content, excerpt, type, pinned, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      k.id,
      workspaceId,
      userId,
      k.title,
      k.content,
      k.excerpt,
      k.type,
      k.pinned ? 1 : 0,
      JSON.stringify({ tags: k.tags, readTime: k.readTime, fileSize: (k as any).fileSize, pageCount: (k as any).pageCount })
    );

    // Tags
    for (const tagName of k.tags) {
      let tag = db.prepare('SELECT id FROM tags WHERE workspace_id = ? AND name = ?').get(workspaceId, tagName) as any;
      if (!tag) {
        const tagId = `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        db.prepare('INSERT INTO tags (id, workspace_id, user_id, name) VALUES (?, ?, ?, ?)').run(tagId, workspaceId, userId, tagName);
        tag = { id: tagId };
      }
      db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, item_type) VALUES (?, ?, ?)').run(k.id, tag.id, 'knowledge');
    }
  }

  // 6. Documents & Chunks
  const docId = 'k-2';
  db.prepare(`
    INSERT INTO documents (id, workspace_id, user_id, knowledge_item_id, filename, original_name, storage_path, mime_type, size, page_count, extracted_text, processing_status, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    docId,
    workspaceId,
    userId,
    docId,
    'distributed-architecture-spec.pdf',
    'Distributed Event-Driven Architecture Spec.pdf',
    'documents/distributed-architecture-spec.pdf',
    'application/pdf',
    2516582,
    18,
    knowledgeItems[1].content,
    'ready',
    'Architecture decision record ADR-042 detailing end-to-end delivery SLAs, dead letter queue retry semantics, and tenant isolation key partitioning.'
  );

  // Document chunks
  const chunks = [
    'Section 1: Ingress Gateway accepts batch payloads via HTTP/3 and WebSockets. Idempotency tokens validated in edge Redis tier.',
    'Section 2: DLQ & Poison Pill Policy retries failed events up to 5 times with exponential backoff and jitter before dispatching to quarantine.',
    'Section 3: Data Isolation & Partition Key Hashing guarantees in-order event processing within an individual workspace with p95 SLA < 45ms.',
  ];

  chunks.forEach((chunk, index) => {
    db.prepare(`
      INSERT INTO document_chunks (id, document_id, workspace_id, user_id, chunk_index, content, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`chunk-${docId}-${index}`, docId, workspaceId, userId, index, chunk, 30);
  });

  // 7. Initial AI Conversation & Messages
  const convId = 'conv-initial';
  db.prepare(`
    INSERT INTO conversations (id, workspace_id, user_id, title)
    VALUES (?, ?, ?, ?)
  `).run(convId, workspaceId, userId, 'System Architecture & Workspace Intelligence');

  const initialAIMessages = [
    {
      id: 'm-1',
      sender: 'user',
      content: 'Can you summarize our tenant isolation strategy across Firestore and distributed events?',
    },
    {
      id: 'm-2',
      sender: 'assistant',
      content: `I evaluated your workspace in relation to **tenant isolation** across both specifications:

### 1. Firestore Security Rules (\`Firebase Security Architecture\`)
* Tenant isolation is enforced via custom claims: \`request.auth.token.tenantId == workspaceId\`.
* Document mutations require \`request.auth.uid == resource.data.authorId\`.
* Audit log records are strictly write-once and immutable.

### 2. Distributed Event Queue (\`Distributed Event-Driven Architecture Spec.pdf\`)
* Partition keys are hashed as \`sha256(tenant_id + ":" + entity_type)\`, ensuring in-order delivery without inter-tenant queue contention.
* System mandates an end-to-end **p95 delivery latency under 45ms**.`,
      sources: [
        { id: 'k-1', title: 'Firebase Security Architecture & Multi-Tenant Rules', type: 'note' },
        { id: 'k-2', title: 'Distributed Event-Driven Architecture Spec.pdf', type: 'document' },
      ],
      actions: [
        { label: 'Inspect Architecture Note', action: 'open_note', targetId: 'k-1' },
        { label: 'View Architecture Spec', action: 'open_doc', targetId: 'k-2' },
        { label: 'View Today’s Tasks', action: 'navigate_tasks' },
      ],
    },
  ];

  for (const msg of initialAIMessages) {
    db.prepare(`
      INSERT INTO messages (id, conversation_id, workspace_id, user_id, role, content, sources, actions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      convId,
      workspaceId,
      userId,
      msg.sender,
      msg.content,
      (msg as any).sources ? JSON.stringify((msg as any).sources) : null,
      (msg as any).actions ? JSON.stringify((msg as any).actions) : null
    );
  }

  // 8. Activities
  const activities = [
    { id: 'act-1', title: 'Completed task', detail: 'LLM streaming latency benchmark verified on mobile browsers', type: 'task', targetId: 't-6' },
    { id: 'act-2', title: 'Updated document', detail: 'Distributed Event-Driven Architecture Spec updated with p95 SLA', type: 'document', targetId: 'k-2' },
    { id: 'act-3', title: 'Security review', detail: 'Firebase tenant isolation rules audit scheduled for 5:00 PM', type: 'project', targetId: 'p-2' },
    { id: 'act-4', title: 'AI synthesis', detail: 'Generated executive architecture digest across 4 active repositories', type: 'ai' },
  ];

  for (const a of activities) {
    db.prepare(`
      INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(a.id, workspaceId, userId, a.title, a.detail, a.type, a.targetId || null);
  }

  console.log('[DB] Seeding complete with realistic multi-tenant workspace data.');
}
