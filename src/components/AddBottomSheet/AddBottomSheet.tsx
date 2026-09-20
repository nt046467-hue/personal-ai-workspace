import React, { useEffect } from 'react';
import { FileText, CheckSquare, Upload, Bookmark, Lightbulb, FolderKanban, X } from 'lucide-react';
import './AddBottomSheet.css';

export type AddActionType = 'note' | 'task' | 'upload' | 'bookmark' | 'idea' | 'project';

interface AddBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: AddActionType) => void;
  onUploadFile?: (file: File) => void;
}

export const AddBottomSheet: React.FC<AddBottomSheetProps> = ({
  isOpen,
  onClose,
  onSelectAction,
  onUploadFile,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { type: 'note' as AddActionType, label: 'Note', desc: 'Create a rich document or scratchpad', icon: <FileText size={20} /> },
    { type: 'task' as AddActionType, label: 'Task', desc: 'Add actionable item with due date', icon: <CheckSquare size={20} /> },
    { type: 'upload' as AddActionType, label: 'Upload File', desc: 'PDF, research brief, or spec', icon: <Upload size={20} /> },
    { type: 'bookmark' as AddActionType, label: 'Bookmark', desc: 'Save external link or reference', icon: <Bookmark size={20} /> },
    { type: 'idea' as AddActionType, label: 'Quick Idea', desc: 'Capture thought to triage later', icon: <Lightbulb size={20} /> },
    { type: 'project' as AddActionType, label: 'Project', desc: 'Start dedicated initiative workspace', icon: <FolderKanban size={20} /> },
  ];

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div 
        className="bottom-sheet-container" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create new item"
      >
        {/* Drag handle for native mobile feel */}
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>

        <div className="sheet-header">
          <h2 className="sheet-title">Create New</h2>
          <button className="btn-icon sheet-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onUploadFile) {
              onUploadFile(file);
              onClose();
            }
          }}
        />

        <div className="sheet-options-grid">
          {actions.map((act) => (
            <button
              key={act.type}
              className="sheet-option-item"
              onClick={() => {
                if (act.type === 'upload' && onUploadFile) {
                  fileInputRef.current?.click();
                } else {
                  onSelectAction(act.type);
                  onClose();
                }
              }}
            >
              <div className="sheet-option-icon">
                {act.icon}
              </div>
              <div className="sheet-option-text">
                <span className="sheet-option-label">{act.label}</span>
                <span className="sheet-option-desc">{act.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
