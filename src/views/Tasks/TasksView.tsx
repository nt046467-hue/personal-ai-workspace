import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Trash2, 
  X, 
  CheckSquare
} from 'lucide-react';
import type { Task } from '../../data/mockData';
import './TasksView.css';

interface TasksViewProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onDeleteTask: (id: string) => void;
  showToast: (msg: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  showToast,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('Personal AI Workspace');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newDueDate, setNewDueDate] = useState('Today, 6:00 PM');
  const [newCategory, setNewCategory] = useState<'today' | 'tomorrow' | 'upcoming'>('today');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask({
      title: newTitle,
      project: newProject,
      projectId: 'p-1',
      dueDate: newDueDate,
      dueCategory: newCategory,
      priority: newPriority,
    });
    setNewTitle('');
    setIsAddModalOpen(false);
    showToast('Task created');
  };

  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'today') return !t.completed && t.dueCategory === 'today';
    if (activeFilter === 'upcoming') return !t.completed && (t.dueCategory === 'tomorrow' || t.dueCategory === 'upcoming');
    if (activeFilter === 'completed') return t.completed;
    return true;
  });

  const todayCount = tasks.filter(t => !t.completed && t.dueCategory === 'today').length;
  const upcomingCount = tasks.filter(t => !t.completed && (t.dueCategory === 'tomorrow' || t.dueCategory === 'upcoming')).length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="tasks-view-container">
      {/* Top Toolbar */}
      <div className="tasks-toolbar">
        <div className="tasks-filter-tabs">
          <button 
            className={`task-tab ${activeFilter === 'today' ? 'active' : ''}`}
            onClick={() => setActiveFilter('today')}
          >
            <span>Today</span>
            <span className="tab-count-badge">{todayCount}</span>
          </button>
          <button 
            className={`task-tab ${activeFilter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveFilter('upcoming')}
          >
            <span>Upcoming</span>
            <span className="tab-count-badge">{upcomingCount}</span>
          </button>
          <button 
            className={`task-tab ${activeFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            <span>Completed</span>
            <span className="tab-count-badge">{completedCount}</span>
          </button>
          <button 
            className={`task-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <span>All Tasks</span>
          </button>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={14} />
          <span>Add Task</span>
        </button>
      </div>

      {/* Tasks List */}
      <div className="tasks-list-scroll">
        {filteredTasks.length === 0 ? (
          <div className="empty-tasks-placeholder">
            <CheckSquare size={36} className="empty-tasks-icon" />
            <h3>No tasks in this view</h3>
            <p>You're completely clear. Add an actionable item when you're ready.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={14} /> Add Task
            </button>
          </div>
        ) : (
          <div className="task-rows-stack">
            {filteredTasks.map((t) => (
              <div 
                key={t.id} 
                className={`task-item-row ${t.completed ? 'is-completed' : ''}`}
                onClick={() => setSelectedTask(t)}
              >
                {/* Checkbox */}
                <button 
                  className={`task-check-button ${t.completed ? 'checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(t.id);
                  }}
                  aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {t.completed ? (
                    <CheckCircle2 size={19} className="check-svg checked" />
                  ) : (
                    <Circle size={19} className="check-svg" />
                  )}
                </button>

                {/* Content */}
                <div className="task-text-col">
                  <span className="task-heading">{t.title}</span>
                  <div className="task-tags-row">
                    <span className="project-badge">{t.project}</span>
                    <span className="meta-sep">•</span>
                    <span className="date-badge">
                      <Clock size={11} style={{ marginRight: 3 }} /> {t.dueDate}
                    </span>
                    {t.notes && (
                      <>
                        <span className="meta-sep">•</span>
                        <span className="task-has-notes">Notes attached</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Priority & Actions */}
                <div className="task-meta-right">
                  <span className={`badge ${
                    t.priority === 'high' ? 'badge-danger' : 
                    t.priority === 'medium' ? 'badge-warning' : 'badge-default'
                  }`}>
                    {t.priority}
                  </span>

                  {/* Delete */}
                  <button 
                    className="btn-icon task-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTask(t.id);
                    }}
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Details Modal / Bottom Sheet */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="task-details-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle-bar hide-desktop">
              <div className="sheet-handle" />
            </div>

            <div className="task-sheet-top">
              <div className="task-sheet-title-row">
                <button 
                  className={`task-check-button ${selectedTask.completed ? 'checked' : ''}`}
                  onClick={() => onToggleTask(selectedTask.id)}
                >
                  {selectedTask.completed ? <CheckCircle2 size={20} className="check-svg checked" /> : <Circle size={20} />}
                </button>
                <h2 className="task-detail-title">{selectedTask.title}</h2>
              </div>
              <button className="btn-icon" onClick={() => setSelectedTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="task-details-fields">
              <div className="detail-field-row">
                <span className="field-label">Project:</span>
                <span className="field-value">{selectedTask.project}</span>
              </div>
              <div className="detail-field-row">
                <span className="field-label">Due Date:</span>
                <span className="field-value">{selectedTask.dueDate}</span>
              </div>
              <div className="detail-field-row">
                <span className="field-label">Priority:</span>
                <span className={`badge ${selectedTask.priority === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                  {selectedTask.priority.toUpperCase()}
                </span>
              </div>
              {selectedTask.notes && (
                <div className="detail-notes-block">
                  <span className="field-label">Notes & Specifications:</span>
                  <p className="detail-notes-text">{selectedTask.notes}</p>
                </div>
              )}
            </div>

            <div className="task-sheet-actions">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onDeleteTask(selectedTask.id);
                  setSelectedTask(null);
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onToggleTask(selectedTask.id);
                  setSelectedTask(null);
                }}
              >
                {selectedTask.completed ? 'Mark Incomplete' : 'Complete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="task-add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-header">
              <h2>New Actionable Task</h2>
              <button className="btn-icon" onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="add-task-form">
              <div className="form-group">
                <label>Task Title</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Audit API rate limit exponential backoff"
                  autoFocus
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Project</label>
                  <select value={newProject} onChange={(e) => setNewProject(e.target.value)}>
                    <option value="Personal AI Workspace">Personal AI Workspace</option>
                    <option value="Cloud Infrastructure Audit">Cloud Infrastructure Audit</option>
                    <option value="Fitness & Recovery Mobile App">Fitness & Recovery Mobile App</option>
                    <option value="Design System v2">Design System v2</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select 
                    value={newPriority} 
                    onChange={(e) => setNewPriority(e.target.value as any)}
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Due</label>
                  <input 
                    type="text" 
                    value={newDueDate} 
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select 
                    value={newCategory} 
                    onChange={(e) => setNewCategory(e.target.value as any)}
                  >
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
              </div>

              <div className="add-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newTitle.trim()}>
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
