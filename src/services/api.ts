import type { Task, KnowledgeItem, Project, Activity } from '../data/mockData';

const API_BASE = '/api';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
  theme?: string;
  timezone?: string;
  csrfToken?: string;
}

class ApiService {
  // CSRF token stored in memory only — read from cookie/response, never localStorage
  private csrfToken: string | null = null;

  constructor() {
    // Read CSRF token from cookie if present (non-httpOnly cookie set by server)
    this.csrfToken = this.readCsrfCookie();
  }

  private readCsrfCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)myspace_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  public setCsrfToken(token: string | null) {
    this.csrfToken = token;
  }

  public getCsrfToken(): string | null {
    return this.csrfToken || this.readCsrfCookie();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach CSRF token on state-changing requests
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = this.getCsrfToken();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Always send HttpOnly session cookie
    });

    if (res.status === 401) {
      // Session expired or revoked — trigger re-authentication
      window.dispatchEvent(new CustomEvent('myspace:session-expired'));
      throw new Error('Session expired. Please log in again.');
    }

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || `Request failed with status ${res.status}`);
    }

    return json.data;
  }

  // --- Auth APIs ---
  public async login(email: string, password: string): Promise<{ user: UserSession }> {
    const data = await this.request<{ token: string; csrfToken: string; user: UserSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.csrfToken) this.setCsrfToken(data.csrfToken);
    return { user: { ...data.user, csrfToken: data.csrfToken } };
  }

  public async signup(email: string, password: string, name: string): Promise<{ user: UserSession }> {
    const data = await this.request<{ token: string; csrfToken: string; user: UserSession }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (data.csrfToken) this.setCsrfToken(data.csrfToken);
    return { user: { ...data.user, csrfToken: data.csrfToken } };
  }

  public async getMe(): Promise<UserSession> {
    const data = await this.request<UserSession & { csrfToken?: string }>('/auth/me');
    if (data.csrfToken) this.setCsrfToken(data.csrfToken);
    return data;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setCsrfToken(null);
      // Clear CSRF cookie client-side
      document.cookie = 'myspace_csrf=; Max-Age=0; path=/';
    }
  }

  public async updateProfile(payload: { name?: string; theme?: string; timezone?: string }): Promise<void> {
    await this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // --- Tasks APIs ---
  public async getTasks(filter?: string): Promise<Task[]> {
    const query = filter ? `?filter=${filter}` : '';
    return this.request<Task[]>(`/tasks${query}`);
  }

  public async addTask(task: Omit<Task, 'id' | 'completed'>): Promise<Task> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  public async toggleTask(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${id}/toggle`, { method: 'PATCH' });
  }

  public async deleteTask(id: string): Promise<void> {
    await this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  // --- Knowledge APIs ---
  public async getKnowledge(type?: string, search?: string): Promise<KnowledgeItem[]> {
    const params = new URLSearchParams();
    if (type && type !== 'all') params.append('type', type);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<KnowledgeItem[]>(`/knowledge${query}`);
  }

  public async getKnowledgeItem(id: string): Promise<KnowledgeItem> {
    return this.request<KnowledgeItem>(`/knowledge/${id}`);
  }

  public async createKnowledgeItem(item: { title: string; content?: string; type?: string; tags?: string[] }): Promise<KnowledgeItem> {
    return this.request<KnowledgeItem>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  public async updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    return this.request<KnowledgeItem>(`/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async deleteKnowledgeItem(id: string): Promise<void> {
    await this.request(`/knowledge/${id}`, { method: 'DELETE' });
  }

  // --- Document APIs ---
  public async uploadDocument(file: File): Promise<{ id: string; documentId: string; title: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ id: string; documentId: string; title: string }>('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  public async getDocumentStatus(id: string): Promise<any> {
    return this.request<any>(`/documents/${id}`);
  }

  // --- Projects APIs ---
  public async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects');
  }

  public async createProject(project: { name: string; description: string; color?: string; category?: string; deadline?: string }): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  // --- Activities APIs ---
  public async getActivities(): Promise<Activity[]> {
    return this.request<Activity[]>('/activities');
  }

  // --- Search APIs ---
  public async searchWorkspace(query: string, category: string = 'all'): Promise<any[]> {
    if (!query.trim()) return [];
    return this.request<any[]>(`/search?q=${encodeURIComponent(query)}&category=${category}`);
  }

  // --- AI APIs ---
  public async getAIBrief(): Promise<{ brief: string; taskCount: number; projectCount: number }> {
    return this.request<{ brief: string; taskCount: number; projectCount: number }>('/ai/brief');
  }

  /**
   * Stream AI Chat using Server-Sent Events.
   * Uses cookie-based auth; no Bearer token in header.
   */
  public async streamAIChat(
    message: string,
    conversationId?: string,
    callbacks?: {
      onToken?: (token: string) => void;
      onDone?: (result: { content: string; sources: any[]; actions: any[] }) => void;
      onError?: (err: string) => void;
    },
    signal?: AbortSignal
  ): Promise<{ content: string; sources: any[]; actions: any[] }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const csrf = this.getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;

    const response = await fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ message, conversationId }),
      signal,
    });

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('myspace:session-expired'));
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`AI Streaming request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let sources: any[] = [];
    let actions: any[] = [];

    if (reader) {
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith(':')) continue; // heartbeat comment line
            if (clean.startsWith('data: ')) {
              try {
                const payload = JSON.parse(clean.slice(6));
                if (payload.type === 'token') {
                  accumulatedText += payload.token;
                  callbacks?.onToken?.(payload.token);
                } else if (payload.type === 'done') {
                  accumulatedText = payload.content;
                  sources = payload.sources || [];
                  actions = payload.actions || [];
                  callbacks?.onDone?.({ content: accumulatedText, sources, actions });
                } else if (payload.type === 'error') {
                  callbacks?.onError?.(payload.message);
                }
              } catch { /* skip malformed SSE */ }
            }
          }
        }
      }
    }

    return { content: accumulatedText, sources, actions };
  }
}

export const api = new ApiService();
