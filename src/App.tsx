import { Component, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import { ThemeProvider } from "@/lib/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { BrandingProvider } from "@/lib/branding-context";
import { AppShell } from "@/components/app/AppShell";
import { DynamicFavicon } from "@/components/app/DynamicFavicon";
import { Link } from "@/lib/router";
import { Loader2, ShieldX } from "lucide-react";

/* ---------------- Public routes ---------------- */
import { Route as AuthRoute } from "@/routes/auth";
import { Route as ResetPwRoute } from "@/routes/reset-password";
import { Route as UpdatePwRoute } from "@/routes/update-password";

/* ---------------- Authenticated leaves ---------------- */
import { Route as DashboardRoute } from "@/routes/_authenticated/index";
import { Route as AuditRoute } from "@/routes/_authenticated/audit";
import { Route as BackupRoute } from "@/routes/_authenticated/backup";
import { Route as IntelligenceRoute } from "@/routes/_authenticated/intelligence";
import { Route as LossRoute } from "@/routes/_authenticated/loss";
import { Route as NotificationsRoute } from "@/routes/_authenticated/notifications";
import { Route as ProfileRoute } from "@/routes/_authenticated/profile";
import { Route as QaRoute } from "@/routes/_authenticated/qa";
import { Route as ReadinessRoute } from "@/routes/_authenticated/readiness";
import { Route as SystemRoute } from "@/routes/_authenticated/system";
import { Route as UsersRoute } from "@/routes/_authenticated/users";

/* owner governance */
import { Route as OwnerDashboardRoute } from "@/routes/_authenticated/owner";
import { Route as OwnerRegistrationsRoute } from "@/routes/_authenticated/owner.registrations";
import { Route as OwnerCompaniesRoute } from "@/routes/_authenticated/owner.companies";
import { Route as OwnerCompanyDetailRoute } from "@/routes/_authenticated/owner.companies.$id";
import { Route as OwnerUsersRoute } from "@/routes/_authenticated/owner.users";
import { Route as OwnerAuditRoute } from "@/routes/_authenticated/owner.audit";
import { Route as OwnerSecurityRoute } from "@/routes/_authenticated/owner.security";
import { Route as OwnerAnalyticsRoute } from "@/routes/_authenticated/owner.analytics";
import { Route as OwnerSettingsRoute } from "@/routes/_authenticated/owner.settings";

/* budgets */
import { Route as BudgetsLayout } from "@/routes/_authenticated/budgets";
import { Route as BudgetsIndex } from "@/routes/_authenticated/budgets.index";
import { Route as BudgetsCreate } from "@/routes/_authenticated/budgets.create";
import { Route as BudgetDetail } from "@/routes/_authenticated/budgets.$id";
import { Route as BudgetsReports } from "@/routes/_authenticated/budgets.reports";

/* damages (placeholder parent — children intentionally do not render, matching prior behavior) */
import { Route as DamagesLayout } from "@/routes/_authenticated/damages";
import { Route as DamagesIndex } from "@/routes/_authenticated/damages.index";
import { Route as DamagesAdd } from "@/routes/_authenticated/damages.add";
import { Route as DamagesPending } from "@/routes/_authenticated/damages.pending";
import { Route as DamagesReports } from "@/routes/_authenticated/damages.reports";
import { Route as DamageDetail } from "@/routes/_authenticated/damages.$id";
import { Route as DamageType } from "@/routes/_authenticated/damages.type.$id";

/* dashboard drill-downs */
import { Route as DashboardCategory } from "@/routes/_authenticated/dashboard.category.$id";
import { Route as DashboardSubcategory } from "@/routes/_authenticated/dashboard.subcategory.$id";

/* expenses */
import { Route as ExpensesIndex } from "@/routes/_authenticated/expenses.index";
import { Route as ExpensesAdd } from "@/routes/_authenticated/expenses.add";
import { Route as ExpenseDetail } from "@/routes/_authenticated/expenses.$id";
import { Route as ExpensesCategories } from "@/routes/_authenticated/expenses.categories";
import { Route as ExpensesPending } from "@/routes/_authenticated/expenses.pending";
import { Route as ExpensesRecycleBin } from "@/routes/_authenticated/expenses.recycle-bin";

/* finance */
import { Route as FinanceLayout } from "@/routes/_authenticated/finance";
import { Route as FinanceIndex } from "@/routes/_authenticated/finance.index";
import { Route as FinancePayables } from "@/routes/_authenticated/finance.payables";
import { Route as FinancePayableDetail } from "@/routes/_authenticated/finance.payables.$id";
import { Route as FinanceReceivables } from "@/routes/_authenticated/finance.receivables";
import { Route as FinanceReceivableDetail } from "@/routes/_authenticated/finance.receivables.$id";
import { Route as FinanceReports } from "@/routes/_authenticated/finance.reports";

/* fixed costs */
import { Route as FixedCostsLayout } from "@/routes/_authenticated/fixed-costs";
import { Route as FixedCostsIndex } from "@/routes/_authenticated/fixed-costs.index";
import { Route as FixedCostDetail } from "@/routes/_authenticated/fixed-costs.$id";
import { Route as FixedCostsReports } from "@/routes/_authenticated/fixed-costs.reports";

/* marketing */
import { Route as MarketingLayout } from "@/routes/_authenticated/marketing";
import { Route as MarketingIndex } from "@/routes/_authenticated/marketing.index";
import { Route as MarketingAdd } from "@/routes/_authenticated/marketing.add";
import { Route as MarketingPlatform } from "@/routes/_authenticated/marketing.platform.$id";
import { Route as MarketingReports } from "@/routes/_authenticated/marketing.reports";

/* returns (placeholder parent — children intentionally do not render, matching prior behavior) */
import { Route as ReturnsLayout } from "@/routes/_authenticated/returns";
import { Route as ReturnsIndex } from "@/routes/_authenticated/returns.index";
import { Route as ReturnsAdd } from "@/routes/_authenticated/returns.add";
import { Route as ReturnsPending } from "@/routes/_authenticated/returns.pending";
import { Route as ReturnDetail } from "@/routes/_authenticated/returns.$id";
import { Route as ReturnReason } from "@/routes/_authenticated/returns.reason.$id";
import { Route as ReturnsReports } from "@/routes/_authenticated/returns.reports";

/* reports */
import { Route as ReportsSummary } from "@/routes/_authenticated/reports.summary";
import { Route as ReportsDetailed } from "@/routes/_authenticated/reports.detailed";
import { Route as ReportsExportHistory } from "@/routes/_authenticated/reports.export-history";

/* settings */
import { Route as SettingsIndex } from "@/routes/_authenticated/settings.index";
import { Route as SettingsCompany } from "@/routes/_authenticated/settings.company";
import { Route as SettingsFixedCosts } from "@/routes/_authenticated/settings.fixed-costs";
import { Route as SettingsLoss } from "@/routes/_authenticated/settings.loss";
import { Route as SettingsMarketing } from "@/routes/_authenticated/settings.marketing";
import { Route as SettingsNotifications } from "@/routes/_authenticated/settings.notifications";
import { Route as SettingsPermissions } from "@/routes/_authenticated/settings.permissions";
import { Route as SettingsPreferences } from "@/routes/_authenticated/settings.preferences";
import { Route as SettingsSignatories } from "@/routes/_authenticated/settings.signatories";

const queryClient = new QueryClient();

/* ------------------------------------------------------------------ */
/* Auth gate + layout                                                  */
/* ------------------------------------------------------------------ */

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, profile, signOut } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  const status = profile?.status;
  if (status === "suspended" || status === "locked" || status === "pending") {
    return <AccountBlocked status={status} onSignOut={signOut} />;
  }
  return <>{children}</>;
}

