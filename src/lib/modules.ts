import {
  LayoutDashboard,
  Receipt,
  Megaphone,
  Undo2,
  PackageX,
  FileBarChart,
  Bell,
  Users,
  Settings,
  History,
  TrendingDown,
  Repeat,
  LineChart,
  Landmark,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "dashboard"
  | "expenses"
  | "marketing"
  | "fixed_costs"
  | "returns"
  | "damages"
  | "reports"
  | "audit"
  | "users"
  | "finance"
  | "budgets"
  | "settings";

/** Default product/company name used before a custom company profile is set. */
export const APP_NAME = "Motion IT BD";
export const APP_TAGLINE = "Business Expense Management";

export type PermissionAction = "view" | "edit" | "approve" | "export";

export interface NavChild {
  label: string;
  to: string;
}

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  module: ModuleKey;
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, module: "dashboard" },
  {
    label: "Executive Analytics",
    to: "/intelligence",
    icon: LineChart,
    module: "dashboard",
  },
  {
    label: "Expenses",
    to: "/expenses",
    icon: Receipt,
    module: "expenses",
    children: [
      { label: "All Expenses", to: "/expenses" },
      { label: "Add Expense", to: "/expenses/add" },
      { label: "Pending Approvals", to: "/expenses/pending" },
      { label: "Categories", to: "/expenses/categories" },
    ],
  },
  {
    label: "Marketing",
    to: "/marketing",
    icon: Megaphone,
    module: "marketing",
    children: [
      { label: "Overview", to: "/marketing" },
      { label: "Add Marketing Cost", to: "/marketing/add" },
      { label: "Marketing Reports", to: "/marketing/reports" },
    ],
  },
  {
    label: "Fixed Costs",
    to: "/fixed-costs",
    icon: Repeat,
    module: "fixed_costs",
    children: [
      { label: "Overview", to: "/fixed-costs" },
      { label: "Fixed Cost Reports", to: "/fixed-costs/reports" },
    ],
  },
  {
    label: "Returns",
    to: "/returns",
    icon: Undo2,
    module: "returns",
    children: [
      { label: "Overview", to: "/returns" },
      { label: "Add Return", to: "/returns/add" },
      { label: "Pending Approvals", to: "/returns/pending" },
      { label: "Return Reports", to: "/returns/reports" },
    ],
  },
  {
    label: "Damages",
    to: "/damages",
    icon: PackageX,
    module: "damages",
    children: [
      { label: "Overview", to: "/damages" },
      { label: "Add Damage", to: "/damages/add" },
      { label: "Pending Approvals", to: "/damages/pending" },
      { label: "Damage Reports", to: "/damages/reports" },
    ],
  },
  { label: "Loss Management", to: "/loss", icon: TrendingDown, module: "returns" },
  {
    label: "Finance Control",
    to: "/finance",
    icon: Landmark,
    module: "finance",
    children: [
      { label: "Finance Dashboard", to: "/finance" },
      { label: "Receivables", to: "/finance/receivables" },
      { label: "Payables", to: "/finance/payables" },
      { label: "Finance Reports", to: "/finance/reports" },
    ],
  },
  {
    label: "Budget Control",
    to: "/budgets",
    icon: Wallet,
    module: "budgets",
    children: [
      { label: "Budget Dashboard", to: "/budgets" },
      { label: "Create Budget", to: "/budgets/create" },
      { label: "Budget Reports", to: "/budgets/reports" },
    ],
  },
  {
    label: "Reports",
    to: "/reports/summary",
    icon: FileBarChart,
    module: "reports",
    children: [
      { label: "Reports Center", to: "/reports/summary" },
      { label: "Export History", to: "/reports/export-history" },
    ],
  },
  {
    label: "Audit & History",
    to: "/audit",
    icon: History,
    module: "audit",
    children: [
      { label: "Activity Logs", to: "/audit" },
      { label: "Recycle Bin", to: "/expenses/recycle-bin" },
    ],
  },
  { label: "Notifications", to: "/notifications", icon: Bell, module: "dashboard" },
  { label: "Users & Roles", to: "/users", icon: Users, module: "users" },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
    module: "settings",
    children: [
      { label: "Settings Hub", to: "/settings" },
      { label: "Company Profile", to: "/settings/company" },
      { label: "Signatories", to: "/settings/signatories" },
      { label: "Marketing Setup", to: "/settings/marketing" },
      { label: "Fixed Cost Management", to: "/settings/fixed-costs" },
      { label: "Loss Setup", to: "/settings/loss" },
      { label: "Notification Settings", to: "/settings/notifications" },
      { label: "Permissions", to: "/settings/permissions" },
      { label: "User Preferences", to: "/settings/preferences" },
      { label: "System Health", to: "/system" },
      { label: "System Readiness", to: "/readiness" },
      { label: "QA Validation", to: "/qa" },
      { label: "Backup & Recovery", to: "/backup" },
    ],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  accountant: "Accountant",
  viewer: "Viewer",
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  marketing: "Marketing",
  fixed_costs: "Fixed Costs",
  returns: "Returns",
  damages: "Damages",
  reports: "Reports",
  audit: "Audit & History",
  users: "Users & Roles",
  finance: "Finance Control",
  budgets: "Budget Control",
  settings: "Settings",
};