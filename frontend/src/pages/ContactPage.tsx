import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { InquiryForm } from '../components/InquiryForm';
import { PublicSiteLayout } from '../components/PublicSiteLayout';
import { BRAND } from '../brand';

const SITE_URL = BRAND.siteUrl;
const CONTACT_EMAIL = 'admin@indiansoftwareservices.com';

export function ContactPage() {
  useEffect(() => {
    document.title = `Contact · ${BRAND.productName} | ${BRAND.companyShort}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        'content',
        `Contact ${BRAND.companyShort} about ${BRAND.productName} demos, GST billing subscriptions, and support.`,
      );
    }
  }, []);

  return (
    <PublicSiteLayout active="contact">
      <section className="legal-page contact-page">
        <header className="legal-page-head">
          <p className="landing-kicker">Get in touch</p>
          <h1>Contact us</h1>
          <p className="legal-meta">
            Questions about {BRAND.productName}, demos, subscriptions, or privacy —
            send a message and our team will respond. The same form is used for
            web and mobile app support enquiries.
          </p>
        </header>

        <div className="contact-grid">
          <div className="contact-cards">
            <div className="contact-card">
              <h2>Company</h2>
              <p>
                <strong>{BRAND.companyName}</strong>
              </p>
              <p className="muted">
                {BRAND.productName} — multi-tenant GST invoicing for hospitals,
                schools, clinics, retail, and growing Indian businesses.
              </p>
            </div>
            <div className="contact-card">
              <h2>Email</h2>
              <p>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
              <p className="muted">
                Include your Client ID for faster account support.
              </p>
            </div>
            <div className="contact-card">
              <h2>Product</h2>
              <p>
                <a href={SITE_URL}>{SITE_URL}</a>
              </p>
              <p className="muted">
                {BRAND.productName} web app and companion mobile apps share this
                platform.
              </p>
            </div>
            <div className="contact-card">
              <h2>Legal</h2>
              <p>
                <Link to="/privacy">Privacy policy</Link>
              </p>
              <p className="muted">
                How we handle account, invoice, and enquiry data.
              </p>
            </div>
          </div>

          <div className="contact-form-panel">
            <h2>Send an enquiry</h2>
            <p className="muted" style={{ marginBottom: '1rem' }}>
              Tell us about your business and what you need — demo, onboarding,
              billing help, or a feature question.
            </p>
            <InquiryForm
              idPrefix="contact"
              submitLabel="Send message"
              initialMessage=""
            />
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
