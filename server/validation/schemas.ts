import { z } from 'zod';

// ============================================================================
// Auth Schemas
// ============================================================================
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format.'),
  password: z.string().min(10, 'Password must be at least 10 characters long.').max(128),
  name: z.string().trim().min(1, 'Name is required.').max(80, 'Name must be 1 to 80 characters.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.'),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  timezone: z.string().max(50).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Invalid or malformed reset token.'),
  newPassword: z.string().min(10, 'Password must be at least 10 characters long.').max(128),
});

// ============================================================================
// Task Schemas
// ============================================================================
export const taskPriorityEnum = z.enum(['high', 'medium', 'low']);
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'completed']);
export const taskDueCategoryEnum = z.enum(['today', 'tomorrow', 'upcoming', 'completed']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200, 'Title cannot exceed 200 characters.'),
  description: z.string().max(10000).optional(),
  notes: z.string().max(10000).optional(),
  priority: taskPriorityEnum.optional().default('medium'),
  status: taskStatusEnum.optional().default('todo'),
  dueCategory: taskDueCategoryEnum.optional().default('today'),
  dueDate: z.string().max(100).optional(),
  estimatedMinutes: z.number().int().min(0).max(10000).optional(),
  projectId: z.string().max(100).nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  notes: z.string().max(10000).optional(),
  priority: taskPriorityEnum.optional(),
  status: taskStatusEnum.optional(),
  dueCategory: taskDueCategoryEnum.optional(),
  dueDate: z.string().max(100).optional(),
  estimatedMinutes: z.number().int().min(0).max(10000).optional(),
  completed: z.boolean().optional(),
  projectId: z.string().max(100).nullable().optional(),
});

// ============================================================================
// Project Schemas
// ============================================================================
export const projectStatusEnum = z.enum(['active', 'in_review', 'planning', 'completed']);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name cannot exceed 100 characters.'),
  description: z.string().max(2000).optional(),
  status: projectStatusEnum.optional().default('active'),
  color: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  deadline: z.string().max(100).optional(),
  progress: z.number().min(0).max(100).optional().default(0),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  status: projectStatusEnum.optional(),
  color: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  deadline: z.string().max(100).optional(),
  progress: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Knowledge & Document Schemas
// ============================================================================
export const knowledgeTypeEnum = z.enum(['note', 'document', 'research', 'code']);

export const createKnowledgeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200, 'Title cannot exceed 200 characters.'),
  content: z.string().max(200000, 'Content cannot exceed 200,000 characters.').optional().default(''),
  excerpt: z.string().max(2000).optional(),
  type: knowledgeTypeEnum.optional().default('note'),
  projectId: z.string().max(100).nullable().optional(),
  folderId: z.string().max(100).nullable().optional(),
  pinned: z.union([z.boolean(), z.number()]).optional(),
  sourceUrl: z.string().max(2000).optional(),
  summary: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(200000, 'Content cannot exceed 200,000 characters.').optional(),
  excerpt: z.string().max(2000).optional(),
  type: knowledgeTypeEnum.optional(),
  projectId: z.string().max(100).nullable().optional(),
  folderId: z.string().max(100).nullable().optional(),
  pinned: z.union([z.boolean(), z.number()]).optional(),
  sourceUrl: z.string().max(2000).optional(),
  summary: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// ============================================================================
// Bookmark Schemas
// ============================================================================
export const createBookmarkSchema = z.object({
  url: z.string().url('Invalid URL format.').max(2000),
  title: z.string().trim().min(1, 'Title is required.').max(200).optional(),
  description: z.string().max(2000).optional(),
  projectId: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
});

// ============================================================================
// Conversation & AI Schemas
// ============================================================================
export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional().default('New Conversation'),
});

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty.').max(4000, 'Message cannot exceed 4,000 characters.'),
  conversationId: z.string().max(100).optional(),
});

export const aiActionSchema = z.object({
  action: z.string().min(1).max(100),
  targetId: z.string().max(100).optional(),
  payload: z.any().optional(),
});

// ============================================================================
// Search Schema
// ============================================================================
export const searchQuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
  type: z.string().max(50).optional(),
});

// ============================================================================
// AI Settings Schema (BYOK)
// ============================================================================
export const aiSettingsSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'openrouter', 'custom']),
  model: z.string().max(100).optional().or(z.literal('')),
  baseUrl: z.string().url('Invalid URL format.').max(300).optional().or(z.literal('')),
  apiKey: z.string().max(500).optional().or(z.literal('')),
});

