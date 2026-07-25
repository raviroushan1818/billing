import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { publicApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { roleHome } from '../auth/roles';
import { Alert, Button, Field } from '../components/ui';
import type { SubscriptionPlan } from '../types';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Indian Software Services Private Limited',
      url: 'https://billing.indiansoftwareservices.com/',
      logo: 'https://billing.indiansoftwareservices.com/logo.jpeg',
      areaServed: 'IN',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'ISS GST Billing Platform',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://billing.indiansoftwareservices.com/',
      description:
        'Multi-tenant GST billing software for Indian enterprises with tax invoices, CGST/SGST/IGST, branded PDFs, role-based access, collections reports and invoice sharing.',
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
      provider: {
        '@type': 'Organization',
        name: 'Indian Software Services Private Limited',
      },
    },
  ],
};

const POPUP_STORAGE_KEY = 'iss_inquiry_popup_dismissed_at';
const POPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const POPUP_AUTO_DELAY_MS = 12_000;

function wasPopupDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(POPUP_STORAGE_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < POPUP_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markPopupDismissed() {
  try {
    localStorage.setItem(POPUP_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function useCountUp(target: number, active: boolean, durationMs = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);
  return value;
}

function InquiryForm({
  idPrefix,
  submitLabel = 'Send inquiry',
  onSuccess,
  initialMessage = '',
}: {
  idPrefix: string;
  submitLabel?: string;
  onSuccess?: () => void;
  initialMessage?: string;
}) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submitInquiry = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await publicApi.createInquiry({
        name,
        businessName,
        phone,
        email,
        message,
      });
      setSuccess(res.message);
      setName('');
      setBusinessName('');
      setPhone('');
      setEmail('');
      setMessage('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit inquiry');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="landing-form" onSubmit={(e) => void submitInquiry(e)}>
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      <div className="grid-2">
        <Field label="Your name" htmlFor={`${idPrefix}-name`}>
          <input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            autoComplete="name"
          />
        </Field>
        <Field label="Business name" htmlFor={`${idPrefix}-biz`}>
          <input
            id={`${idPrefix}-biz`}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            maxLength={160}
            autoComplete="organization"
          />
        </Field>
        <Field label="Phone" htmlFor={`${idPrefix}-phone`}>
          <input
            id={`${idPrefix}-phone`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            maxLength={20}
            autoComplete="tel"
          />
        </Field>
        <Field label="Email" htmlFor={`${idPrefix}-email`}>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={160}
            autoComplete="email"
          />
        </Field>
      </div>
      <Field label="How can we help?" htmlFor={`${idPrefix}-msg`}>
        <textarea
          id={`${idPrefix}-msg`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Tell us about your GST billing needs…"
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Sending…' : submitLabel}
      </Button>
    </form>
  );
}

export function LandingPage() {
  const { user, loading } = useAuth();
  const inquiryRef = useRef<HTMLElement | null>(null);
  const statsRef = useRef<HTMLElement | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [yearly, setYearly] = useState(true);
  const [planInterest, setPlanInterest] = useState('');
  const popupShownRef = useRef(false);

  const tenants = useCountUp(250, statsVisible);
  const invoices = useCountUp(99, statsVisible);
  const uptime = useCountUp(24, statsVisible);

  const openPopup = (markManual = false, planName?: string) => {
    popupShownRef.current = true;
    if (planName) {
      setPlanInterest(
        `I'm interested in the ${planName} plan. Please share onboarding steps.`,
      );
    }
    setPopupOpen(true);
    if (markManual) {
      /* manual CTA — still allow reopen in session */
    }
  };

  const closePopup = (persistDismiss: boolean) => {
    setPopupOpen(false);
    if (persistDismiss) markPopupDismissed();
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'landing-jsonld';
    script.text = JSON.stringify(JSON_LD);
    document.head.appendChild(script);
    return () => {
      document.getElementById('landing-jsonld')?.remove();
    };
  }, []);

  useEffect(() => {
    void publicApi.listPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setStatsVisible(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Auto-open after delay + exit-intent (once), respecting 24h dismiss cooldown
  useEffect(() => {
    if (loading || user) return;
    if (wasPopupDismissedRecently()) return;

    const timer = window.setTimeout(() => {
      if (!popupShownRef.current) openPopup();
    }, POPUP_AUTO_DELAY_MS);

    const onExitIntent = (e: MouseEvent) => {
      if (e.clientY > 12) return;
      if (popupShownRef.current || wasPopupDismissedRecently()) return;
      openPopup();
    };

    document.addEventListener('mouseout', onExitIntent);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseout', onExitIntent);
    };
  }, [loading, user]);

  useEffect(() => {
    if (!popupOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup(true);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [popupOpen]);

  if (!loading && user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  const scrollToInquiry = () => {
    inquiryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="landing" data-landing="true">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>

      <header className="landing-top">
        <div className="landing-top-inner">
          <Link to="/" className="landing-brand">
            <img src="/logo.jpeg" alt="Indian Software Services" />
            <span>Indian Software Services</span>
          </Link>
          <nav className="landing-nav landing-nav-desktop" aria-label="Primary">
            <a href="#pricing">Pricing</a>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#guide">User guide</a>
            <a href="#industries">Industries</a>
            <a href="#inquiry">Contact</a>
          </nav>
          <div className="landing-top-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-signin">
              Sign in
            </Link>
            <button
              type="button"
              className="landing-btn landing-btn-primary landing-btn-demo"
              onClick={() => openPopup(true)}
            >
              Request a demo
            </button>
            <button
              type="button"
              className="landing-menu-toggle"
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
        {mobileNavOpen ? (
          <nav
            id="landing-mobile-nav"
            className="landing-nav-mobile"
            aria-label="Mobile"
          >
            <a href="#pricing" onClick={() => setMobileNavOpen(false)}>
              Pricing
            </a>
            <a href="#features" onClick={() => setMobileNavOpen(false)}>
              Features
            </a>
            <a href="#how" onClick={() => setMobileNavOpen(false)}>
              How it works
            </a>
            <a href="#guide" onClick={() => setMobileNavOpen(false)}>
              User guide
            </a>
            <a href="#industries" onClick={() => setMobileNavOpen(false)}>
              Industries
            </a>
            <a href="#inquiry" onClick={() => setMobileNavOpen(false)}>
              Contact
            </a>
            <Link
              to="/login"
              className="landing-btn landing-btn-ghost"
              onClick={() => setMobileNavOpen(false)}
            >
              Sign in
            </Link>
            <button
              type="button"
              className="landing-btn landing-btn-primary"
              onClick={() => {
                setMobileNavOpen(false);
                openPopup(true);
              }}
            >
              Request a demo
            </button>
          </nav>
        ) : null}
      </header>

      <main id="main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-hero-bg" aria-hidden="true" />
          <div className="landing-hero-inner">
            <p className="landing-kicker">Indian Software Services</p>
            <h1 id="hero-title">
              GST billing software built for Indian businesses that move fast
            </h1>
            <p className="landing-hero-lead">
              Multi-tenant tax invoicing with CGST, SGST &amp; IGST accuracy,
              branded PDFs, team roles, collections reports, and one-click
              Email / WhatsApp share — all in one professional platform.
            </p>
            <div className="landing-hero-cta">
              <button
                type="button"
                className="landing-btn landing-btn-primary landing-btn-lg"
                onClick={() => openPopup(true)}
              >
                Talk to Platform Admin
              </button>
              <Link
                to="/login"
                className="landing-btn landing-btn-outline landing-btn-lg"
              >
                Sign in to your tenant
              </Link>
            </div>
          </div>
          <div className="landing-hero-art" aria-hidden="true">
            <svg viewBox="0 0 640 420" className="landing-hero-svg">
              <defs>
                <linearGradient id="invGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#e8f4f4" stopOpacity="1" />
                </linearGradient>
              </defs>
              <rect
                x="72"
                y="36"
                width="496"
                height="348"
                rx="20"
                fill="url(#invGrad)"
              />
              <rect x="72" y="36" width="496" height="64" rx="20" fill="#0a2540" />
              <rect x="72" y="80" width="496" height="20" fill="#0a2540" />
              <rect
                x="100"
                y="54"
                width="56"
                height="36"
                rx="8"
                fill="#2dd4bf"
              />
              <rect
                x="172"
                y="60"
                width="200"
                height="10"
                rx="4"
                fill="#fff"
                opacity="0.85"
              />
              <rect
                x="172"
                y="78"
                width="140"
                height="8"
                rx="4"
                fill="#fff"
                opacity="0.45"
              />
              <rect
                x="100"
                y="128"
                width="440"
                height="14"
                rx="4"
                fill="#0d7377"
                opacity="0.2"
              />
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <rect
                    x="100"
                    y={160 + i * 40}
                    width="440"
                    height="28"
                    rx="6"
                    fill="#0a2540"
                    opacity={0.06 + i * 0.02}
                  />
                  <rect
                    x="112"
                    y={168 + i * 40}
                    width="180"
                    height="10"
                    rx="3"
                    fill="#0a2540"
                    opacity="0.35"
                  />
                  <rect
                    x="420"
                    y={168 + i * 40}
                    width="100"
                    height="10"
                    rx="3"
                    fill="#0d7377"
                    opacity="0.55"
                  />
                </g>
              ))}
              <rect
                x="340"
                y="330"
                width="200"
                height="32"
                rx="8"
                fill="#0d7377"
              />
            </svg>
          </div>
        </section>

        <section
          className="landing-stats"
          ref={statsRef}
          aria-label="Platform highlights"
        >
          <div className="landing-stats-grid">
            <div>
              <strong>{tenants}+</strong>
              <span>Multi-tenant ready deployments</span>
            </div>
            <div>
              <strong>{invoices}%</strong>
              <span>GST-aligned tax invoice flows</span>
            </div>
            <div>
              <strong>{uptime}/7</strong>
              <span>Always-on cloud billing console</span>
            </div>
            <div>
              <strong>4</strong>
              <span>Roles: Owner, Staff, Accountant, Viewer</span>
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-section-alt">
          <header className="landing-section-head">
            <h2>Simple India pricing — cheaper than the usual suspects</h2>
            <p>
              From ₹167/mo when billed yearly. Undercuts Vyapar &amp; myBillBook
              paid tiers. Prices excl. 18% GST. 14-day trial on Growth limits.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className={`landing-btn ${yearly ? 'landing-btn-primary' : 'landing-btn-outline'}`}
                onClick={() => setYearly(true)}
              >
                Yearly
              </button>{' '}
              <button
                type="button"
                className={`landing-btn ${!yearly ? 'landing-btn-primary' : 'landing-btn-outline'}`}
                onClick={() => setYearly(false)}
              >
                Monthly
              </button>
            </div>
          </header>
          <div className="landing-feature-grid">
            {plans.map((p) => {
              const price = yearly ? p.priceYearlyInr : p.priceMonthlyInr;
              const feats = Array.isArray(p.features) ? p.features : [];
              const popular = p.code === 'GROWTH';
              return (
                <article
                  key={p.id}
                  style={
                    popular
                      ? { outline: '2px solid var(--color-accent, #0d7377)' }
                      : undefined
                  }
                >
                  {popular ? (
                    <p className="landing-kicker">Most popular</p>
                  ) : null}
                  <h3>{p.name}</h3>
                  <p>
                    {p.isCustom || price === 0 ? (
                      <strong>Custom</strong>
                    ) : (
                      <>
                        <strong>₹{price.toLocaleString('en-IN')}</strong>
                        <span>
                          {' '}
                          / {yearly ? 'year' : 'month'}
                          {yearly && p.priceYearlyInr
                            ? ` (~₹${Math.round(p.priceYearlyInr / 12)}/mo)`
                            : ''}
                        </span>
                      </>
                    )}
                  </p>
                  <p>{p.description}</p>
                  <ul style={{ paddingLeft: '1.1rem', margin: '0.75rem 0' }}>
                    {feats.slice(0, 5).map((f) => (
                      <li key={String(f)}>{String(f)}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="landing-btn landing-btn-primary"
                    onClick={() => openPopup(true, p.name)}
                  >
                    {p.isCustom ? 'Talk to sales' : 'Start with this plan'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section id="features" className="landing-section">
          <header className="landing-section-head">
            <h2>Everything serious GST invoicing needs</h2>
            <p>
              From party masters to GSTR-friendly reports — engineered for
              hospitals, schools, clinics, and retail brands across India.
            </p>
          </header>
          <div className="landing-feature-grid">
            <article>
              <h3>Tax-perfect GST invoices</h3>
              <p>
                Auto CGST / SGST / IGST splits, round-off payable, credit &amp;
                debit notes, and printable branded tax invoices your auditors
                will respect.
              </p>
            </article>
            <article>
              <h3>Masters &amp; CSV bulk import</h3>
              <p>
                Parties and items with HSN, rates, and barcodes — plus template
                CSV import so go-lives take hours, not weeks.
              </p>
            </article>
            <article>
              <h3>Letterhead &amp; invoice themes</h3>
              <p>
                Compose logo + rich header text or upload a full letterhead
                banner. Classic, Modern, Compact, Bold layouts for PDFs that
                look premium.
              </p>
            </article>
            <article>
              <h3>Role-based teams &amp; audit trail</h3>
              <p>
                See who raised every bill and who voided it. Soft-delete to
                recycle bin; only the Owner empties it permanently.
              </p>
            </article>
            <article>
              <h3>Collections &amp; GSTR-ready reports</h3>
              <p>
                Day book, cash / UPI / card collections, and export-ready GST
                summaries so month-end never becomes a spreadsheet scavenger
                hunt.
              </p>
            </article>
            <article>
              <h3>Email &amp; WhatsApp invoice share</h3>
              <p>
                Configure tenant SMTP and WhatsApp Cloud credentials, then share
                invoice PDFs the moment a bill is finalized.
              </p>
            </article>
          </div>
        </section>

        <section id="how" className="landing-section landing-section-alt">
          <header className="landing-section-head">
            <h2>How GST billing works on ISS</h2>
            <p>Three clear steps from counter to compliance.</p>
          </header>
          <div className="landing-flow">
            <div className="landing-flow-step">
              <span className="landing-flow-num">1</span>
              <h3>Create the bill</h3>
              <p>
                Search catalog, add lines, apply GST — save draft or finalize.
              </p>
            </div>
            <div className="landing-flow-step">
              <span className="landing-flow-num">2</span>
              <h3>Collect payment</h3>
              <p>
                Split cash, UPI, and card with refs — totals always reconcile.
              </p>
            </div>
            <div className="landing-flow-step">
              <span className="landing-flow-num">3</span>
              <h3>Report &amp; share</h3>
              <p>
                Print branded PDF, email or WhatsApp, and pull day-book reports.
              </p>
            </div>
          </div>
          <div className="landing-chart" aria-hidden="true">
            <svg viewBox="0 0 720 220" role="img">
              <text x="20" y="28" className="landing-chart-label">
                Sample weekly collections mix
              </text>
              {[
                { x: 80, h: 120, label: 'Cash' },
                { x: 220, h: 160, label: 'UPI' },
                { x: 360, h: 90, label: 'Card' },
                { x: 500, h: 140, label: 'Bills' },
                { x: 640, h: 110, label: 'Shared' },
              ].map((b) => (
                <g key={b.label}>
                  <rect
                    x={b.x - 28}
                    y={200 - b.h}
                    width="56"
                    height={b.h}
                    rx="8"
                    fill="#0d7377"
                    opacity="0.85"
                  />
                  <text
                    x={b.x}
                    y="216"
                    textAnchor="middle"
                    className="landing-chart-label"
                  >
                    {b.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </section>

        <section id="guide" className="landing-section">
          <header className="landing-section-head">
            <h2>User guide — from first login to month-end</h2>
            <p>
              A clear path for owners and operators. After you sign in, open{' '}
              <strong>Help</strong> in the app for the full interactive guide.
            </p>
          </header>
          <div className="landing-feature-grid">
            <article>
              <h3>1. Set up once</h3>
              <p>
                Confirm GSTIN and address, upload letterhead branding, then add
                parties and items (or import CSV). Invite operators and
                accountants with the right roles.
              </p>
            </article>
            <article>
              <h3>2. Bill every day</h3>
              <p>
                Use New Bill for full GST invoices or POS for walk-in counters.
                Split Cash / UPI / Card, print branded PDFs, and share by email
                or WhatsApp.
              </p>
            </article>
            <article>
              <h3>3. Stock and purchases</h3>
              <p>
                Business plans unlock godowns, transfers, and purchase bills that
                increase tracked stock — so sales never guess inventory.
              </p>
            </article>
            <article>
              <h3>4. Close the books</h3>
              <p>
                Day book, collections, receivables ageing, and GSTR-ready export
                keep compliance predictable. Audit trail shows who changed what.
              </p>
            </article>
            <article>
              <h3>5. New-user checklist</h3>
              <p>
                GST Settings → Branding → Masters → first test bill → Users →
                change password. Takes about fifteen minutes on a fresh
                workspace.
              </p>
            </article>
            <article>
              <h3>6. Need help?</h3>
              <p>
                Sign in and open Help for screen-by-screen instructions, or
                request a demo / enquiry below with your industry and city.
              </p>
            </article>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <Link to="/login" className="landing-btn landing-btn-primary">
              Sign in to open the full guide
            </Link>
          </div>
        </section>

        <section id="industries" className="landing-section">
          <header className="landing-section-head">
            <h2>Built for real Indian industries</h2>
            <p>
              Profile-ready for hospitals, schools, clinics, retail and
              commercial teams — same GST engine, language that fits your
              counters.
            </p>
          </header>
          <ul className="landing-industries">
            <li>
              <strong>Hospitals &amp; clinics</strong>
              Patient billing / invoice titles, UHID-friendly party codes.
            </li>
            <li>
              <strong>Schools &amp; institutes</strong>
              Fee-style invoices, admission references, clear GST breakups.
            </li>
            <li>
              <strong>Retail &amp; commercial</strong>
              Fast item search, barcode, multi-mode settlement at the desk.
            </li>
          </ul>
        </section>

        <section
          id="inquiry"
          className="landing-section landing-inquiry"
          ref={inquiryRef}
          aria-labelledby="inquiry-title"
        >
          <div className="landing-inquiry-grid">
            <div>
              <h2 id="inquiry-title">Query Platform Admin</h2>
              <p>
                Want a demo tenant, onboarding help, or a multi-branch rollout?
                Send a message — our platform team reviews every inquiry.
              </p>
              <ul className="landing-inquiry-points">
                <li>Guided GST setup for your business profile</li>
                <li>Branding &amp; letterhead configuration</li>
                <li>User roles for Owner, Staff &amp; Accountant</li>
              </ul>
              <button
                type="button"
                className="landing-btn landing-btn-primary"
                style={{ marginTop: '1rem' }}
                onClick={() => openPopup(true)}
              >
                Open enquiry popup
              </button>
            </div>
            <InquiryForm idPrefix="inq" />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <strong>Indian Software Services</strong>
            <p>
              Professional multi-tenant GST billing software for Indian
              enterprises.
            </p>
          </div>
          <div>
            <Link to="/login">Client sign in</Link>
            <button
              type="button"
              className="landing-footer-linkbtn"
              onClick={() => openPopup(true)}
            >
              Request a demo
            </button>
            <a href="#inquiry" onClick={scrollToInquiry}>
              Contact section
            </a>
          </div>
          <p className="landing-copy">
            © {new Date().getFullYear()} Indian Software Services Private
            Limited. All rights reserved.
          </p>
        </div>
      </footer>

      {popupOpen ? (
        <div
          className="landing-popup-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePopup(true);
          }}
        >
          <div
            className="landing-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-popup-title"
          >
            <button
              type="button"
              className="landing-popup-close"
              aria-label="Close enquiry form"
              onClick={() => closePopup(true)}
            >
              ×
            </button>
            <div className="landing-popup-head">
              <img src="/logo.jpeg" alt="" width={40} height={40} />
              <div>
                <p className="landing-popup-kicker">Platform Admin</p>
                <h2 id="landing-popup-title">Request a GST billing demo</h2>
              </div>
            </div>
            <p className="landing-popup-lead">
              Share your details and our team will set up a tenant walkthrough
              for your hospital, school, clinic, or retail business.
            </p>
            <InquiryForm
              idPrefix="popup-inq"
              submitLabel="Submit enquiry"
              initialMessage={planInterest}
              onSuccess={() => {
                window.setTimeout(() => closePopup(true), 1600);
              }}
            />
            <p className="landing-popup-footnote">
              Prefer the full page form?{' '}
              <button
                type="button"
                className="landing-popup-inline"
                onClick={() => {
                  closePopup(false);
                  scrollToInquiry();
                }}
              >
                Jump to contact section
              </button>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
