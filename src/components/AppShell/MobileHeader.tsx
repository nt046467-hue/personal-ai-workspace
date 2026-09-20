import React from 'react';
import { ChevronLeft, Search, Sun, Moon } from 'lucide-react';
import { MySpaceLogo } from '../Brand/MySpaceLogo';
import type { NavigationTab } from './DesktopSidebar';
import './MobileHeader.css';

interface MobileHeaderProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSearch: () => void;
  onOpenAdd: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  backAction?: () => void;
  titleOverride?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch,
  theme,
  onToggleTheme,
  backAction,
  titleOverride,
}) => {
  const isSubScreen = Boolean(backAction) || currentTab === 'note-editor' || currentTab === 'doc-viewer' || currentTab === 'project-detail';

  const getTitle = () => {
    if (titleOverride) return titleOverride;
    switch (currentTab) {
      case 'home':
        return 'MySpace AI';
      case 'knowledge':
        return 'Knowledge';
      case 'tasks':
        return 'Tasks';
      case 'projects':
        return 'Projects';
      case 'ai':
        return 'Assistant';
      case 'settings':
        return 'Settings';
      case 'note-editor':
        return 'Note';
      case 'doc-viewer':
        return 'Document';
      case 'project-detail':
        return 'Project';
      default:
        return 'MySpace AI';
    }
  };

  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        {isSubScreen ? (
          <button 
            className="btn-icon mobile-back-btn" 
            onClick={backAction || (() => onSelectTab('knowledge'))}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="mobile-brand" onClick={() => onSelectTab('home')} aria-label="Go to home">
            <div className="brand-icon-mobile">
              <MySpaceLogo size={26} />
            </div>
          </div>
        )}
        <h1 className="mobile-header-title">{getTitle()}</h1>
      </div>

      <div className="mobile-header-right">
        <button 
          className="btn-icon mobile-action-btn"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          <Search size={19} />
        </button>
        
        <button 
          className="btn-icon mobile-action-btn"
          onClick={onToggleTheme}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );
};
