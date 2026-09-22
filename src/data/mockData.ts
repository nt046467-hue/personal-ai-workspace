export interface Task {
  id: string;
  title: string;
  project: string;
  projectId?: string | null;
  dueDate: string;
  dueCategory: 'today' | 'tomorrow' | 'upcoming' | 'completed';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  notes?: string;
  estimatedMinutes?: number;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  type: 'note' | 'document' | 'research' | 'code';
  excerpt: string;
  tags: string[];
  updatedAt: string;
  readTime: string;
  pinned?: boolean;
  content?: string;
  fileSize?: string;
  pageCount?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  openTasksCount: number;
  totalTasksCount: number;
  updatedAt: string;
  status: 'active' | 'in_review' | 'planning' | 'completed';
  deadline: string;
  color: string;
  category: string;
}

export interface Activity {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: 'task' | 'document' | 'project' | 'ai';
  targetId?: string;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  sources?: { id: string; title: string; type: string }[];
  actions?: { label: string; action: string; targetId?: string }[];
}

export const CURRENT_USER = {
  name: 'Nabin Thapa',
  email: 'nabin@workspace.ai',
  avatar: 'NT',
  role: 'Product Engineer',
  workspaceName: 'Engineering & Strategy',
};

export const INITIAL_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Audit Firestore security rules for per-user tenant isolation',
    project: 'Cloud Infrastructure Audit',
    projectId: 'p-2',
    dueDate: 'Today, 5:00 PM',
    dueCategory: 'today',
    priority: 'high',
    completed: false,
    notes: 'Verify request.auth.uid matches resource.data.ownerId on all subcollections. Ensure read/write quotas.',
    estimatedMinutes: 45,
  },
  {
    id: 't-2',
    title: 'Verify mobile touch targets and bottom sheet gestures (iOS Safari)',
    project: 'Design System v2',
    projectId: 'p-4',
    dueDate: 'Today, 7:30 PM',
    dueCategory: 'today',
    priority: 'high',
    completed: false,
    notes: 'Confirm 44px hit target on all icon buttons and verify pull-to-dismiss threshold.',
    estimatedMinutes: 30,
  },
  {
    id: 't-3',
    title: 'Review Stripe webhook retry exponential backoff semantics',
    project: 'Personal AI Workspace',
    projectId: 'p-1',
    dueDate: 'Today, 9:00 PM',
    dueCategory: 'today',
    priority: 'medium',
    completed: false,
    notes: 'Handle duplicate invoice.payment_succeeded events with Redis idempotency key lock.',
    estimatedMinutes: 60,
  },
  {
    id: 't-4',
    title: 'Finalize offline sync conflict resolution strategy (LWW vs CRDT)',
    project: 'Cloud Infrastructure Audit',
    projectId: 'p-2',
    dueDate: 'Tomorrow',
    dueCategory: 'tomorrow',
    priority: 'medium',
    completed: false,
    notes: 'Draft benchmark comparison between SQLite client-side delta sync and CouchDB.',
    estimatedMinutes: 90,
  },
  {
    id: 't-5',
    title: 'Draft engineering brief for vector embeddings chunking & indexing',
    project: 'Personal AI Workspace',
    projectId: 'p-1',
    dueDate: 'In 2 days',
    dueCategory: 'upcoming',
    priority: 'low',
    completed: false,
    notes: 'Evaluate recursive character splitter at 512 tokens with 64 token overlap.',
    estimatedMinutes: 45,
  },
  {
    id: 't-6',
    title: 'Benchmark LLM streaming latency over WebSocket vs SSE',
    project: 'Personal AI Workspace',
    projectId: 'p-1',
    dueDate: 'Sep 18',
    dueCategory: 'completed',
    priority: 'low',
    completed: true,
    notes: 'SSE showed 14% lower CPU overhead on mobile browsers with native fetch ReadableStream.',
    estimatedMinutes: 40,
  },
];

