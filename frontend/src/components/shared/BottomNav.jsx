export default function BottomNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'today',    label: 'Today',    icon: '◎' },
    { id: 'week',     label: 'Week',     icon: '▦' },
    { id: 'tips',     label: 'Tips',     icon: '◈' },
    { id: 'calendar', label: 'Calendar', icon: '▦' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
