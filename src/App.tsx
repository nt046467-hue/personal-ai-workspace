import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DesktopSidebar } from './components/AppShell/DesktopSidebar';
import type { NavigationTab } from './components/AppShell/DesktopSidebar';
import { DesktopTopBar } from './components/AppShell/DesktopTopBar';
import { DesktopRightPanel } from './components/AppShell/DesktopRightPanel';
import { MobileHeader } from './components/AppShell/MobileHeader';
import { MobileBottomNav } from './components/AppShell/MobileBottomNav';
import { MobileMoreDrawer } from './components/AppShell/MobileMoreDrawer';
import { AddBottomSheet } from './components/AddBottomSheet/AddBottomSheet';
import type { AddActionType } from './components/AddBottomSheet/AddBottomSheet';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ToastContainer } from './components/Toast/Toast';
import type { ToastMessage } from './components/Toast/Toast';
import { AuthModal } from './components/Auth/AuthModal';
import { ResetPasswordView } from './views/ResetPassword/ResetPasswordView';
import { MobileNotificationSheet } from './components/Notifications/MobileNotificationSheet';
import { useNotifications } from './hooks/useNotifications';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

import { HomeView } from './views/Home/HomeView';
import { KnowledgeView } from './views/Knowledge/KnowledgeView';
import { NoteEditorView } from './views/NoteEditor/NoteEditorView';
import { DocumentViewerView } from './views/DocumentViewer/DocumentViewerView';
import { AIAssistantView } from './views/AIAssistant/AIAssistantView';
import { TasksView } from './views/Tasks/TasksView';
import { ProjectsView } from './views/Projects/ProjectsView';
import { SettingsView } from './views/Settings/SettingsView';
import { ProfileView } from './views/Profile/ProfileView';

import { useMediaQuery } from './hooks/useMediaQuery';
import { useVisualViewportHeight } from './hooks/useVisualViewportHeight';

import type { 
  Task, 
  KnowledgeItem, 
  Project, 
  Activity, 
  AIMessage 
} from './data/mockData';

import { api } from './services/api';
import type { UserSession } from './services/api';
import './styles/app.css';

const VALID_TABS: NavigationTab[] = ['home', 'knowledge', 'tasks', 'projects', 'ai', 'settings', 'note-editor', 'doc-viewer', 'project-detail'];

function getTabFromUrl(): NavigationTab {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0] || '';
  if (VALID_TABS.includes(path as NavigationTab)) {
    return path as NavigationTab;
  }
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0] || '';
  if (VALID_TABS.includes(hash as NavigationTab)) {
    return hash as NavigationTab;
  }
  return 'home';
}