export const INITIAL_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'k-1',
    title: 'Firebase Security Architecture & Multi-Tenant Rules',
    type: 'note',
    excerpt: 'Detailed specification of database security rules, role-based authorization tokens, and partition schemas for tenant workspaces.',
    tags: ['Security', 'Backend', 'Firebase'],
    updatedAt: '2 hours ago',
    readTime: '6 min read',
    pinned: true,
    content: `# Firebase Security Architecture & Multi-Tenant Rules

## Overview
This document specifies the authorization invariants for client-direct database reads and writes. Every tenant workspace is isolated via custom claims attached to the user's Firebase Authentication JWT.

### Key Invariants:
1. **Tenant Isolation**: Direct queries must include \`where("tenantId", "==", request.auth.token.tenantId)\`.
2. **Owner Write Rules**: Modifications require matching \`request.auth.uid == resource.data.authorId\` or admin membership.
3. **Audit Log Immutability**: Appends only; deletion is strictly rejected by rule validations.

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function belongsToTenant(tenantId) {
      return isAuthenticated() && request.auth.token.tenantId == tenantId;
    }

    match /workspaces/{workspaceId}/documents/{docId} {
      allow read: if belongsToTenant(workspaceId);
      allow create: if belongsToTenant(workspaceId) 
                    && request.resource.data.authorId == request.auth.uid;
      allow update: if belongsToTenant(workspaceId) 
                    && resource.data.authorId == request.auth.uid;
    }
  }
}
\`\`\`

### Verification Checklist:
- [x] Test unauthenticated read attempts receive 403 Forbidden
- [x] Verify tenant boundary cross-contamination fails unit tests
- [ ] Implement automated CI integration testing via Firebase Emulator
`,
  },
  {
    id: 'k-2',
    title: 'Distributed Event-Driven Architecture Spec.pdf',
    type: 'document',
    excerpt: 'Technical specification for real-time state synchronization, message broker topology, and fault-tolerant event processing pipelines.',
    tags: ['Architecture', 'Systems', 'Spec'],
    updatedAt: 'Yesterday',
    readTime: '18 pages',
    pinned: true,
    fileSize: '2.4 MB',
    pageCount: 18,
    content: `# Distributed Event-Driven Architecture Spec

**Author**: Nabin Thapa & Systems Architecture Working Group  
**Status**: Approved for Implementation  
**Version**: 2.4.0  

## Executive Summary
This document defines the high-throughput, low-latency event distribution pipeline connecting client workspaces with asynchronous workers (indexing, embedding generation, external notifications).

### Architectural Topology
1. **Event Ingestion Gateway**: Edge HTTP/3 endpoint receiving structured workspace mutations.
2. **Idempotent Queue Broker**: Distributed Kafka/Redis Streams cluster with partitioned topic keys.
3. **Dead Letter Queue (DLQ)**: Automatic retries with exponential jitter; poison messages quarantined after 5 failures.

### Performance Targets
- **End-to-End Delivery Latency**: < 45ms (p95)
- **Availability SLA**: 99.95% uptime
- **Backpressure Mechanism**: Dynamic window sizing on client sync channels
`,
  },
  {
    id: 'k-3',
    title: 'Product Strategy & Onboarding Friction Analysis',
    type: 'research',
    excerpt: 'Empirical review of workspace drop-off rates during initial setup. Identifies key friction in OAuth scopes and initial knowledge import.',
    tags: ['Product', 'UX', 'Retention'],
    updatedAt: '3 days ago',
    readTime: '9 min read',
    pinned: false,
    content: `# Product Strategy & Onboarding Friction Analysis

## Problem Statement
First-week retention for desktop workspace applications heavily correlates with the "First Meaningful Action" within 180 seconds of account creation.

### Observed Friction Points:
1. **Blank Canvas Paralysis**: Users drop off when greeted with an empty dashboard without clear starting directions.
2. **Overwhelming Permissions**: Asking for full drive/calendar access upfront reduces conversion by 34%.
3. **Delayed AI Utility**: Users want immediate utility before manually importing 50 files.

### Recommended Product Remedies:
- Pre-populate an interactive "Getting Started" interactive note demonstrating AI context summons.
- Progressive disclosure: request integrations only when triggered by relevant workspace commands.
- Quick capture: Desktop global shortcut (\`⌘K\`) available immediately after initial onboarding.
`,
  },
  {
    id: 'k-4',
    title: 'Q3 Engineering Retrospective & Benchmark Report.pdf',
    type: 'document',
    excerpt: 'Comprehensive audit of delivery velocities, infrastructure cost optimizations, and test coverage metrics across core services.',
    tags: ['Planning', 'Team', 'Metrics'],
    updatedAt: 'Sep 14, 2026',
    readTime: '12 pages',
    fileSize: '1.8 MB',
    pageCount: 12,
  },
  {
    id: 'k-5',
    title: 'Local-First Data Syncing using CRDTs & SQLite',
    type: 'research',
    excerpt: 'Comparison between Automerge, Yjs, and custom state-based CRDTs for collaborative real-time document editing in desktop clients.',
    tags: ['Database', 'Sync', 'Performance'],
    updatedAt: 'Sep 11, 2026',
    readTime: '14 min read',
  },
  {
    id: 'k-6',
    title: 'TypeScript Generic Result Type & Error Monad Pattern',
    type: 'code',
    excerpt: 'Production-tested type definitions for robust error handling without unhandled runtime exceptions in asynchronous business logic.',
    tags: ['TypeScript', 'Patterns', 'Core'],
    updatedAt: 'Sep 08, 2026',
    readTime: '4 min read',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p-1',
    name: 'Personal AI Workspace',
    description: 'Unified intelligence environment combining personal knowledge graph, daily task focus, and contextual synthesis.',
    progress: 68,
    openTasksCount: 4,
    totalTasksCount: 10,
    updatedAt: '2 hours ago',
    status: 'active',
    deadline: 'Oct 15, 2026',
    color: '#6366f1',
    category: 'Product & AI',
  },
  {
    id: 'p-2',
    name: 'Cloud Infrastructure Audit',
    description: 'Security rules review, cost telemetry optimization, and database tenant partition hardening across cloud clusters.',
    progress: 85,
    openTasksCount: 2,
    totalTasksCount: 8,
    updatedAt: '4 hours ago',
    status: 'in_review',
    deadline: 'Sep 30, 2026',
    color: '#0ea5e9',
    category: 'Infrastructure',
  },
  {
    id: 'p-3',
    name: 'Fitness & Recovery Mobile App',
    description: 'Health metrics tracking client with biometric trend correlation, offline workout logging, and sleep architecture insights.',
    progress: 42,
    openTasksCount: 7,
    totalTasksCount: 12,
    updatedAt: '1 day ago',
    status: 'active',
    deadline: 'Nov 20, 2026',
    color: '#10b981',
    category: 'Mobile & Health',
  },
  {
    id: 'p-4',
    name: 'Design System v2',
    description: 'High-craft design token library, accessible component specifications, and responsive layout primitives.',
    progress: 92,
    openTasksCount: 1,
    totalTasksCount: 14,
    updatedAt: '2 days ago',
    status: 'in_review',
    deadline: 'Sep 25, 2026',
    color: '#f59e0b',
    category: 'Design Systems',
  },
];

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'a-1',
    title: 'Completed benchmark on streaming latency',
    detail: 'Validated SSE vs WebSocket memory and CPU profiles on mobile browser engines.',
    timestamp: '2 hours ago',
    type: 'task',
  },
  {
    id: 'a-2',
    title: 'Updated Firebase Security Architecture note',
    detail: 'Added tenant subcollection validation rules and verified test suite coverage.',
    timestamp: '3 hours ago',
    type: 'document',
    targetId: 'k-1',
  },
  {
    id: 'a-3',
    title: 'Attached Distributed Event-Driven Architecture Spec',
    detail: 'Uploaded 18-page technical specification to Workspace Knowledge Base.',
    timestamp: 'Yesterday',
    type: 'document',
    targetId: 'k-2',
  },
  {
    id: 'a-4',
    title: 'Created task: Audit Firestore security rules',
    detail: 'Assigned high priority with due date set for today at 5:00 PM.',
    timestamp: 'Yesterday',
    type: 'task',
    targetId: 't-1',
  },
];

export const AI_PROMPTS = [
  'Summarise my latest note',
  "What's due this week?",
  'Find active projects',
  'Search workspace',
];

