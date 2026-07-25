import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Receipt,
  ShoppingCart,
  Smartphone,
  Truck,
  UserSquare2,
  Warehouse,
} from 'lucide-react';
import { dashboardApi } from '../../api';
import { formatInr, toNum } from '../../utils/format';
import { PageHeader } from '../../components/ui';

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [cash, setCash] = useState(0);
  const [upi, setUpi] = useState(0);
  const [card, setCard] = useState(0);
  const [today, setToday] = useState('');

  useEffect(() => {
    dashboardApi
      .todaySummary()
      .then(({ invoices, collections, today: d }) => {
        setToday(d);
        setInvoiceCount(invoices.length);
        setTotal(toNum(collections.total));
        setCash(toNum(collections.cash));
        setUpi(toNum(collections.upi));
        setCard(toNum(collections.card));
      })
      .catch(() => {
        setInvoiceCount(0);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard"
        subtitle={today ? `Collections for ${today}` : "Today's overview"}
        actions={
          <Link to="/app/help" className="btn btn-secondary">
            <BookOpen size={16} /> Help guide
          </Link>
        }
      />

      {loading ? (
        <p className="muted">Loading summary…</p>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-label">
                <FileText size={14} /> Bills today
              </div>
              <div className="stat-value">{invoiceCount}</div>
            </div>
            <div className="stat">
              <div className="stat-label">
                <Banknote size={14} /> Total collected
              </div>
              <div className="stat-value">{formatInr(total)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">
                <Banknote size={14} /> Cash
              </div>
              <div className="stat-value">{formatInr(cash)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">
                <Smartphone size={14} /> UPI
              </div>
              <div className="stat-value">{formatInr(upi)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">
                <CreditCard size={14} /> Card
              </div>
              <div className="stat-value">{formatInr(card)}</div>
            </div>
          </div>

          <div className="panel guide-welcome">
            <div className="guide-welcome-text">
              <h2 className="panel-title">
                <BookOpen size={18} /> New here?
              </h2>
              <p className="muted">
                Follow the professional setup checklist — GST settings, branding,
                masters, then your first bill — in under 15 minutes.
              </p>
            </div>
            <Link to="/app/help?section=start" className="btn btn-primary">
              Open getting started
            </Link>
          </div>

          <div className="panel">
            <h2 className="panel-title">Quick links</h2>
            <div className="quick-links">
              <Link to="/app/bills/new" className="quick-link">
                <Receipt size={16} /> New bill
              </Link>
              <Link to="/app/pos" className="quick-link">
                <MonitorSmartphone size={16} /> POS
              </Link>
              <Link to="/app/bills" className="quick-link">
                <FileText size={16} /> View bills
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
              <Link to="/app/parties" className="quick-link">
                <UserSquare2 size={16} /> Parties
              </Link>
              <Link to="/app/items" className="quick-link">
                <Package size={16} /> Items
              </Link>
              <Link to="/app/reports" className="quick-link">
                <BarChart3 size={16} /> Reports
              </Link>
              <Link to="/app/help" className="quick-link">
                <BookOpen size={16} /> Help
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
