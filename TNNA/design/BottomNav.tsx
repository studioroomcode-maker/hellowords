import React from 'react';

interface BottomNavProps {
  activeTab: string;
  onNavigate?: (tab: string) => void;
  onFabPress?: () => void;
}

const tabs = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'booking', icon: 'calendar_today', label: 'Booking' },
  { id: 'stats', icon: 'insights', label: 'Stats' },
  { id: 'profile', icon: 'settings', label: 'Profile' },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  onFabPress,
}) => {
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);

  const renderTab = (tab: (typeof tabs)[0]) => (
    <button
      key={tab.id}
      onClick={() => onNavigate?.(tab.id)}
      className={`flex flex-col items-center gap-1 transition-colors ${
        activeTab === tab.id ? 'text-primary' : 'text-slate-400'
      }`}
    >
      <span className="material-icons-round">{tab.icon}</span>
      <span className="text-[10px] font-bold">{tab.label}</span>
    </button>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-50">
      {leftTabs.map(renderTab)}

      {/* Center FAB */}
      <div className="relative -mt-10">
        <button
          onClick={onFabPress}
          className="w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform"
        >
          <span className="material-icons-round text-3xl">add</span>
        </button>
      </div>

      {rightTabs.map(renderTab)}
    </nav>
  );
};
