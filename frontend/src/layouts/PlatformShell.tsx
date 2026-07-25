import { NavLink, Outlet } from 'react-router-dom';
import {
  Building2,
  CreditCard,
  Inbox,
  Layers,
  LogOut,
  Repeat,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../auth/AuthContext';

export function PlatformShell() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            src="/logo.jpeg"
            alt="Indian Software Services"
            className="sidebar-logo"
          />
          <strong>Platform</strong>
          <span>Platform Admin</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/platform/clients"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Building2 size={16} />
            Clients
          </NavLink>
          <NavLink
            to="/platform/plans"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Layers size={16} />
            Plans
          </NavLink>
          <NavLink
            to="/platform/subscriptions"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Repeat size={16} />
            Subscriptions
          </NavLink>
          <NavLink
            to="/platform/payments"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <CreditCard size={16} />
            Payments
          </NavLink>
          <NavLink
            to="/platform/inquiries"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Inbox size={16} />
            Inquiries
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div>{user?.email}</div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <span className="topbar-meta">Super Admin Console</span>
          <ThemeToggle />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
