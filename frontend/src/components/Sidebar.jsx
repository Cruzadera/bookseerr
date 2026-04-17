function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="m19.4 13 .1-1-.1-1 2-1.6-2-3.4-2.4 1a7.9 7.9 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.9 7.9 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6-.1 1 .1 1-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M6 4h12a2 2 0 0 1 2 2v12l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export default function Sidebar({
  t,
  activePage,
  collapsed,
  onToggle,
  onNavigate,
}) {
  const navigation = [
    { id: "home", label: t("ui.nav.home"), icon: <HomeIcon /> },
    { id: "settings", label: t("ui.nav.settings"), icon: <SettingsIcon /> },
  ];

  return (
    <aside className={`sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="brand-block">
        <button
          type="button"
          className="brand-mark"
          aria-label={collapsed ? t("ui.sidebar.expand") : t("ui.sidebar.collapse")}
          aria-pressed={collapsed}
          onClick={onToggle}
        >
          B
        </button>
        <div className="brand-copy">
          <p className="eyebrow">{t("ui.manager")}</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={t("ui.nav.primary")}>
        {navigation.map((item) => {
          const isActive = item.id === activePage;

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-text">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="nav-link nav-link-muted" disabled>
          <span className="nav-icon" aria-hidden="true">
            <BookmarkIcon />
          </span>
          <span className="nav-text">{t("ui.nav.morePages")}</span>
        </button>
      </div>
    </aside>
  );
}
