import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient, type Client } from '@libsql/client';
import { config } from '../config';
import { runMigrations } from './migrate';

let dbClient: Client | null = null;
let migrationsRan = false;
let initPromise: Promise<void> | null = null;

export function getDatabase(): Client {
  if (!dbClient) {
    let dbUrl = config.tursoDatabaseUrl;

    if (!dbUrl) {
      // On Vercel the build filesystem is read-only; only /tmp is writable at runtime.
      // Fall back to /tmp/myspace.sqlite so a missing TURSO_DATABASE_URL doesn't crash.
      const localPath = process.env.VERCEL ? '/tmp/myspace.sqlite' : config.dbPath;
      if (!process.env.VERCEL) {
        // Only try to create the storage directory for local dev
        if (!fs.existsSync(config.storageDir)) {
          fs.mkdirSync(config.storageDir, { recursive: true });
        }
      }
      dbUrl = `file:${localPath}`;
    }

    dbClient = createClient({
      url: dbUrl,
      authToken: config.tursoAuthToken,
    });
  }
  return dbClient;
}

export const getDb = getDatabase;

export async function initDatabase(): Promise<Client> {
  const client = getDatabase();

  if (migrationsRan) {
    return client;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await runMigrations(client);
        migrationsRan = true;
        await seedDatabaseIfEmpty(client);
      } catch (err) {
        console.error('[DB] Failed during database initialization/migrations:', err);
        throw err;
      } finally {
        initPromise = null;
      }
    })();
  }

  await initPromise;
  return client;
}

export function closeDatabase(): void {
  if (dbClient) {
    dbClient.close();
    dbClient = null;
    migrationsRan = false;
  }
}

async function seedDatabaseIfEmpty(client: Client): Promise<void> {
  if (process.env.SEED_DEMO !== 'true' || config.env === 'production') {
    return;
  }

  const existingRes = await client.execute('SELECT id FROM users LIMIT 1');
  if (existingRes.rows.length > 0) return;

  const demoPassword = crypto.randomBytes(9).toString('base64url');
  console.log('[DB] Seeding demo workspace data...');
  console.log(`[DB DEMO ACCOUNT] User: nabin@workspace.ai | Password: ${demoPassword}`);

  const userId = 'u-nabin';
  const workspaceId = 'w-nabin-eng';
  const hashedPassword = bcrypt.hashSync(demoPassword, 10);

  // 1. User & Profile
  await client.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, avatar_url, role, token_version)
          VALUES (?, ?, ?, ?, ?, ?, 1)`,
    args: [userId, 'nabin@workspace.ai', hashedPassword, 'Nabin Thapa', 'NT', 'Product Engineer'],
  });

  await client.execute({
    sql: `INSERT INTO profiles (user_id, display_name, avatar_url, timezone, theme)
          VALUES (?, ?, ?, 'UTC', 'dark')`,
    args: [userId, 'Nabin Thapa', 'NT'],
  });

  await client.execute({
    sql: `INSERT INTO workspaces (id, user_id, name, description)
          VALUES (?, ?, ?, ?)`,
    args: [workspaceId, userId, 'Engineering & Strategy', 'Core engineering, distributed systems, and technical architecture.'],
  });

  // 2. Demo Tasks
  const insertTask = `
    INSERT INTO tasks (id, workspace_id, user_id, project_id, title, description, notes, status, priority, due_date, due_category, estimated_minutes, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await client.execute({
    sql: insertTask,
    args: ['t-1', workspaceId, userId, 'p-2', 'Audit Firestore security rules for per-user tenant isolation', 'Cloud Infrastructure Audit', 'Verify request.auth.uid matches resource.data.ownerId on all subcollections. Ensure read/write quotas.', 'todo', 'high', 'Today, 5:00 PM', 'today', 45, 0],
  });

  await client.execute({
    sql: insertTask,
    args: ['t-2', workspaceId, userId, 'p-4', 'Verify mobile touch targets and bottom sheet gestures (iOS Safari)', 'Design System v2', 'Confirm 44px hit target on all icon buttons and verify pull-to-dismiss threshold.', 'todo', 'high', 'Today, 7:30 PM', 'today', 30, 0],
  });

  await client.execute({
    sql: insertTask,
    args: ['t-3', workspaceId, userId, 'p-1', 'Review Stripe webhook retry exponential backoff semantics', 'Personal AI Workspace', 'Ensure idempotency key check prevents duplicate credits during network dropouts.', 'todo', 'medium', 'Today, 9:00 PM', 'today', 60, 0],
  });

  // 3. Demo Projects
  const insertProject = `
    INSERT INTO projects (id, workspace_id, user_id, name, description, progress, status, deadline, color, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await client.execute({
    sql: insertProject,
    args: ['p-1', workspaceId, userId, 'Personal AI Workspace', 'Next-gen productivity canvas combining real-time note editing, vector RAG retrieval, and autonomous workflow coordination.', 78, 'active', 'Oct 15, 2026', '#6366f1', 'AI & Core Platform'],
  });

  await client.execute({
    sql: insertProject,
    args: ['p-2', workspaceId, userId, 'Cloud Infrastructure Audit', 'Comprehensive audit of GCP and AWS microservices for security isolation, latency SLAs, and cost-efficiency.', 65, 'in_review', 'Sep 30, 2026', '#0ea5e9', 'Infrastructure'],
  });

  // 4. Demo Knowledge Items
  const insertKI = `
    INSERT INTO knowledge_items (id, workspace_id, user_id, project_id, title, content, excerpt, type, summary, pinned, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await client.execute({
    sql: insertKI,
    args: [
      'k-1',
      workspaceId,
      userId,
      'p-2',
      'Firebase Security Architecture & Multi-Tenant Rules',
      `# Firebase Security Architecture & Multi-Tenant Rules\n\n## Overview\nThis document defines our multi-tenant isolation model for Firestore collections.\n\n## Core Rules\n1. Every query must be scoped by \`request.auth.uid\`.\n2. Subcollections must validate workspace ownership.\n`,
      'Core rules and architectural guidelines for multi-tenant isolation in Firestore and Cloud Functions.',
      'note',
      'Defines tenant isolation and security rules for Firestore subcollections.',
      1,
      JSON.stringify({ tags: ['Security', 'Cloud', 'Architecture'], readTime: '4 min read' }),
    ],
  });

  console.log('[DB] Demo data seeded successfully.');
}
