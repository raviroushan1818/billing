import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { BRAND } from '../brand';

export function PublicSiteLayout({
  children,
  active,
}: {
  children: ReactNode;
  active?: 'home' | 'contact' | 'privacy';
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="landing" data-landing="true">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>

      <header className="landing-top">
        <div className="landing-top-inner">
          <Link to="/" className="landing-brand">
            <BrandLogo decorative width={36} height={36} />
            <span>
              {BRAND.productName}
              <small>{BRAND.companyShort}</small>
            </span>
          </Link>
          <nav className="landing-nav landing-nav-desktop" aria-label="Primary">
            <Link to="/#pricing">Pricing</Link>
            <Link to="/#features">Features</Link>
            <Link
              to="/contact"
              className={active === 'contact' ? 'is-active' : undefined}
            >
              Contact
            </Link>
            <Link
              to="/privacy"
              className={active === 'privacy' ? 'is-active' : undefined}
            >
              Privacy
            </Link>
          </nav>
          <div className="landing-top-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-signin">
              Sign in
            </Link>
            <Link to="/contact" className="landing-btn landing-btn-primary landing-btn-demo">
              Contact us
            </Link>
            <button
              type="button"
              className="landing-menu-toggle"
              aria-expanded={mobileNavOpen}
              aria-controls="public-mobile-nav"
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
            id="public-mobile-nav"
            className="landing-nav-mobile"
            aria-label="Mobile"
          >
            <Link to="/#pricing" onClick={() => setMobileNavOpen(false)}>
              Pricing
            </Link>
            <Link to="/#features" onClick={() => setMobileNavOpen(false)}>
              Features
            </Link>
            <Link to="/contact" onClick={() => setMobileNavOpen(false)}>
              Contact
            </Link>
            <Link to="/privacy" onClick={() => setMobileNavOpen(false)}>
              Privacy
            </Link>
            <Link
              to="/login"
              className="landing-btn landing-btn-ghost"
              onClick={() => setMobileNavOpen(false)}
            >
              Sign in
            </Link>
          </nav>
        ) : null}
      </header>

      <main id="main">{children}</main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <strong>{BRAND.productName}</strong>
            <p>
              {BRAND.productTagline} by {BRAND.companyShort} — professional
              multi-tenant GST billing for Indian enterprises.
            </p>
          </div>
          <div>
            <Link to="/login">Client sign in</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/">Home</Link>
          </div>
          <p className="landing-copy">
            © {new Date().getFullYear()} Indian Software Services Private
            Limited. All rights reserved.
            {' · '}
            <Link to="/contact">Contact us</Link>
            {' · '}
            <Link to="/privacy">Privacy policy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