function AccountBlocked({
  status,
  onSignOut,
}: {
  status: "suspended" | "locked" | "pending";
  onSignOut: () => void;
}) {
  const copy = {
    pending: {
      title: "Awaiting approval",
      body: "Your account is pending approval by the platform owner. You'll be able to sign in once it's approved.",
    },
    suspended: {
      title: "Account suspended",
      body: "Your account has been suspended. Please contact the platform owner for assistance.",
    },
    locked: {
      title: "Account locked",
      body: "Your account has been locked. Please contact the platform owner to regain access.",
    },
  }[status];
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <ShieldX className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
        <button
          onClick={onSignOut}
          className="mt-6 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <BrandingProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </BrandingProvider>
      </AuthGate>
    </AuthProvider>
  );
}

/* ------------------------------------------------------------------ */
/* 404 + error boundary                                                */
/* ------------------------------------------------------------------ */

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    reportLovableError(error, { boundary: "spa_root_error_boundary" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              This page didn't load
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Something went wrong on our end. You can try refreshing or head back home.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => this.setState({ error: null })}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Try again
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <DynamicFavicon />
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<AuthRoute.Component />} />
              <Route path="/reset-password" element={<ResetPwRoute.Component />} />
              <Route path="/update-password" element={<UpdatePwRoute.Component />} />

              {/* Authenticated */}
              <Route element={<AuthenticatedLayout />}>
                <Route index element={<DashboardRoute.Component />} />

                <Route path="audit" element={<AuditRoute.Component />} />
                <Route path="backup" element={<BackupRoute.Component />} />
                <Route path="intelligence" element={<IntelligenceRoute.Component />} />
                <Route path="loss" element={<LossRoute.Component />} />
                <Route path="notifications" element={<NotificationsRoute.Component />} />
                <Route path="profile" element={<ProfileRoute.Component />} />
                <Route path="qa" element={<QaRoute.Component />} />
                <Route path="readiness" element={<ReadinessRoute.Component />} />
                <Route path="system" element={<SystemRoute.Component />} />
                <Route path="users" element={<UsersRoute.Component />} />

                {/* Owner governance */}
                <Route path="owner" element={<OwnerDashboardRoute.Component />} />
                <Route path="owner/registrations" element={<OwnerRegistrationsRoute.Component />} />
                <Route path="owner/companies" element={<OwnerCompaniesRoute.Component />} />
                <Route path="owner/companies/:id" element={<OwnerCompanyDetailRoute.Component />} />
                <Route path="owner/users" element={<OwnerUsersRoute.Component />} />
                <Route path="owner/audit" element={<OwnerAuditRoute.Component />} />
                <Route path="owner/security" element={<OwnerSecurityRoute.Component />} />
                <Route path="owner/analytics" element={<OwnerAnalyticsRoute.Component />} />
                <Route path="owner/settings" element={<OwnerSettingsRoute.Component />} />

                {/* Budgets */}
                <Route path="budgets" element={<BudgetsLayout.Component />}>
                  <Route index element={<BudgetsIndex.Component />} />
                  <Route path="create" element={<BudgetsCreate.Component />} />
                  <Route path="reports" element={<BudgetsReports.Component />} />
                  <Route path=":id" element={<BudgetDetail.Component />} />
                </Route>

                {/* Damages (placeholder parent has no Outlet → children do not render) */}
                <Route path="damages" element={<DamagesLayout.Component />}>
                  <Route index element={<DamagesIndex.Component />} />
                  <Route path="add" element={<DamagesAdd.Component />} />
                  <Route path="pending" element={<DamagesPending.Component />} />
                  <Route path="reports" element={<DamagesReports.Component />} />
                  <Route path="type/:id" element={<DamageType.Component />} />
                  <Route path=":id" element={<DamageDetail.Component />} />
                </Route>

                {/* Dashboard drill-downs */}
                <Route path="dashboard/category/:id" element={<DashboardCategory.Component />} />
                <Route path="dashboard/subcategory/:id" element={<DashboardSubcategory.Component />} />

                {/* Expenses */}
                <Route path="expenses" element={<ExpensesIndex.Component />} />
                <Route path="expenses/add" element={<ExpensesAdd.Component />} />
                <Route path="expenses/categories" element={<ExpensesCategories.Component />} />
                <Route path="expenses/pending" element={<ExpensesPending.Component />} />
                <Route path="expenses/recycle-bin" element={<ExpensesRecycleBin.Component />} />
                <Route path="expenses/:id" element={<ExpenseDetail.Component />} />

                {/* Finance */}
                <Route path="finance" element={<FinanceLayout.Component />}>
                  <Route index element={<FinanceIndex.Component />} />
                  <Route path="payables" element={<FinancePayables.Component />} />
                  <Route path="payables/:id" element={<FinancePayableDetail.Component />} />
                  <Route path="receivables" element={<FinanceReceivables.Component />} />
                  <Route path="receivables/:id" element={<FinanceReceivableDetail.Component />} />
                  <Route path="reports" element={<FinanceReports.Component />} />
                </Route>

                {/* Fixed costs */}
                <Route path="fixed-costs" element={<FixedCostsLayout.Component />}>
                  <Route index element={<FixedCostsIndex.Component />} />
                  <Route path="reports" element={<FixedCostsReports.Component />} />
                  <Route path=":id" element={<FixedCostDetail.Component />} />
                </Route>

                {/* Marketing */}
                <Route path="marketing" element={<MarketingLayout.Component />}>
                  <Route index element={<MarketingIndex.Component />} />
                  <Route path="add" element={<MarketingAdd.Component />} />
                  <Route path="platform/:id" element={<MarketingPlatform.Component />} />
                  <Route path="reports" element={<MarketingReports.Component />} />
                </Route>

                {/* Returns (placeholder parent has no Outlet → children do not render) */}
                <Route path="returns" element={<ReturnsLayout.Component />}>
                  <Route index element={<ReturnsIndex.Component />} />
                  <Route path="add" element={<ReturnsAdd.Component />} />
                  <Route path="pending" element={<ReturnsPending.Component />} />
                  <Route path="reason/:id" element={<ReturnReason.Component />} />
                  <Route path="reports" element={<ReturnsReports.Component />} />
                  <Route path=":id" element={<ReturnDetail.Component />} />
                </Route>

                {/* Reports */}
                <Route path="reports/summary" element={<ReportsSummary.Component />} />
                <Route path="reports/detailed" element={<ReportsDetailed.Component />} />
                <Route path="reports/export-history" element={<ReportsExportHistory.Component />} />

                {/* Settings */}
                <Route path="settings" element={<SettingsIndex.Component />} />
                <Route path="settings/company" element={<SettingsCompany.Component />} />
                <Route path="settings/fixed-costs" element={<SettingsFixedCosts.Component />} />
                <Route path="settings/loss" element={<SettingsLoss.Component />} />
                <Route path="settings/marketing" element={<SettingsMarketing.Component />} />
                <Route path="settings/notifications" element={<SettingsNotifications.Component />} />
                <Route path="settings/permissions" element={<SettingsPermissions.Component />} />
                <Route path="settings/preferences" element={<SettingsPreferences.Component />} />
                <Route path="settings/signatories" element={<SettingsSignatories.Component />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster richColors position="top-right" />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}