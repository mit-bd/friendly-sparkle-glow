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
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "dashboard"
  | "expenses"
  | "marketing"
  | "returns"
  | "damages"
  | "reports"
  | "audit"
  | "users"
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
    label: "Expenses",
    to: "/expenses",
    icon: Receipt,
    module: "expenses",
    children: [
      { label: "All Expenses", to: "/expenses" },
      { label: "Add Expense", to: "/expenses/add" },
      { label: "Pending Approvals", to: "/expenses/pending" },
      { label: "Categories", to: "/expenses/categories" },
      { label: "Recycle Bin", to: "/expenses/recycle-bin" },
    ],
  },
  { label: "Marketing", to: "/marketing", icon: Megaphone, module: "marketing" },
  { label: "Returns", to: "/returns", icon: Undo2, module: "returns" },
  { label: "Damages", to: "/damages", icon: PackageX, module: "damages" },
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
      { label: "Recycle Bin", to: "/audit/recycle-bin" },
    ],
  },
  { label: "Notifications", to: "/notifications", icon: Bell, module: "dashboard" },
  { label: "Users & Roles", to: "/users", icon: Users, module: "users" },
  {
    label: "Settings",
    to: "/settings/company",
    icon: Settings,
    module: "settings",
    children: [
      { label: "Company Profile", to: "/settings/company" },
      { label: "Signatories", to: "/settings/signatories" },
      { label: "Notification Settings", to: "/settings/notifications" },
      { label: "Permissions", to: "/settings/permissions" },
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
  returns: "Returns",
  damages: "Damages",
  reports: "Reports",
  audit: "Audit & History",
  users: "Users & Roles",
  settings: "Settings",
};