export const App: React.FC = () => {
  // Mobile breakpoint & iOS viewport height management
  const isMobile = useMediaQuery('(max-width: 820px)');
  useVisualViewportHeight();

  // Navigation & View State (persists across page refresh via URL)
  const [currentTab, setCurrentTab] = useState<NavigationTab>(getTabFromUrl);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('k-1');
  const [selectedDocId, setSelectedDocId] = useState<string>('k-2');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleSelectTab = useCallback((tab: NavigationTab) => {
    setCurrentTab(tab);
    const targetPath = tab === 'home' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentTab(getTabFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // App Shell States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isComposerFocused, setIsComposerFocused] = useState(false);

  // Modals & Drawers
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // User Session — null until authenticated
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Data Collections — empty until loaded from real API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [_conversations, setConversations] = useState<any[]>([]);

  // Shared Notifications Controller — single source of truth across desktop and mobile
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const notificationController = useNotifications(tasks, activities);

  // AI Streaming State
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Synchronize HTML theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme} mode`, 'info');
    api.updateProfile({ theme: nextTheme }).catch(() => {});
  };

  // Keyboard shortcut for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch all live workspace data from backend
  const refreshWorkspaceData = useCallback(async () => {
    try {
      const [fetchedTasks, fetchedKnowledge, fetchedProjects, fetchedActivities, fetchedConversations] = await Promise.all([
        api.getTasks(),
        api.getKnowledge(),
        api.getProjects(),
        api.getActivities(),
        api.getConversations().catch(() => []),
      ]);

      if (fetchedTasks) setTasks(fetchedTasks);
      if (fetchedKnowledge) setKnowledge(fetchedKnowledge);
      if (fetchedProjects) setProjects(fetchedProjects);
      if (fetchedActivities) setActivities(fetchedActivities);
      if (fetchedConversations) setConversations(fetchedConversations);
    } catch (err) {
      console.error('[App] Error refreshing workspace data:', err);
    }
  }, []);

  // Initialize session on mount — no auto-login
  useEffect(() => {
    const initSession = async () => {
      try {
        const me = await api.getMe();
        if (me) {
          setCurrentUser(me);
          if (me.theme) setTheme(me.theme as 'dark' | 'light');
          await refreshWorkspaceData();
        }
      } catch {
        // Not authenticated — show login screen
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initSession();

    // Handle session expiry from api service
    const onExpired = () => {
      setCurrentUser(null);
      setAuthModalOpen(false);
    };
    window.addEventListener('myspace:session-expired', onExpired);
    return () => window.removeEventListener('myspace:session-expired', onExpired);
  }, [refreshWorkspaceData]);

  // Task Actions
  const handleToggleTask = async (id: string) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextState = !t.completed;
        showToast(nextState ? `Completed: "${t.title.slice(0, 30)}..."` : 'Task marked incomplete');
        return { ...t, completed: nextState };
      }
      return t;
    }));

    try {
      await api.toggleTask(id);
      const updatedProjects = await api.getProjects().catch(() => null);
      if (updatedProjects) setProjects(updatedProjects);
    } catch {
      showToast('Failed to update task on server', 'error');
      // Revert if error
      refreshWorkspaceData();
    }
  };

  const handleAddTask = async (newTask: Omit<Task, 'id' | 'completed'>) => {
    try {
      const created = await api.addTask(newTask);
      setTasks(prev => [created, ...prev]);
      showToast('Task saved to workspace');
      const updatedProjects = await api.getProjects().catch(() => null);
      if (updatedProjects) setProjects(updatedProjects);
    } catch (err: any) {
      showToast(err.message || 'Failed to create task', 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('Task removed');
    try {
      await api.deleteTask(id);
    } catch {
      showToast('Failed to delete task from server', 'error');
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    setKnowledge(prev => prev.filter(k => k.id !== id));
    showToast('Knowledge item removed');
    try {
      await api.deleteKnowledgeItem(id);
    } catch {
      showToast('Failed to delete item from server', 'error');
    }
  };

  const handleCreateProject = async (project: { name: string; description: string; color?: string; category?: string; deadline?: string }) => {
    try {
      const created = await api.createProject(project);
      setProjects(prev => [created, ...prev]);
      showToast(`Project "${created.name}" created`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error');
      throw err;
    }
  };

  const handleDeleteActivity = async (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    try {
      await api.deleteActivity(id);
    } catch {
      // Non-fatal: optimistic remove already happened
    }
  };

  // Real Pinned items for Sidebar & Quick Access
  const pinnedItems = React.useMemo(() => knowledge.filter(k => k.pinned), [knowledge]);

  const handleTogglePin = async (id: string) => {
    const item = knowledge.find(k => k.id === id);
    if (!item) return;
    const newPinned = !item.pinned;
    setKnowledge(prev => prev.map(k => k.id === id ? { ...k, pinned: newPinned } : k));
    showToast(newPinned ? `Pinned "${item.title}" to sidebar` : `Unpinned "${item.title}"`);
    try {
      await api.updateKnowledgeItem(id, { pinned: newPinned } as any);
    } catch {
      // Non-fatal, state updated locally
    }
  };

  // Navigation Helpers
  const handleOpenNote = (id: string) => {
    setSelectedNoteId(id);
    handleSelectTab('note-editor');
  };

  const handleOpenDoc = (id: string) => {
    setSelectedDocId(id);
    handleSelectTab('doc-viewer');
  };

  const handleOpenProject = (id: string | null) => {
    setSelectedProjectId(id);
    handleSelectTab(id ? 'project-detail' : 'projects');
  };

  // Note Autosave Handler
  const handleSaveNote = async (id: string, updates: { title?: string; content?: string }) => {
    try {
      const updated = await api.updateKnowledgeItem(id, updates);
      setKnowledge(prev => prev.map(k => k.id === id ? updated : k));
    } catch (err: any) {
      console.error('[Note Autosave] Error:', err);
    }
  };

  // Add Action from Bottom Sheet or Top Bar
  const handleSelectAddAction = async (action: AddActionType) => {
    switch (action) {
      case 'note': {
        try {
          const newNote = await api.createKnowledgeItem({
            title: 'Untitled Scratchpad',
            content: '# Untitled Scratchpad\n\nDraft your notes and architecture thoughts here.\n',
            type: 'note',
            tags: ['Scratchpad'],
          });
          setKnowledge(prev => [newNote, ...prev]);
          handleOpenNote(newNote.id);
          showToast('Created new note');
        } catch {
          handleOpenNote('k-1');
        }
        break;
      }
      case 'task':
        setCurrentTab('tasks');
        showToast('Opening task creation');
        break;
      case 'upload':
        // Will be handled by native file input
        break;
      case 'bookmark':
        showToast('Bookmark dialog ready');
        break;
      case 'idea': {
        try {
          const ideaNote = await api.createKnowledgeItem({
            title: 'Quick Idea: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: '## Captured Idea\n\n',
            type: 'research',
            tags: ['Idea'],
          });
          setKnowledge(prev => [ideaNote, ...prev]);
          handleOpenNote(ideaNote.id);
          showToast('Idea captured in workspace');
        } catch {
          showToast('Idea captured in queue');
        }
        break;
      }
      case 'project':
        setCurrentTab('projects');
        break;
    }
  };

  // Native File Upload Handler
  const handleUploadFile = async (file: File) => {
    showToast(`Uploading ${file.name}...`, 'info');
    try {
      const uploaded = await api.uploadDocument(file);
      showToast(`Uploaded & indexed ${file.name}`, 'success');
      await refreshWorkspaceData();
      handleOpenDoc(uploaded.id);
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  // AI Message Sending (Real Streaming SSE with AbortController support)
  const handleSendAIMessage = async (text: string) => {
    const userMsgId = `m-${Date.now()}`;
    const assistantMsgId = `m-${Date.now() + 1}`;

    const userMsg: AIMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: 'Just now',
      content: text,
    };

    const initialAssistantMsg: AIMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      timestamp: 'Thinking...',
      content: '',
      sources: [],
      actions: [],
    };

    // Extract last 8 turns of conversation for multi-turn coherence
    const history = aiMessages.slice(-8).map(m => ({
      role: m.sender as 'user' | 'assistant',
      content: m.content,
    }));

    setAiMessages(prev => [...prev, userMsg, initialAssistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAiStreaming(true);

    let currentTargetId = assistantMsgId;

    try {
      await api.streamAIChat(
        text, 
        activeConversationId || undefined, 
        history, 
        {
          onStart: (data) => {
            if (data.conversationId) {
              setActiveConversationId(data.conversationId);
            }
            if (data.assistantMessageId) {
              const serverId = data.assistantMessageId;
              setAiMessages(prev =>
                prev.map(m =>
                  m.id === currentTargetId || m.id === assistantMsgId
                    ? { ...m, id: serverId }
                    : m
                )
              );
              currentTargetId = serverId;
            }
          },
          onToken: (token, msgId) => {
            setAiMessages(prev =>
              prev.map(m =>
                (m.id === currentTargetId || m.id === assistantMsgId || (msgId && m.id === msgId))
                  ? { ...m, timestamp: 'Just now', content: m.content + token }
                  : m
              )
            );
          },
          onDone: (result) => {
            setAiMessages(prev =>
              prev.map(m =>
                (m.id === currentTargetId || m.id === assistantMsgId || (result.messageId && m.id === result.messageId))
                  ? {
                      ...m,
                      timestamp: 'Just now',
                      content: result.content,
                      sources: result.sources,
                      actions: result.actions,
                    }
                  : m
              )
            );
            api.getConversations().then(c => setConversations(c)).catch(() => {});
          },
          onError: (errMsg, msgId) => {
            setAiMessages(prev =>
              prev.map(m =>
                (m.id === currentTargetId || m.id === assistantMsgId || (msgId && m.id === msgId))
                  ? { ...m, timestamp: 'Just now', content: `⚠️ ${errMsg}` }
                  : m
              )
            );
            showToast(errMsg, 'error');
          },
        }, 
        controller.signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Generation stopped', 'info');
      } else {
        const errorContent = err.message || 'AI streaming encountered an issue. Please try again.';
        setAiMessages(prev =>
          prev.map(m =>
            (m.id === currentTargetId || m.id === assistantMsgId)
              ? {
                  ...m,
                  timestamp: 'Just now',
                  content: `⚠️ **Unable to complete response**\n\n${errorContent}`,
                }
              : m
          )
        );
        showToast(err.message || 'AI streaming error', 'error');
      }
    } finally {
      setIsAiStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAiStreaming(false);
  }, []);

  const handleNewChat = useCallback(() => {
    if (isAiStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAiStreaming(false);
    }
    setActiveConversationId(null);
    setAiMessages([]);
    showToast('Started new conversation', 'info');
  }, [isAiStreaming]);

  const pendingTasksCount = tasks.filter(t => !t.completed).length;
  const activeNote = knowledge.find(k => k.id === selectedNoteId) || knowledge[0] || null;
  const activeDoc = knowledge.find(k => k.id === selectedDocId) || knowledge.find(k => k.type === 'document') || knowledge[1] || null;

  // Render Active Main View
  const renderMainView = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeView
            tasks={tasks}
            onToggleTask={handleToggleTask}
            knowledge={knowledge}
            projects={projects}
            activities={activities}
            onNavigate={handleSelectTab}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
            onOpenProject={handleOpenProject}
            onOpenAdd={() => setAddSheetOpen(true)}
            user={currentUser ?? undefined}
            onDeleteActivity={handleDeleteActivity}
          />
        );

      case 'knowledge':
        return (
          <KnowledgeView
            knowledge={knowledge}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
            onNewNote={() => handleSelectAddAction('note')}
            onDeleteNote={handleDeleteKnowledge}
            onAskAI={(item) => {
              handleSelectTab('ai');
              handleSendAIMessage(`Summarize key points and details from: "${item.title}"`);
            }}
            onTogglePin={handleTogglePin}
          />
        );

      case 'note-editor':
        if (!activeNote) {
          return (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>No Note Selected</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Please choose a note from Knowledge.</p>
              <button className="btn btn-primary btn-sm" onClick={() => handleSelectTab('knowledge')}>
                Back to Knowledge
              </button>
            </div>
          );
        }
        return (
          <NoteEditorView
            note={activeNote}
            onBack={() => handleSelectTab('knowledge')}
            onAskAIAboutNote={(title) => {
              handleSelectTab('ai');
              handleSendAIMessage(`Summarize key points and requirements from: "${title}"`);
            }}
            showToast={showToast}
            onSaveNote={handleSaveNote}
          />
        );

      case 'doc-viewer':
        if (!activeDoc) {
          return (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>No Document Selected</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Please choose a document from Knowledge.</p>
              <button className="btn btn-primary btn-sm" onClick={() => handleSelectTab('knowledge')}>
                Back to Knowledge
              </button>
            </div>
          );
        }
        return (
          <DocumentViewerView
            document={activeDoc}
            onBack={() => handleSelectTab('knowledge')}
            showToast={showToast}
          />
        );

      case 'tasks':
        return (
          <TasksView
            tasks={tasks}
            projects={projects}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            showToast={showToast}
          />
        );

      case 'projects':
      case 'project-detail':
        return (
          <ProjectsView
            projects={projects}
            tasks={tasks}
            knowledge={knowledge}
            selectedProjectId={currentTab === 'project-detail' ? selectedProjectId : null}
            onSelectProject={handleOpenProject}
            onToggleTask={handleToggleTask}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
            onCreateProject={handleCreateProject}
          />
        );

      case 'ai':
        return (
          <AIAssistantView
            messages={aiMessages}
            onSendMessage={handleSendAIMessage}
            onNavigate={setCurrentTab}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
            onOpenProject={handleOpenProject}
            onAttachFile={handleUploadFile}
            isStreaming={isAiStreaming}
            onStopStreaming={handleStopStreaming}
            onComposerFocusChange={setIsComposerFocused}
            onNewChat={handleNewChat}
          />
        );

      case 'settings':
        return (
          <SettingsView
            theme={theme}
            onToggleTheme={handleToggleTheme}
            showToast={showToast}
            user={currentUser ?? undefined}
            onUpdateUser={(updated) => {
              setCurrentUser(prev => prev ? { ...prev, ...updated } : prev);
              api.updateProfile(updated).catch(() => {});
            }}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={async () => {
              try {
                await api.logout();
              } catch { /* cookies are already cleared server-side */ }
              // Clear all user state — this triggers the auth gate render branch
              setCurrentUser(null);
              setTasks([]);
              setKnowledge([]);
              setProjects([]);
              setActivities([]);
              setAiMessages([]);
              setActiveConversationId(null);
              setConversations([]);
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
              }
              setIsAiStreaming(false);
            }}
          />
        );

      default:
        return null;
    }
  };

  // ── /reset-password route — intercept before any auth gate ────────────────
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
    return (
      <div className="app-shell-root" style={{ background: 'var(--bg-app)', minHeight: '100dvh' }}>
        <ResetPasswordView
          onGoToLogin={() => {
            window.history.pushState(null, '', '/');
            setAuthModalOpen(true);
          }}
          onGoToForgot={() => {
            window.history.pushState(null, '', '/');
            setAuthModalOpen(true);
            // AuthModal initialMode='forgot' will be propagated via the open handler
          }}
        />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </div>
    );
  }

  // Show loading spinner while checking session
  if (isAuthLoading) {
    return (
      <div className="app-shell-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-app)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'inherit' }}>Loading workspace…</div>
      </div>
    );
  }

  // Force auth modal when not authenticated
  if (!currentUser) {
    return (
      <div className="app-shell-root" style={{ background: 'var(--bg-app)', height: '100dvh' }}>
        <AuthModal
          isOpen={true}
          onClose={() => {}}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            setAuthModalOpen(false);
            setIsAuthLoading(false);
            refreshWorkspaceData();
          }}
          showToast={showToast}
        />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </div>
    );
  }

  return (
    <div className={`app-shell-root ${isComposerFocused ? 'composer-focused' : ''}`}>
      {isMobile ? (
        /* =========================================================================
            MOBILE APP SHELL (Context Header + Touch Canvas + Bottom Nav)
            ========================================================================= */
        <div className={`mobile-app-shell ${isComposerFocused ? 'composer-focused' : ''}`}>
          <MobileHeader
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            onOpenSearch={() => setCommandPaletteOpen(true)}
            onOpenAdd={() => setAddSheetOpen(true)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onOpenNotifications={() => setMobileNotificationsOpen(true)}
            unreadCount={notificationController.unreadCount}
            backAction={
              currentTab === 'note-editor' || currentTab === 'doc-viewer'
                ? () => handleSelectTab('knowledge')
                : currentTab === 'project-detail'
                ? () => handleSelectTab('projects')
                : undefined
            }
          />

          <main className={`mobile-main-canvas ${currentTab === 'ai' ? 'is-ai-view' : ''}`} role="main">
            <ErrorBoundary onReset={() => handleSelectTab('home')}>
              {renderMainView()}
            </ErrorBoundary>
          </main>

          <MobileBottomNav
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            onOpenAdd={() => setAddSheetOpen(true)}
            onOpenSearch={() => setCommandPaletteOpen(true)}
            onOpenMoreMenu={() => setMoreDrawerOpen(true)}
            isHidden={isComposerFocused}
          />
        </div>
      ) : (
        /* =========================================================================
            DESKTOP APP SHELL (Sidebar + Top Bar + Canvas + Context Panel)
            ========================================================================= */
        <div className="desktop-app-shell">
          <DesktopSidebar
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            pendingTasksCount={pendingTasksCount}
            user={currentUser}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
            pinnedItems={pinnedItems}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
          />

          <div className="desktop-workspace-column">
            <DesktopTopBar
              currentTab={currentTab}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onQuickAdd={() => setAddSheetOpen(true)}
              rightPanelOpen={rightPanelOpen}
              onToggleRightPanel={() => setRightPanelOpen(prev => !prev)}
              showRightPanelToggle={currentTab !== 'note-editor' && currentTab !== 'doc-viewer'}
              onNavigate={handleSelectTab}
              onOpenNote={handleOpenNote}
              onOpenDoc={handleOpenDoc}
              tasks={tasks}
              activities={activities}
              notificationController={notificationController}
            />

            <div className="desktop-canvas-row">
              <main className="desktop-main-canvas" role="main">
                <ErrorBoundary onReset={() => handleSelectTab('home')}>
                  {renderMainView()}
                </ErrorBoundary>
              </main>

              {currentTab !== 'note-editor' && currentTab !== 'doc-viewer' && (
                <DesktopRightPanel
                  isOpen={rightPanelOpen}
                  onClose={() => setRightPanelOpen(false)}
                  currentTab={currentTab}
                  onNavigate={setCurrentTab}
                  onOpenNote={handleOpenNote}
                  onOpenDoc={handleOpenDoc}
                  tasks={tasks}
                  knowledge={knowledge}
                  onAskAI={(prompt) => {
                    setCurrentTab('ai');
                    handleSendAIMessage(prompt);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GLOBAL MODALS, COMMAND PALETTE, BOTTOM SHEETS, AND TOASTS
          ========================================================================= */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setCurrentTab}
        onOpenNote={handleOpenNote}
        onOpenDoc={handleOpenDoc}
        onOpenProject={handleOpenProject}
      />

      <AddBottomSheet
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onSelectAction={handleSelectAddAction}
        onUploadFile={handleUploadFile}
      />

      <MobileMoreDrawer
        isOpen={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        onNavigate={setCurrentTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenProfile={() => setProfileOpen(true)}
        tasks={tasks}
        projects={projects}
        knowledge={knowledge}
        user={currentUser}
      />

      <MobileNotificationSheet
        isOpen={mobileNotificationsOpen}
        onClose={() => setMobileNotificationsOpen(false)}
        notifications={notificationController.notifications}
        onMarkAllAsRead={notificationController.markAllAsRead}
        onMarkAsRead={notificationController.markAsRead}
        onDismiss={notificationController.dismiss}
        onNavigate={handleSelectTab}
        onOpenNote={handleOpenNote}
        onOpenDoc={handleOpenDoc}
      />

      {profileOpen && (
        <ProfileView
          user={currentUser ?? undefined}
          onBack={() => setProfileOpen(false)}
          onUpdateUser={(updated) => {
            setCurrentUser(prev => prev ? { ...prev, ...updated } : prev);
            api.updateProfile(updated).catch(() => {});
          }}
          onLogout={async () => {
            await api.logout();
            showToast('Signed out of workspace', 'info');
            setCurrentUser(null);
            setProfileOpen(false);
            setAuthModalOpen(true);
          }}
          showToast={showToast}
          taskCount={tasks.filter(t => !t.completed).length}
          knowledgeCount={knowledge.length}
          projectCount={projects.length}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
          refreshWorkspaceData();
        }}
        showToast={showToast}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
      />
    </div>
  );
};

export default App;
