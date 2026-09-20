import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Circle,
  FileText, 
  Bot, 
  ChevronRight,
  ArrowLeft
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
}) => {
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'tasks' | 'knowledge' | 'ai'>('overview');

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // If a project is selected, render the dedicated Project Detail workspace
  if (selectedProject) {
    const projectTasks = tasks.filter(t => t.projectId === selectedProject.id || t.project.toLowerCase().includes(selectedProject.name.toLowerCase()));
    const projectKnowledge = knowledge.slice(0, 3);

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

  // Projects Overview List / Grid
  return (
    <div className="projects-view-container">
      <div className="projects-view-header">
        <div>
          <h1 className="projects-heading">Engineering & Product Initiatives</h1>
          <p className="projects-subheading">Track milestones, related architecture specs, and active deliverables.</p>
        </div>
        <button className="btn btn-primary btn-sm">
          <Plus size={14} />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
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
    </div>
  );
};
