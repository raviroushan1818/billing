import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Palette,
  Plug,
  Receipt,
  Settings,
  ShoppingCart,
  StickyNote,
  Truck,
  UserSquare2,
  Users,
  Warehouse,
  CircleHelp,
} from 'lucide-react';
import { PageHeader } from '../../components/ui';

type GuideSection = {
  id: string;
  title: string;
  icon: ReactNode;
  body: ReactNode;
};

const sections: GuideSection[] = [
  {
    id: 'start',
    title: 'New user — first 15 minutes',
    icon: <BookOpen size={18} />,
    body: (
      <>
        <p>
          Welcome. Follow this checklist once after you log in. It sets up a
          workspace that is ready for daily GST billing.
        </p>
        <ol className="guide-steps">
          <li>
            <strong>Confirm business profile</strong> — open{' '}
            <Link to="/app/gst">GST Settings</Link> and verify GSTIN, legal
            name, address, state code, and FY start month.
          </li>
          <li>
            <strong>Add branding</strong> — upload logo / letterhead under{' '}
            <Link to="/app/branding">Branding</Link> so printed invoices look
            professional from day one.
          </li>
          <li>
            <strong>Create masters</strong> — add a few{' '}
            <Link to="/app/parties">Parties</Link> (customers / patients /
            students) and <Link to="/app/items">Items</Link> with HSN and GST%.
            Use CSV import if you already have Excel lists.
          </li>
          <li>
            <strong>Raise a test bill</strong> — go to{' '}
            <Link to="/app/bills/new">New Bill</Link>, add one line, collect
            cash or UPI, and finalize. Then print or share.
          </li>
          <li>
            <strong>Invite your team</strong> — Owners can add operators and
            accountants from <Link to="/app/users">Users</Link>.
          </li>
        </ol>
        <div className="guide-callout">
          Tip: keep Client ID + email ready for login. Change your password from{' '}
          <Link to="/app/account">Account</Link> after the first sign-in.
        </div>
      </>
    ),
  },
  {
    id: 'bills',
    title: 'Creating & managing bills',
    icon: <Receipt size={18} />,
    body: (
      <>
        <p>
          Use <Link to="/app/bills/new">New Bill</Link> for full GST invoices
          and <Link to="/app/bills">Bills</Link> to search, print, share, void,
          or record partial payments.
        </p>
        <ul>
          <li>
            Search the party by name/phone; GSTIN and address auto-fill when
            linked to a master.
          </li>
          <li>
            Add lines from the item catalog or type freely. Save new lines to
            the catalog when useful.
          </li>
          <li>
            Split payments across Cash / UPI / Card. UPI needs a Ref ID; Card
            needs last 4 digits.
          </li>
          <li>
            Finalized bills cannot be edited — use Credit / Debit notes or void
            (with reason) when a correction is needed.
          </li>
          <li>
            Soft-deleted bills move to Recycle Bin; only Owners empty it
            permanently.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'pos',
    title: 'POS counter mode',
    icon: <MonitorSmartphone size={18} />,
    body: (
      <>
        <p>
          <Link to="/app/pos">POS</Link> is built for walk-in / counter sales:
          search or scan barcode, tap to add, adjust qty, charge, and open the
          bill instantly.
        </p>
        <ul>
          <li>Press Enter in search to add the top match quickly.</li>
          <li>Default customer is “Walk-in customer” — edit name/phone as needed.</li>
          <li>
            Checkout creates a finalized invoice with the selected payment mode
            (same GST engine as New Bill).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'masters',
    title: 'Parties & items',
    icon: <Package size={18} />,
    body: (
      <>
        <p>
          Masters keep billing fast and consistent. Maintain them before peak
          hours.
        </p>
        <ul>
          <li>
            <Link to="/app/parties">Parties</Link> — customers with GSTIN,
            state, phone, and optional external ID (MRN / admission no.).
          </li>
          <li>
            <Link to="/app/items">Items</Link> — name, HSN/SAC, unit, rate, GST%,
            barcode. Enable <em>Track stock</em> when inventory matters.
          </li>
          <li>CSV import is available on both screens (plan feature may apply).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'inventory',
    title: 'Godowns, purchases & stock',
    icon: <Warehouse size={18} />,
    body: (
      <>
        <p>
          Business+ plans unlock multi-location stock. Start on{' '}
          <Link to="/app/inventory">Godowns</Link>.
        </p>
        <ul>
          <li>Create godowns (Main Store is created automatically when needed).</li>
          <li>Transfer stock between godowns when goods move.</li>
          <li>
            Record vendor bills on <Link to="/app/purchases">Purchases</Link> —
            linked catalog items with stock tracking increase godown qty.
          </li>
          <li>
            Sales finalize deducts tracked stock. Keep opening stock accurate
            from Items → Adjust.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'eway',
    title: 'E-way bills',
    icon: <Truck size={18} />,
    body: (
      <>
        <p>
          From <Link to="/app/eway">E-way</Link>, generate an e-way entry against
          a finalized invoice (vehicle, transporter, from/to, distance).
        </p>
        <div className="guide-callout">
          Default provider is <strong>stub</strong> (demo numbers). For live
          NIC/GSP, configure <code>EWAY_PROVIDER=http</code>,{' '}
          <code>EWAY_API_URL</code>, and optional <code>EWAY_API_KEY</code> on
          the API server.
        </div>
      </>
    ),
  },
  {
    id: 'notes',
    title: 'Notes & credit/debit documents',
    icon: <StickyNote size={18} />,
    body: (
      <>
        <ul>
          <li>
            <Link to="/app/notes">Workspace Notes</Link> — follow-ups pinned to
            a party with optional remind-on date.
          </li>
          <li>
            Credit / Debit notes — open from a bill’s actions or{' '}
            <Link to="/app/notes/document">Notes → document</Link> flow to
            adjust taxable value correctly.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'reports',
    title: 'Reports & receivables',
    icon: <BarChart3 size={18} />,
    body: (
      <>
        <p>
          <Link to="/app/reports">Reports</Link> covers day book, collections by
          mode, GSTR-1 style export, and receivables / ageing for unpaid
          balances.
        </p>
        <ul>
          <li>Filter by date range before exporting.</li>
          <li>
            Record partial payments on a bill to keep balance due and ageing
            accurate.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'GST, branding & integrations',
    icon: <Settings size={18} />,
    body: (
      <>
        <ul>
          <li>
            <Link to="/app/gst">GST Settings</Link> — GSTIN, place of supply
            defaults, invoice prefixes, FY start.
          </li>
          <li>
            <Link to="/app/branding">Branding</Link> — logo, banner/letterhead,
            invoice theme.
          </li>
          <li>
            <Link to="/app/integrations">Integrations</Link> — SMTP for email
            share and WhatsApp Cloud for PDF delivery.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'team',
    title: 'Roles & security',
    icon: <Users size={18} />,
    body: (
      <>
        <ul>
          <li>
            <strong>Owner (Client Admin)</strong> — full settings, users,
            recycle bin, billing.
          </li>
          <li>
            <strong>Billing Operator</strong> — create and manage day-to-day
            bills / POS.
          </li>
          <li>
            <strong>Accountant</strong> — bills, reports, voids, credit notes;
            limited settings.
          </li>
          <li>
            <strong>Viewer</strong> — read-only for oversight.
          </li>
        </ul>
        <p>
          Review activity on <Link to="/app/audit">Audit</Link>. Change password
          anytime under <Link to="/app/account">Account</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Subscription & plans',
    icon: <CreditCard size={18} />,
    body: (
      <>
        <p>
          Owners manage the workspace plan from{' '}
          <Link to="/app/billing">Billing</Link>. Trial starts on Growth limits;
          upgrade to unlock stock, e-way, higher invoice caps, and more users.
        </p>
        <ul>
          <li>Pay via UPI (manual confirmation) or Razorpay when enabled.</li>
          <li>
            Invoice limits and feature gates apply on create — upgrade if you
            hit a plan message.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: <CircleHelp size={18} />,
    body: (
      <>
        <dl className="guide-faq">
          <dt>Can I edit a finalized bill?</dt>
          <dd>
            No. Void it (if allowed) or issue a credit / debit note so GST
            history stays clean.
          </dd>
          <dt>Why can’t I see Purchases / E-way?</dt>
          <dd>
            Those features require a Business (or higher) plan with stock / e-way
            entitlements. Check Billing → current plan features.
          </dd>
          <dt>Stock went negative / wrong godown?</dt>
          <dd>
            Use Items → Adjust or Godowns → Transfer. Purchases should target the
            correct godown when goods arrive.
          </dd>
          <dt>Need help from ISS?</dt>
          <dd>
            Use the{' '}
            <a href="/contact" target="_blank" rel="noreferrer">
              Contact us
            </a>{' '}
            page (or the enquiry form on the public website), or contact your
            Indian Software Services account manager with your Client ID. Read
            our{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">
              Privacy policy
            </a>
            .
          </dd>
        </dl>
      </>
    ),
  },
];

export function HelpGuidePage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('section') || 'start';
  const [active, setActive] = useState(initial);

  useEffect(() => {
    const s = params.get('section');
    if (s && sections.some((x) => x.id === s)) setActive(s);
  }, [params]);

  const current = useMemo(
    () => sections.find((s) => s.id === active) ?? sections[0],
    [active],
  );

  const select = (id: string) => {
    setActive(id);
    setParams(id === 'start' ? {} : { section: id });
  };

  return (
    <>
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Help & user guide"
        subtitle="Professional walkthrough for daily GST billing on this workspace"
      />

      <div className="guide-layout">
        <nav className="guide-toc" aria-label="Guide sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`guide-toc-item${active === s.id ? ' active' : ''}`}
              onClick={() => select(s.id)}
            >
              <span className="guide-toc-icon">{s.icon}</span>
              {s.title}
            </button>
          ))}
        </nav>

        <article className="panel guide-panel">
          <h2 className="guide-panel-title">
            <span className="guide-toc-icon">{current.icon}</span>
            {current.title}
          </h2>
          <div className="guide-body">{current.body}</div>

          <div className="guide-shortcuts">
            <h3>Jump to screens</h3>
            <div className="quick-links">
              <Link to="/app" className="quick-link">
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              <Link to="/app/bills/new" className="quick-link">
                <Receipt size={16} /> New Bill
              </Link>
              <Link to="/app/pos" className="quick-link">
                <MonitorSmartphone size={16} /> POS
              </Link>
              <Link to="/app/parties" className="quick-link">
                <UserSquare2 size={16} /> Parties
              </Link>
              <Link to="/app/items" className="quick-link">
                <Package size={16} /> Items
              </Link>
              <Link to="/app/inventory" className="quick-link">
                <Warehouse size={16} /> Godowns
              </Link>
              <Link to="/app/purchases" className="quick-link">
                <ShoppingCart size={16} /> Purchases
              </Link>
              <Link to="/app/eway" className="quick-link">
                <Truck size={16} /> E-way
              </Link>
              <Link to="/app/reports" className="quick-link">
                <BarChart3 size={16} /> Reports
              </Link>
              <Link to="/app/gst" className="quick-link">
                <Settings size={16} /> GST
              </Link>
              <Link to="/app/branding" className="quick-link">
                <Palette size={16} /> Branding
              </Link>
              <Link to="/app/integrations" className="quick-link">
                <Plug size={16} /> Integrations
              </Link>
              <Link to="/app/billing" className="quick-link">
                <CreditCard size={16} /> Billing
              </Link>
              <Link to="/app/account" className="quick-link">
                <KeyRound size={16} /> Account
              </Link>
              <Link to="/app/bills" className="quick-link">
                <FileText size={16} /> All bills
              </Link>
            </div>
          </div>

          <div className="guide-checklist">
            <CheckCircle2 size={18} />
            <span>
              Bookmark this page. Return anytime from the sidebar →{' '}
              <strong>Help</strong>.
            </span>
          </div>
        </article>
      </div>
    </>
  );
}
