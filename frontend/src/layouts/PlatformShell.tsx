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
import { BrandLogo } from '../components/BrandLogo';
import { NavBackdrop, NavToggle, useMobileNav } from './MobileNav';
import { useAuth } from '../auth/AuthContext';

export function PlatformShell() {
  const nav = useMobileNav();
  const { user, logout } = useAuth();

  return (
    <div className={`shell${nav.open ? ' nav-open' : ''}`}>
      <NavBackdrop open={nav.open} onClose={nav.close} />
      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-brand">
          <BrandLogo className="sidebar-logo" decorative />
          <div className="sidebar-brand-copy">
            <strong>IndBill</strong>
            <span>Super Admin Console</span>
          </div>
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
          <div className="sidebar-footer-links">
            <a href="/contact" target="_blank" rel="noreferrer">
              Contact
            </a>
            <a href="/privacy" target="_blank" rel="noreferrer">
              Privacy
            </a>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <NavToggle open={nav.open} onToggle={nav.toggle} />
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
