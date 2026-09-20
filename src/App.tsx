import React, { useState, useEffect, useCallback } from 'react';
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

import { HomeView } from './views/Home/HomeView';
import { KnowledgeView } from './views/Knowledge/KnowledgeView';
import { NoteEditorView } from './views/NoteEditor/NoteEditorView';
import { DocumentViewerView } from './views/DocumentViewer/DocumentViewerView';
import { AIAssistantView } from './views/AIAssistant/AIAssistantView';
import { TasksView } from './views/Tasks/TasksView';
import { ProjectsView } from './views/Projects/ProjectsView';
import { SettingsView } from './views/Settings/SettingsView';

import { 
  INITIAL_TASKS, 
  INITIAL_KNOWLEDGE, 
  INITIAL_PROJECTS, 
  INITIAL_ACTIVITIES, 
  INITIAL_AI_MESSAGES,
  CURRENT_USER
} from './data/mockData';
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

export const App: React.FC = () => {
  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('k-1');
  const [selectedDocId, setSelectedDocId] = useState<string>('k-2');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // App Shell States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals & Drawers
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // User Session
  const [currentUser, setCurrentUser] = useState<UserSession>({
    id: 'u-nabin',
    email: CURRENT_USER.email,
    name: CURRENT_USER.name,
    avatar: CURRENT_USER.avatar,
    role: CURRENT_USER.role,
    workspaceId: 'w-nabin-eng',
    workspaceName: CURRENT_USER.workspaceName,
  });

  // Data Collections (initialized with defaults, then populated from backend)
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>(INITIAL_KNOWLEDGE);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(INITIAL_AI_MESSAGES);

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
      const [fetchedTasks, fetchedKnowledge, fetchedProjects, fetchedActivities] = await Promise.all([
        api.getTasks().catch(() => INITIAL_TASKS),
        api.getKnowledge().catch(() => INITIAL_KNOWLEDGE),
        api.getProjects().catch(() => INITIAL_PROJECTS),
        api.getActivities().catch(() => INITIAL_ACTIVITIES),
      ]);

      if (fetchedTasks) setTasks(fetchedTasks);
      if (fetchedKnowledge) setKnowledge(fetchedKnowledge);
      if (fetchedProjects) setProjects(fetchedProjects);
      if (fetchedActivities) setActivities(fetchedActivities);
    } catch (err) {
      console.error('[App] Error refreshing workspace data:', err);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // Try getting current authenticated user
        const me = await api.getMe();
        if (me) {
          setCurrentUser(me);
          if (me.theme) setTheme(me.theme as 'dark' | 'light');
        }
      } catch {
        // Automatically perform demo login as Nabin Thapa if not logged in
        try {
          const res = await api.login('nabin@workspace.ai', 'password123');
          setCurrentUser(res.user);
        } catch {
          // Keep offline state
        }
      } finally {
        await refreshWorkspaceData();
      }
    };

    initSession();
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

  // Navigation Helpers
  const handleOpenNote = (id: string) => {
    setSelectedNoteId(id);
    setCurrentTab('note-editor');
  };

  const handleOpenDoc = (id: string) => {
    setSelectedDocId(id);
    setCurrentTab('doc-viewer');
  };

  const handleOpenProject = (id: string | null) => {
    setSelectedProjectId(id);
    setCurrentTab(id ? 'project-detail' : 'projects');
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

  // AI Message Sending (Real Streaming SSE)
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

    setAiMessages(prev => [...prev, userMsg, initialAssistantMsg]);

    try {
      await api.streamAIChat(text, undefined, {
        onToken: (token) => {
          setAiMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].sender === 'assistant') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                timestamp: 'Just now',
                content: updated[lastIdx].content + token,
              };
            }
            return updated;
          });
        },
        onDone: (result) => {
          setAiMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].sender === 'assistant') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                timestamp: 'Just now',
                content: result.content,
                sources: result.sources,
                actions: result.actions,
              };
            }
            return updated;
          });
        },
        onError: (errMsg) => {
          showToast(errMsg, 'error');
        },
      });
    } catch (err: any) {
      showToast(err.message || 'AI streaming error', 'error');
    }
  };

  const pendingTasksCount = tasks.filter(t => !t.completed).length;
  const activeNote = knowledge.find(k => k.id === selectedNoteId) || knowledge[0] || INITIAL_KNOWLEDGE[0];
  const activeDoc = knowledge.find(k => k.id === selectedDocId) || knowledge[1] || INITIAL_KNOWLEDGE[1];

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
            onNavigate={setCurrentTab}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
            onOpenProject={handleOpenProject}
            onOpenAdd={() => setAddSheetOpen(true)}
          />
        );

      case 'knowledge':
        return (
          <KnowledgeView
            knowledge={knowledge}
            onOpenNote={handleOpenNote}
            onOpenDoc={handleOpenDoc}
            onNewNote={() => handleSelectAddAction('note')}
          />
        );

      case 'note-editor':
        return (
          <NoteEditorView
            note={activeNote}
            onBack={() => setCurrentTab('knowledge')}
            onAskAIAboutNote={(title) => {
              setCurrentTab('ai');
              handleSendAIMessage(`Summarize key points and requirements from: "${title}"`);
            }}
            showToast={showToast}
            onSaveNote={handleSaveNote}
          />
        );

      case 'doc-viewer':
        return (
          <DocumentViewerView
            document={activeDoc}
            onBack={() => setCurrentTab('knowledge')}
            showToast={showToast}
          />
        );

      case 'tasks':
        return (
          <TasksView
            tasks={tasks}
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
          />
        );

      case 'settings':
        return (
          <SettingsView
            theme={theme}
            onToggleTheme={handleToggleTheme}
            showToast={showToast}
            user={currentUser}
            onUpdateUser={(updated) => {
              setCurrentUser(prev => ({ ...prev, ...updated }));
              api.updateProfile(updated).catch(() => {});
            }}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={async () => {
              await api.logout();
              showToast('Signed out of workspace', 'info');
              setAuthModalOpen(true);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-shell-root">
      {/* =========================================================================
          DESKTOP APP SHELL (Sidebar + Top Bar + Canvas + Context Panel)
          ========================================================================= */}
      <div className="desktop-app-shell">
        <DesktopSidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          pendingTasksCount={pendingTasksCount}
          user={currentUser}
          onOpenAuth={() => setAuthModalOpen(true)}
        />

        <div className="desktop-workspace-column">
          <DesktopTopBar
            currentTab={currentTab}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onQuickAdd={() => setAddSheetOpen(true)}
            rightPanelOpen={rightPanelOpen}
            onToggleRightPanel={() => setRightPanelOpen(prev => !prev)}
            showRightPanelToggle={currentTab !== 'note-editor' && currentTab !== 'doc-viewer'}
          />

          <div className="desktop-canvas-row">
            <main className="desktop-main-canvas" role="main">
              {renderMainView()}
            </main>

            {currentTab !== 'note-editor' && currentTab !== 'doc-viewer' && (
              <DesktopRightPanel
                isOpen={rightPanelOpen}
                onClose={() => setRightPanelOpen(false)}
                currentTab={currentTab}
                onNavigate={setCurrentTab}
                onOpenNote={handleOpenNote}
                onOpenDoc={handleOpenDoc}
              />
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE APP SHELL (Context Header + Touch Canvas + Bottom Nav)
          ========================================================================= */}
      <div className="mobile-app-shell">
        <MobileHeader
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          onOpenAdd={() => setAddSheetOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          backAction={
            currentTab === 'note-editor' || currentTab === 'doc-viewer'
              ? () => setCurrentTab('knowledge')
              : currentTab === 'project-detail'
              ? () => setCurrentTab('projects')
              : undefined
          }
        />

        <main className={`mobile-main-canvas ${currentTab === 'ai' ? 'is-ai-view' : ''}`} role="main">
          {renderMainView()}
        </main>

        <MobileBottomNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenAdd={() => setAddSheetOpen(true)}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          onOpenMoreMenu={() => setMoreDrawerOpen(true)}
        />
      </div>

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
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
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
