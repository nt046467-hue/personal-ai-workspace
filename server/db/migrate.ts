import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { config } from '../config';

/**
 * Split raw SQL content into individual executable statements.
 * Handles string literals, line comments, block comments, and BEGIN ... END trigger blocks.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let blockDepth = 0; // Tracks BEGIN ... END blocks in triggers

  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';

    // Handle line comment
    if (!inString && !inBlockComment && char === '-' && nextChar === '-') {
      inLineComment = true;
      current += char;
      i++;
      continue;
    }
    if (inLineComment) {
      current += char;
      if (char === '\n') inLineComment = false;
      i++;
      continue;
    }

    // Handle block comment
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      current += char;
      i++;
      continue;
    }
    if (inBlockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += nextChar;
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Handle string literal
    if (char === "'") {
      current += char;
      if (inString && nextChar === "'") {
        // Escaped single quote
        current += nextChar;
        i += 2;
        continue;
      }
      inString = !inString;
      i++;
      continue;
    }

    if (!inString) {
      // Track BEGIN ... END triggers
      const wordMatch = sql.slice(i).match(/^(\bBEGIN\b|\bEND\b)/i);
      if (wordMatch) {
        const word = wordMatch[1].toUpperCase();
        if (word === 'BEGIN') {
          blockDepth++;
        } else if (word === 'END') {
          blockDepth = Math.max(0, blockDepth - 1);
        }
        current += wordMatch[1];
        i += wordMatch[1].length;
        continue;
      }

      // Semicolon outside strings and trigger blocks marks end of statement
      if (char === ';' && blockDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
        i++;
        continue;
      }
    }

    current += char;
    i++;
  }

  const remaining = current.trim();
  if (remaining) {
    statements.push(remaining);
  }

  return statements;
}

export async function runMigrations(existingClient?: Client): Promise<void> {
  const url = config.tursoDatabaseUrl || `file:${config.dbPath}`;
  const client = existingClient || createClient({
    url,
    authToken: config.tursoAuthToken,
  });

  try {
    // Ensure schema_migrations table exists
    await client.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Fetch applied migrations
    const appliedRes = await client.execute('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set<number>(appliedRes.rows.map(r => Number(r.version)));

    const migrationsDir = path.resolve(process.cwd(), 'server', 'db', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;

      const version = parseInt(match[1], 10);
      if (appliedVersions.has(version)) {
        continue;
      }

      console.log(`[Migrate] Applying migration ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const statements = splitSqlStatements(sql);

      for (const statement of statements) {
        if (!statement.trim()) continue;
        try {
          await client.execute(statement);
        } catch (err: any) {
          console.error(`[Migrate] Error in statement from ${file}:`, statement);
          throw err;
        }
      }

      await client.execute({
        sql: 'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        args: [version, file],
      });
      console.log(`[Migrate] Migration ${file} successfully applied.`);
    }
  } finally {
    if (!existingClient) {
      client.close();
    }
  }
}

// Standalone execution: tsx server/db/migrate.ts
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/db/migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('[Migrate] All migrations up to date.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migrate] Migration failed:', err);
      process.exit(1);
    });
}
