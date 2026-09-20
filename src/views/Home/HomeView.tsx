import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  ArrowRight, 
  ChevronRight,
  Bot, 
  FileText, 
  FolderKanban, 
  CheckSquare,
  Plus
} from 'lucide-react';
import type { Task, KnowledgeItem, Project, Activity } from '../../data/mockData';
import { CURRENT_USER } from '../../data/mockData';
import type { NavigationTab } from '../../components/AppShell/DesktopSidebar';
import './HomeView.css';

interface HomeViewProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  knowledge: KnowledgeItem[];
  projects: Project[];
  activities: Activity[];
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote: (id: string) => void;
  onOpenDoc: (id: string) => void;
  onOpenProject: (id: string) => void;
  onOpenAdd: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  tasks,
  onToggleTask,
  knowledge,
  projects,
  activities,
  onNavigate,
  onOpenNote,
  onOpenDoc,
  onOpenProject,
  onOpenAdd,
}) => {
  const pendingTasks = tasks.filter(t => !t.completed);
  const todayTasks = pendingTasks.filter(t => t.dueCategory === 'today');
  const recentDocs = knowledge.slice(0, 3);
  const activeProjects = projects.slice(0, 3);

  return (
    <div className="home-view-container">
      {/* =========================================================================
          DESKTOP LAYOUT (Structured, spacious, high information hierarchy)
          ========================================================================= */}
      <div className="home-desktop-layout">
        {/* Personalized Welcome Banner */}
        <div className="home-desktop-header">
          <div className="header-greeting-block">
            <h1 className="greeting-title">Good morning, {CURRENT_USER.name.split(' ')[0]}</h1>
            <p className="greeting-subtitle">
              You have <strong className="highlight-count">{todayTasks.length} tasks</strong> needing attention today across your active engineering projects.
            </p>
          </div>
          <div className="header-action-group">
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('ai')}>
              <Bot size={14} className="accent-glyph" />
              <span>Workspace AI Brief</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={onOpenAdd}>
              <Plus size={14} />
              <span>New Task or Note</span>
            </button>
          </div>
        </div>

        {/* Priority Grid: Tasks on left, Continue Working on right */}
        <div className="home-desktop-main-grid">
          {/* Left Column: Today's Focus Tasks */}
          <section className="dashboard-section card" aria-label="Today's Priority Tasks">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-heading">Today's Focus</h2>
                <span className="badge badge-accent">{todayTasks.length} Due</span>
              </div>
              <button className="section-action-link" onClick={() => onNavigate('tasks')}>
                View all tasks <ArrowRight size={13} />
              </button>
            </div>

            <div className="tasks-flow-list">
              {todayTasks.length === 0 ? (
                <div className="empty-subtext">All today's tasks are completed! Enjoy your focus time.</div>
              ) : (
                todayTasks.map((t) => (
                  <div key={t.id} className="home-task-row">
                    <button 
                      className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                      onClick={() => onToggleTask(t.id)}
                      aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                    >
                      {t.completed ? (
                        <CheckCircle2 size={18} className="task-check-icon checked" />
                      ) : (
                        <Circle size={18} className="task-check-icon" />
                      )}
                    </button>
                    <div className="task-row-info">
                      <span className={`task-row-title ${t.completed ? 'completed' : ''}`}>{t.title}</span>
                      <div className="task-row-meta">
                        <span className="task-project-tag">{t.project}</span>
                        <span className="meta-separator">•</span>
                        <span className="task-due-tag">
                          <Clock size={11} style={{ marginRight: 3 }} /> {t.dueDate}
                        </span>
                      </div>
                    </div>
                    <span className={`badge ${t.priority === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                      {t.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Right Column: Continue Working */}
          <section className="dashboard-section card" aria-label="Continue Working">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-heading">Continue Working</h2>
                <span className="badge badge-default">Recent</span>
              </div>
              <button className="section-action-link" onClick={() => onNavigate('knowledge')}>
                Open Library <ArrowRight size={13} />
              </button>
            </div>

            <div className="recent-knowledge-list">
              {recentDocs.map((item) => (
                <div 
                  key={item.id} 
                  className="recent-doc-card"
                  onClick={() => item.type === 'document' ? onOpenDoc(item.id) : onOpenNote(item.id)}
                >
                  <div className="doc-icon-box">
                    <FileText size={17} />
                  </div>
                  <div className="doc-card-info">
                    <span className="doc-card-title">{item.title}</span>
                    <span className="doc-card-sub">{item.type} · {item.tags.join(', ')} • {item.updatedAt}</span>
                  </div>
                  <ChevronRight size={14} className="doc-card-arrow" />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Lower Grid: Active Projects & Activity Timeline */}
        <div className="home-desktop-secondary-grid">
          {/* Active Projects Preview */}
          <section className="dashboard-section card" aria-label="Active Projects">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-heading">Active Projects</h2>
              </div>
              <button className="section-action-link" onClick={() => onNavigate('projects')}>
                All projects <ArrowRight size={13} />
              </button>
            </div>

            <div className="desktop-projects-summary">
              {activeProjects.map((p) => (
                <div 
                  key={p.id} 
                  className="project-summary-card"
                  onClick={() => onOpenProject(p.id)}
                >
                  <div className="proj-summary-top">
                    <div className="proj-title-wrap">
                      <div className="project-color-dot" style={{ backgroundColor: p.color }} />
                      <span className="proj-name">{p.name}</span>
                    </div>
                    <span className="proj-percent">{p.progress}%</span>
                  </div>
                  <p className="proj-desc">{p.description}</p>
                  <div className="proj-progress-track">
                    <div 
                      className="proj-progress-fill" 
                      style={{ width: `${p.progress}%`, backgroundColor: p.color }} 
                    />
                  </div>
                  <div className="proj-summary-footer">
                    <span>{p.openTasksCount} open tasks</span>
                    <span>Due {p.deadline}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activity Timeline */}
          <section className="dashboard-section card" aria-label="Recent Activity">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-heading">Recent Workspace Activity</h2>
              </div>
            </div>

            <div className="activity-feed">
              {activities.map((act) => (
                <div key={act.id} className="activity-feed-item">
                  <div className="activity-indicator" />
                  <div className="activity-content">
                    <span className="activity-title">{act.title}</span>
                    <span className="activity-detail">{act.detail}</span>
                    <span className="activity-time">{act.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* =========================================================================
          MOBILE LAYOUT (Purpose-built touch hierarchy, daily focus assistant)
          ========================================================================= */}
      <div className="home-mobile-layout">
        {/* Daily Focus Header */}
        <div className="mobile-focus-hero">
          <div className="mobile-hero-text">
            <h1 className="mobile-hero-title">Good morning</h1>
            <p className="mobile-hero-highlight">
              <strong>{todayTasks.length} tasks</strong> need attention today
            </p>
          </div>
          <button className="mobile-hero-add-btn" onClick={onOpenAdd} aria-label="Add item">
            <Plus size={18} />
            <span>Add</span>
          </button>
        </div>

        {/* Quick Workspace Shortcuts Row */}
        <div className="mobile-quick-actions-bar">
          <button className="mobile-chip-btn" onClick={() => onNavigate('ai')}>
            <Bot size={14} className="accent-glyph" />
            <span>AI Brief</span>
          </button>
          <button className="mobile-chip-btn" onClick={() => onNavigate('tasks')}>
            <CheckSquare size={14} />
            <span>Tasks ({todayTasks.length})</span>
          </button>
          <button className="mobile-chip-btn" onClick={() => onNavigate('projects')}>
            <FolderKanban size={14} />
            <span>Projects</span>
          </button>
        </div>

        {/* Mobile Today's Tasks Section */}
        <section className="mobile-section" aria-label="Today's Tasks">
          <div className="mobile-section-header">
            <h2 className="mobile-section-title">Today's Tasks</h2>
            <button className="mobile-link" onClick={() => onNavigate('tasks')}>
              View all
            </button>
          </div>

          <div className="mobile-task-card-list">
            {todayTasks.map((t) => (
              <div key={t.id} className="mobile-task-card">
                <button 
                  className={`mobile-check-btn ${t.completed ? 'checked' : ''}`}
                  onClick={() => onToggleTask(t.id)}
                  aria-label="Toggle task"
                >
                  {t.completed ? (
                    <CheckCircle2 size={20} className="task-check-icon checked" />
                  ) : (
                    <Circle size={20} className="task-check-icon" />
                  )}
                </button>
                <div className="mobile-task-details">
                  <span className={`mobile-task-title ${t.completed ? 'completed' : ''}`}>
                    {t.title}
                  </span>
                  <div className="mobile-task-sub">
                    <span className="mobile-proj-pill">{t.project}</span>
                    <span className="mobile-due-text">{t.dueDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mobile Continue Section */}
        <section className="mobile-section" aria-label="Continue Reading">
          <div className="mobile-section-header">
            <h2 className="mobile-section-title">Continue Reading</h2>
            <button className="mobile-link" onClick={() => onNavigate('knowledge')}>
              Knowledge
            </button>
          </div>

          <div className="mobile-horizontal-scroll-list">
            {recentDocs.map((doc) => (
              <div 
                key={doc.id} 
                className="mobile-scroll-card"
                onClick={() => doc.type === 'document' ? onOpenDoc(doc.id) : onOpenNote(doc.id)}
              >
                <div className="scroll-card-icon">
                  <FileText size={18} />
                </div>
                <span className="scroll-card-title">{doc.title}</span>
                <span className="scroll-card-meta">{doc.updatedAt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Mobile Active Project Milestones */}
        <section className="mobile-section" aria-label="Active Milestones">
          <div className="mobile-section-header">
            <h2 className="mobile-section-title">Active Projects</h2>
            <button className="mobile-link" onClick={() => onNavigate('projects')}>
              See all
            </button>
          </div>

          <div className="mobile-projects-list">
            {activeProjects.map((p) => (
              <div 
                key={p.id} 
                className="mobile-project-item"
                onClick={() => onOpenProject(p.id)}
              >
                <div className="mobile-proj-row">
                  <span className="mobile-proj-name">{p.name}</span>
                  <span className="mobile-proj-percent">{p.progress}%</span>
                </div>
                <div className="proj-progress-track mobile-track">
                  <div 
                    className="proj-progress-fill" 
                    style={{ width: `${p.progress}%`, backgroundColor: p.color }} 
                  />
                </div>
                <div className="mobile-proj-meta">
                  <span>{p.openTasksCount} open tasks</span>
                  <span>Due {p.deadline}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
