import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Activity, BarChart3, BookOpen, Clock3, GitBranch, LayoutDashboard, LibraryBig, Menu, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/resources', label: 'Resource Library', icon: LibraryBig },
  { to: '/popular', label: 'Popular', icon: Activity },
  { to: '/recent', label: 'Recent', icon: Clock3 },
  { to: '/dsa', label: 'Splay Tree', icon: GitBranch },
  { to: '/benchmarks', label: 'Benchmarks', icon: BarChart3 },
];

function currentSection(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/resources/new')) return 'New resource';
  if (pathname.includes('/edit')) return 'Edit resource';
  if (pathname.startsWith('/resources/')) return 'Resource details';
  return navigation.find((item) => item.to !== '/' && pathname.startsWith(item.to))?.label ?? 'ResourceSync';
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const apiStatus = useQuery({
    queryKey: ['api-health'],
    queryFn: api.health,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return (
    <div className="app-shell">
      {menuOpen ? <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><GitBranch size={22} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>Resource<span className="brand-accent">Sync</span></strong><small>Academic resource system</small></span>
          <button className="icon-button sidebar-close" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `side-link${isActive ? ' side-link-active' : ''}`}>
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`connection-status ${apiStatus.isSuccess ? 'connection-online' : apiStatus.isError ? 'connection-offline' : ''}`} role="status" aria-live="polite">
            <span className="status-dot" aria-hidden="true" />
            <span>{apiStatus.isSuccess ? 'API connected' : apiStatus.isError ? 'API unavailable' : 'Checking API'}</span>
          </div>
          <div className="sidebar-note"><BookOpen size={15} aria-hidden="true" /><span>Search by resource name. The Java tree handles access.</span></div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div className="topbar-context"><span className="context-root">ResourceSync</span><span className="context-divider">/</span><span>{currentSection(location.pathname)}</span></div>
          <Link to="/resources" className="topbar-search"><Search size={16} aria-hidden="true" /><span>Search the library</span></Link>
        </header>
        <main className="main-content" id="main-content">
          <Outlet />
        </main>
        <footer className="app-footer"><span>ResourceSync</span><span>Live catalogue · Java Splay Tree</span></footer>
      </div>
    </div>
  );
}
