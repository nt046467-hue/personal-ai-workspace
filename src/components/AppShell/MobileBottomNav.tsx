import React from 'react';
import { Home, Search, Plus, Bot, Menu } from 'lucide-react';
import type { NavigationTab } from './DesktopSidebar';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenAdd: () => void;
  onOpenSearch: () => void;
  onOpenMoreMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAdd,
  onOpenSearch,
  onOpenMoreMenu,
}) => {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <button 
        className={`mobile-nav-btn ${currentTab === 'home' ? 'active' : ''}`}
        onClick={() => onSelectTab('home')}
        aria-label="Home"
      >
        <Home size={20} className="nav-icon" />
        <span className="nav-label">Home</span>
      </button>

      <button 
        className="mobile-nav-btn"
        onClick={onOpenSearch}
        aria-label="Search"
      >
        <Search size={20} className="nav-icon" />
        <span className="nav-label">Search</span>
      </button>

      {/* Prominent Center Add Button */}
      <button 
        className="mobile-nav-add-btn"
        onClick={onOpenAdd}
        aria-label="Add item"
      >
        <div className="add-btn-inner">
          <Plus size={22} />
        </div>
      </button>

      <button 
        className={`mobile-nav-btn ${currentTab === 'ai' ? 'active' : ''}`}
        onClick={() => onSelectTab('ai')}
        aria-label="AI Assistant"
      >
        <Bot size={20} className="nav-icon ai-icon" />
        <span className="nav-label">AI</span>
      </button>

      <button 
        className={`mobile-nav-btn ${currentTab === 'tasks' || currentTab === 'projects' || currentTab === 'settings' || currentTab === 'knowledge' ? 'active' : ''}`}
        onClick={onOpenMoreMenu}
        aria-label="More options"
      >
        <Menu size={20} className="nav-icon" />
        <span className="nav-label">More</span>
      </button>
    </nav>
  );
};
