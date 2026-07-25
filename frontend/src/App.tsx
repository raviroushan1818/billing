import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';
import { PlatformShell } from './layouts/PlatformShell';
import { AppShell } from './layouts/AppShell';
import { ClientsPage } from './pages/platform/ClientsPage';
import { InquiriesPage } from './pages/platform/InquiriesPage';
import { PlansPage } from './pages/platform/PlansPage';
import { SubscriptionsPage } from './pages/platform/SubscriptionsPage';
import { PaymentGatewayPage } from './pages/platform/PaymentGatewayPage';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/app/Dashboard';
import { NewBillPage } from './pages/app/NewBillPage';
import { BillsPage } from './pages/app/BillsPage';
import { PartiesPage } from './pages/app/PartiesPage';
import { ItemsPage } from './pages/app/ItemsPage';
import { GstSettingsPage } from './pages/app/GstSettingsPage';
import { BrandingPage } from './pages/app/BrandingPage';
import { IntegrationsPage } from './pages/app/IntegrationsPage';
import { UsersPage } from './pages/app/UsersPage';
import { RecycleBinPage } from './pages/app/RecycleBinPage';
import { ReportsPage } from './pages/app/ReportsPage';
import { BillingPage } from './pages/app/BillingPage';
import { NotesPage } from './pages/app/NotesPage';
import { CreditDebitNotePage } from './pages/app/CreditDebitNotePage';
import { AuditLogPage } from './pages/app/AuditLogPage';
import { AccountPage } from './pages/app/AccountPage';
import { InventoryPage } from './pages/app/InventoryPage';
import { PurchasesPage } from './pages/app/PurchasesPage';
import { EwayPage } from './pages/app/EwayPage';
import { PosPage } from './pages/app/PosPage';
import { HelpGuidePage } from './pages/app/HelpGuidePage';
import { APP_ROLES } from './auth/roles';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireRole role="SUPER_ADMIN" />}>
          <Route path="/platform" element={<PlatformShell />}>
            <Route index element={<Navigate to="clients" replace />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="payments" element={<PaymentGatewayPage />} />
            <Route path="inquiries" element={<InquiriesPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth roles={[...APP_ROLES]} />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="help" element={<HelpGuidePage />} />
            <Route path="bills/new" element={<NewBillPage />} />
            <Route path="bills/:id" element={<NewBillPage />} />
            <Route path="bills" element={<BillsPage />} />
            <Route path="pos" element={<PosPage />} />
            <Route path="parties" element={<PartiesPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="eway" element={<EwayPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="notes/document" element={<CreditDebitNotePage />} />
            <Route path="gst" element={<GstSettingsPage />} />
            <Route path="branding" element={<BrandingPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="recycle-bin" element={<RecycleBinPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
