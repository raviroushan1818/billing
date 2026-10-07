import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { PublicSiteLayout } from '../components/PublicSiteLayout';
import { BRAND } from '../brand';

const LAST_UPDATED = '13 August 2026';
const SITE_URL = BRAND.siteUrl;
const CONTACT_EMAIL = 'admin@indiansoftwareservices.com';

export function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = `Privacy Policy · ${BRAND.productName} | ${BRAND.companyShort}`;
  }, []);

  return (
    <PublicSiteLayout active="privacy">
      <article className="legal-page">
        <header className="legal-page-head">
          <p className="landing-kicker">Legal</p>
          <h1>Privacy Policy</h1>
          <p className="legal-meta">
            Last updated: {LAST_UPDATED}. Applies to the {BRAND.productName}{' '}
            ({BRAND.productTagline}) website, web application, and mobile
            applications (Android / iOS) operated by{' '}
            <strong>{BRAND.companyName}</strong> (“we”, “us”, “our”).
          </p>
        </header>

        <div className="legal-body">
          <section>
            <h2>1. Who we are</h2>
            <p>
              We provide multi-tenant GST billing software for Indian businesses
              (hospitals, schools, clinics, retail, and other enterprises). Our
              product is available at{' '}
              <a href={SITE_URL}>{SITE_URL}</a> and through companion mobile
              apps that use the same backend services.
            </p>
            <p>
              For privacy questions, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use our{' '}
              <Link to="/contact">Contact us</Link> page.
            </p>
          </section>

          <section>
            <h2>2. Scope</h2>
            <p>This policy covers personal data we process when you:</p>
            <ul>
              <li>Visit our marketing website or submit a demo / enquiry form</li>
              <li>Create or use a tenant account on the web app or mobile app</li>
              <li>Receive invoices, reports, or support communications from us</li>
              <li>Interact with optional integrations (email, WhatsApp, storage, GST e-services)</li>
            </ul>
            <p>
              Tenant customers (your end customers on invoices) are typically
              processed by you as the data controller for that business data; we
              act as a processor / service provider hosting that data on your
              behalf under your account.
            </p>
          </section>

          <section>
            <h2>3. Information we collect</h2>
            <h3>3.1 Account and organisation data</h3>
            <ul>
              <li>Name, email, phone, role, and login credentials (passwords are stored hashed)</li>
              <li>Tenant / Client ID, business legal name, GSTIN, address, and branding assets</li>
              <li>Subscription, plan, and billing status related to your SaaS account</li>
            </ul>
            <h3>3.2 Business / billing data you enter</h3>
            <ul>
              <li>Parties (customers/vendors), items, stock/godown records, purchases</li>
              <li>Tax invoices, credit/debit notes, payments, dues, and related reports</li>
              <li>Optional e-way / e-invoice payloads when you enable those features</li>
              <li>Uploaded logos and media used on branded invoices</li>
            </ul>
            <h3>3.3 Website and support enquiries</h3>
            <ul>
              <li>Name, business name, phone, email, and message from public enquiry forms</li>
            </ul>
            <h3>3.4 Technical and usage data</h3>
            <ul>
              <li>IP address, browser/device type, app version, and approximate timestamps</li>
              <li>Authentication tokens and session-related security logs</li>
              <li>Audit logs of significant actions inside your tenant (for accountability)</li>
            </ul>
            <p>
              We do not knowingly collect special category data beyond what you
              choose to enter into your billing records. Do not store unnecessary
              sensitive personal data in free-text invoice fields.
            </p>
          </section>

          <section>
            <h2>4. How we use information</h2>
            <ul>
              <li>Provide, secure, and improve the GST billing web and mobile services</li>
              <li>Authenticate users, enforce roles, and isolate tenant data</li>
              <li>Generate invoices, PDFs, reports, and optional share/email features</li>
              <li>Process subscription, support, and demo enquiries</li>
              <li>Detect abuse, prevent fraud, and meet legal / tax-platform obligations</li>
              <li>Send operational notices (security, downtime, product changes)</li>
            </ul>
            <p>
              We do not sell your personal data. We do not use tenant invoice
              content for third-party advertising.
            </p>
          </section>

          <section>
            <h2>5. Legal bases (where applicable)</h2>
            <p>
              Depending on Indian law and the context, we process data to perform
              a contract with you, to pursue legitimate interests in operating a
              secure SaaS platform, with your consent (for example marketing
              enquiries), or to comply with applicable legal obligations.
            </p>
          </section>

          <section>
            <h2>6. Sharing and processors</h2>
            <p>We may share data with:</p>
            <ul>
              <li>
                <strong>Infrastructure providers</strong> — hosting, database,
                object storage (for example cloud storage for logos/PDFs when
                configured)
              </li>
              <li>
                <strong>Communication providers</strong> — email / SMTP or
                WhatsApp-related services when you enable invoice sharing
              </li>
              <li>
                <strong>GST / e-invoice / e-way providers</strong> — only when
                you configure and use those integrations
              </li>
              <li>
                <strong>Payment gateways</strong> — for platform subscription
                payments when enabled
              </li>
              <li>
                <strong>Authorities</strong> — if required by law or valid legal
                process
              </li>
            </ul>
            <p>
              Staff with platform (Super Admin) access may view tenant metadata
              and support-related records as needed to operate the service; they
              are bound by internal access controls.
            </p>
          </section>

          <section>
            <h2>7. Cookies and local storage</h2>
            <p>
              The web app uses essential storage (for example authentication
              tokens and theme preferences) required to keep you signed in and
              remember UI settings. The marketing site may store a short-lived
              preference that you dismissed an enquiry popup. We do not use
              third-party advertising cookies on the billing product.
            </p>
          </section>

          <section>
            <h2>8. Mobile applications</h2>
            <p>
              Our Android / iOS apps use the same APIs as the web product. They
              may store an access token in secure device storage, cache limited
              business data for usability, and request permissions only as needed
              (for example network access, and share/print related system
              features). Uninstalling the app removes local app data; server-side
              tenant data remains until your organisation deletes it or closes
              the account.
            </p>
          </section>

          <section>
            <h2>9. Retention</h2>
            <ul>
              <li>
                Account and billing records are retained while your subscription /
                tenant is active and for a reasonable period afterward for
                backups, dispute resolution, and legal compliance
              </li>
              <li>
                Soft-deleted records may remain in a recycle bin until purged per
                product rules
              </li>
              <li>
                Enquiry form submissions are retained for sales/support follow-up
              </li>
              <li>Security and audit logs are retained for security and accountability</li>
            </ul>
          </section>

          <section>
            <h2>10. Security</h2>
            <p>
              We use industry-standard measures including encrypted transport
              (HTTPS), hashed passwords, role-based access control, and
              tenant isolation in the application layer. No method of
              transmission or storage is 100% secure; please use strong passwords
              and protect your Client ID credentials.
            </p>
          </section>

          <section>
            <h2>11. Your choices and rights</h2>
            <p>Subject to applicable law, you may request to:</p>
            <ul>
              <li>Access or correct account profile information</li>
              <li>Export or delete business data you control (via product tools or support)</li>
              <li>Close your user account (tenant admin) or request tenant deactivation</li>
              <li>Withdraw consent for marketing follow-ups on public enquiries</li>
            </ul>
            <p>
              Contact{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{' '}
              <Link to="/contact">Contact us</Link>. We may need to verify your
              identity and authority (especially for tenant-wide requests).
            </p>
          </section>

          <section>
            <h2>12. Children</h2>
            <p>
              The service is designed for business users and is not directed at
              children under 18. We do not knowingly create accounts for minors.
            </p>
          </section>

          <section>
            <h2>13. International transfers</h2>
            <p>
              Primary operations target users in India. If infrastructure or
              subprocessors process data outside India, we take reasonable steps
              to protect that data consistent with this policy and applicable
              law.
            </p>
          </section>

          <section>
            <h2>14. Changes</h2>
            <p>
              We may update this policy from time to time. The “Last updated”
              date at the top will change when we do. Continued use of the web
              or mobile apps after an update constitutes acceptance of the
              revised policy where permitted by law.
            </p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>
              <strong>Indian Software Services Private Limited</strong>
              <br />
              Product: {BRAND.productName} ({BRAND.productTagline})
              <br />
              Website:{' '}
              <a href={SITE_URL}>{SITE_URL}</a>
              <br />
              Email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              <br />
              Form: <Link to="/contact">Contact us</Link>
            </p>
          </section>
        </div>
      </article>
    </PublicSiteLayout>
  );
}
