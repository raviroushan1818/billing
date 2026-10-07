import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  Plug,
  Receipt,
  Settings,
  StickyNote,
  Trash2,
  Users,
  UserSquare2,
  ScrollText,
  KeyRound,
  Warehouse,
  ShoppingCart,
  Truck,
  MonitorSmartphone,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  canAccessRecycleBin,
  canCreateBills,
  canManageSettings,
  canManageUsers,
  roleLabel,
} from '../auth/roles';
import { useTenantProfile } from '../hooks/useTenantProfile';
import { ThemeToggle } from '../components/ThemeToggle';
import { BrandLogo } from '../components/BrandLogo';

export function AppShell() {
  const { user, logout } = useAuth();
  const { tenant } = useTenantProfile();
  const manageSettings = user ? canManageSettings(user.role) : false;
  const manageUsers = user ? canManageUsers(user.role) : false;
  const createBills = user ? canCreateBills(user.role) : false;
  const recycleBin = user ? canAccessRecycleBin(user.role) : false;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandLogo className="sidebar-logo" decorative />
          <div className="sidebar-brand-copy">
            <strong>{tenant?.name ?? 'IndBill'}</strong>
            <span>{tenant?.clientId ?? user?.tenant?.clientId}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Overview</div>
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          <NavLink
            to="/app/help"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <BookOpen size={16} />
            Help
          </NavLink>

          <div className="nav-section-label">Billing</div>
          {createBills ? (
            <NavLink
              to="/app/bills/new"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <Receipt size={16} />
              New Bill
            </NavLink>
          ) : null}
          {createBills ? (
            <NavLink
              to="/app/pos"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <MonitorSmartphone size={16} />
              POS
            </NavLink>
          ) : null}
          <NavLink
            to="/app/bills"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <FileText size={16} />
            Bills
          </NavLink>

          <div className="nav-section-label">Masters</div>
          <NavLink
            to="/app/parties"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <UserSquare2 size={16} />
            Parties
          </NavLink>
          <NavLink
            to="/app/items"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Package size={16} />
            Items
          </NavLink>
          <NavLink
            to="/app/inventory"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Warehouse size={16} />
            Godowns
          </NavLink>
          <NavLink
            to="/app/purchases"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <ShoppingCart size={16} />
            Purchases
          </NavLink>
          <NavLink
            to="/app/eway"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Truck size={16} />
            E-way
          </NavLink>
          <NavLink
            to="/app/notes"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <StickyNote size={16} />
            Notes
          </NavLink>

          <div className="nav-section-label">Insights</div>
          <NavLink
            to="/app/reports"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <BarChart3 size={16} />
            Reports
          </NavLink>
          {(user?.role === 'CLIENT_ADMIN' ||
            user?.role === 'ACCOUNTANT' ||
            user?.role === 'SUPER_ADMIN') && (
            <NavLink
              to="/app/audit"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <ScrollText size={16} />
              Audit
            </NavLink>
          )}

          <div className="nav-section-label">Account</div>
          <NavLink
            to="/app/account"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <KeyRound size={16} />
            Account
          </NavLink>
          {recycleBin ? (
            <NavLink
              to="/app/recycle-bin"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <Trash2 size={16} />
              Recycle Bin
            </NavLink>
          ) : null}
          {manageSettings ? (
            <>
              <div className="nav-section-label">Settings</div>
              <NavLink
                to="/app/billing"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                <CreditCard size={16} />
                Billing
              </NavLink>
              <NavLink
                to="/app/gst"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                <Settings size={16} />
                GST Settings
              </NavLink>
              <NavLink
                to="/app/branding"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                <Palette size={16} />
                Branding
              </NavLink>
              <NavLink
                to="/app/integrations"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                <Plug size={16} />
                Integrations
              </NavLink>
            </>
          ) : null}
          {manageUsers ? (
            <NavLink
              to="/app/users"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <Users size={16} />
              Users
            </NavLink>
          ) : null}
        </nav>
        <div className="sidebar-footer">
          <div>
            {user?.firstName} {user?.lastName}
          </div>
          <div className="muted">
            {user?.role ? roleLabel(user.role) : ''}
          </div>
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
          <span className="topbar-meta">
            {tenant?.profileType ?? 'Tenant'} · GST Billing
          </span>
          <div className="topbar-actions">
            <NavLink to="/app/help" className="topbar-help">
              <BookOpen size={15} /> Guide
            </NavLink>
            <ThemeToggle />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
