import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Circle,
  FileText, 
  Bot, 
  ChevronRight,
  ArrowLeft,
  X,
  FolderKanban
} from 'lucide-react';
import type { Project, Task, KnowledgeItem } from '../../data/mockData';
import './ProjectsView.css';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  knowledge: KnowledgeItem[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onToggleTask: (id: string) => void;
  onOpenNote: (id: string) => void;
  onOpenDoc: (id: string) => void;
  onCreateProject?: (project: { name: string; description: string; color?: string; category?: string; deadline?: string }) => Promise<void>;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  tasks,
  knowledge,
  selectedProjectId,
  onSelectProject,
  onToggleTask,
  onOpenNote,
  onOpenDoc,
  onCreateProject,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('AI & Core Platform');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newDeadline, setNewDeadline] = useState('Nov 30, 2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'tasks' | 'knowledge' | 'ai'>('overview');

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // If a project is selected, render the dedicated Project Detail workspace
  if (selectedProject) {
    const projectTasks = tasks.filter(t => t.projectId === selectedProject.id || t.project.toLowerCase().includes(selectedProject.name.toLowerCase()));
    // Filter knowledge items that belong to this project (by project_id field)
    const projectKnowledgeLinked = knowledge.filter(k => k.projectId === selectedProject.id);
    // Fall back to recently updated items if project has no direct links
    const projectKnowledge = projectKnowledgeLinked.length > 0
      ? projectKnowledgeLinked.slice(0, 6)
      : knowledge.slice(0, 3);

    return (
      <div className="project-detail-view">
        {/* Project Header */}
        <div className="project-detail-header">
          <button className="btn-icon back-to-projects-btn" onClick={() => onSelectProject(null)}>
            <ArrowLeft size={18} />
          </button>
          
          <div className="project-header-info">
            <div className="project-title-row">
              <div className="project-color-badge" style={{ backgroundColor: selectedProject.color }} />
              <h1 className="project-headline">{selectedProject.name}</h1>
              <span className={`badge ${selectedProject.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                {selectedProject.status.replace('_', ' ')}
              </span>
            </div>
            <p className="project-sub-desc">{selectedProject.description}</p>
          </div>

          <div className="project-header-stats">
            <div className="stat-pill">
              <span className="stat-label">Progress</span>
              <span className="stat-val">{selectedProject.progress}%</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Deadline</span>
              <span className="stat-val">{selectedProject.deadline}</span>
            </div>
          </div>
        </div>

        {/* Project Workspace Tabs (Horizontally scrollable on mobile, never ugly multi-row wrapping) */}
        <div className="project-tabs-bar">
          <div className="project-tabs-scroll">
            <button 
              className={`project-tab-btn ${activeDetailTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`project-tab-btn ${activeDetailTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('tasks')}
            >
              Tasks ({projectTasks.length})
            </button>
            <button 
              className={`project-tab-btn ${activeDetailTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('knowledge')}
            >
              Knowledge & Specs ({projectKnowledge.length})
            </button>
            <button 
              className={`project-tab-btn ${activeDetailTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('ai')}
            >
              <Bot size={13} className="tab-ai-icon" />
              Project AI
            </button>
          </div>
        </div>

        {/* Tab Content Panes */}
        <div className="project-tab-body">
          {activeDetailTab === 'overview' && (
            <div className="project-overview-grid">
              <div className="card overview-card">
                <h3 className="card-heading">Milestone Completion</h3>
                <div className="overview-progress-block">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${selectedProject.progress}%`, backgroundColor: selectedProject.color }} />
                  </div>
                  <div className="progress-numbers">
                    <span>{selectedProject.openTasksCount} open requirements</span>
                    <span>{selectedProject.progress}% completed</span>
                  </div>
                </div>
              </div>

              <div className="card overview-card">
                <h3 className="card-heading">Key Project Invariants</h3>
                <ul className="invariants-list">
                  <li>Zero unauthenticated data reads via Firestore tenant boundary.</li>
                  <li>p95 latency budgeted strictly below 45ms end-to-end.</li>
                  <li>Touch target compliance validated for iOS 18 Safari and Android 15.</li>
                </ul>
              </div>
            </div>
          )}

          {activeDetailTab === 'tasks' && (
            <div className="project-tasks-list">
              {projectTasks.length === 0 ? (
                <div className="empty-subtext">No open tasks linked to this project.</div>
              ) : (
                projectTasks.map(t => (
                  <div key={t.id} className="home-task-row">
                    <button 
                      className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                      onClick={() => onToggleTask(t.id)}
                    >
                      {t.completed ? <CheckCircle2 size={18} className="task-check-icon checked" /> : <Circle size={18} className="task-check-icon" />}
                    </button>
                    <div className="task-row-info">
                      <span className={`task-row-title ${t.completed ? 'completed' : ''}`}>{t.title}</span>
                      <span className="task-due-tag">{t.dueDate}</span>
                    </div>
                    <span className={`badge ${t.priority === 'high' ? 'badge-danger' : 'badge-default'}`}>
                      {t.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeDetailTab === 'knowledge' && (
            <div className="project-docs-list">
              {projectKnowledge.map(doc => (
                <div 
                  key={doc.id} 
                  className="recent-doc-card"
                  onClick={() => doc.type === 'document' ? onOpenDoc(doc.id) : onOpenNote(doc.id)}
                >
                  <div className="doc-icon-box">
                    <FileText size={16} />
                  </div>
                  <div className="doc-card-info">
                    <span className="doc-card-title">{doc.title}</span>
                    <span className="doc-card-sub">{doc.tags.join(', ')} • {doc.updatedAt}</span>
                  </div>
                  <span className="badge badge-default">{doc.type}</span>
                </div>
              ))}
            </div>
          )}

          {activeDetailTab === 'ai' && (
            <div className="card project-ai-summary-card">
              <div className="ai-title-wrap">
                <Bot size={16} className="accent-glyph" />
                <h3>Project Context & Risk Assessment</h3>
              </div>
              <p className="project-ai-text">
                Based on current velocity for <strong>{selectedProject.name}</strong>, tasks scheduled for today are on track. 
                The next critical milestone is the verification of tenant boundary isolation rules before the upcoming deadline on <strong>{selectedProject.deadline}</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      if (onCreateProject) {
        await onCreateProject({
          name: newName.trim(),
          description: newDescription.trim(),
          category: newCategory,
          color: newColor,
          deadline: newDeadline || 'Upcoming',
        });
      }
      setIsCreateModalOpen(false);
      setNewName('');
      setNewDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const COLOR_OPTIONS = [
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Sky', value: '#0ea5e9' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Rose', value: '#ec4899' },
    { label: 'Purple', value: '#8b5cf6' },
  ];

  // Projects Overview List / Grid
  return (
    <div className="projects-view-container">
      <div className="projects-view-header">
        <div>
          <h1 className="projects-heading">Engineering & Product Initiatives</h1>
          <p className="projects-subheading">Track milestones, related architecture specs, and active deliverables.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={14} />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="empty-projects-state">
          <FolderKanban size={40} className="empty-projects-icon" />
          <h3>No projects in workspace</h3>
          <p>Create initiatives to organize your deliverables, architecture notes, and actionable tasks.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={14} />
            <span>Create First Project</span>
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <div 
              key={p.id} 
              className="project-card"
              onClick={() => onSelectProject(p.id)}
            >
              <div className="project-card-top">
                <div className="project-card-badge-row">
                  <div className="project-color-dot" style={{ backgroundColor: p.color }} />
                  <span className="project-category-text">{p.category}</span>
                </div>
                <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                  {p.status.replace('_', ' ')}
                </span>
              </div>

              <h2 className="project-card-name">{p.name}</h2>
              <p className="project-card-desc">{p.description}</p>

              <div className="project-card-progress">
                <div className="proj-progress-track">
                  <div 
                    className="proj-progress-fill" 
                    style={{ width: `${p.progress}%`, backgroundColor: p.color }} 
                  />
                </div>
                <div className="project-card-progress-labels">
                  <span>{p.progress}% completed</span>
                  <span>{p.openTasksCount} tasks open</span>
                </div>
              </div>

              <div className="project-card-footer">
                <span className="project-deadline">
                  <Calendar size={12} style={{ marginRight: 4 }} /> Due {p.deadline}
                </span>
                <span className="project-open-link">
                  Workspace <ChevronRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="task-add-modal project-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-header">
              <h2>New Project Initiative</h2>
              <button className="btn-icon" onClick={() => setIsCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="add-task-form">
              <div className="form-group">
                <label>Project Name *</label>
                <input 
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Distributed Consensus Engine"
                  autoFocus
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Category</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    <option value="AI & Core Platform">AI & Core Platform</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Mobile App">Mobile App</option>
                    <option value="Design System">Design System</option>
                    <option value="Security & Compliance">Security & Compliance</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Deadline</label>
                  <input 
                    type="text"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    placeholder="e.g. Nov 30, 2026"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Accent Color</label>
                <div className="color-swatches-row">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`color-swatch-btn ${newColor === c.value ? 'selected' : ''}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setNewColor(c.value)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Description & Scope</label>
                <textarea 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Summarize initiative goals, technical constraints, and deliverables..."
                  rows={2}
                />
              </div>

              <div className="add-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={!newName.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Initiative'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
