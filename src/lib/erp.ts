import {
  Boxes,
  TrendingUp,
  Scale,
  Banknote,
  ShoppingCart,
  Building2,
  type LucideIcon,
} from "lucide-react";

/**
 * ERP Expansion Foundation.
 *
 * A scalable, declarative registry describing future ERP modules. NOTHING here
 * is built yet — this is the architectural seam future work plugs into:
 *
 *  - The dashboard / settings surfaces read this registry to advertise the
 *    roadmap consistently with Motion IT BD branding.
 *  - New modules follow the SAME proven pattern already used by Expenses,
 *    Marketing, Returns and Damages:
 *      1. table(s) + sequence counter + soft-delete + audit triggers
 *      2. a `*.ts` data layer (approved-only aggregation as pure functions)
 *      3. routes under src/routes/_authenticated/<module>.*
 *      4. a NAV entry in src/lib/modules.ts gated by a ModuleKey permission
 *      5. reuse of the report engine (reports.ts) and audit engine (audit.ts)
 *
 *  Only APPROVED records ever feed totals — the universal financial rule.
 */

export type FutureModuleKey =
  | "inventory"
  | "revenue"
  | "profit_loss"
  | "cash_flow"
  | "purchases"
  | "vendors";

export interface FutureModule {
  key: FutureModuleKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Suggested data tables for the eventual migration. */
  tables: string[];
  /** Whether figures should aggregate approved records only (financial rule). */
  approvedOnly: boolean;
}

export const FUTURE_MODULES: FutureModule[] = [
  {
    key: "inventory",
    label: "Inventory Management",
    description: "Track stock levels, movements and valuations across products.",
    icon: Boxes,
    tables: ["inventory_items", "inventory_movements"],
    approvedOnly: false,
  },
  {
    key: "revenue",
    label: "Revenue Tracking",
    description: "Record income streams and reconcile against expenses.",
    icon: TrendingUp,
    tables: ["revenue_entries", "revenue_sources"],
    approvedOnly: true,
  },
  {
    key: "profit_loss",
    label: "Profit & Loss",
    description: "Consolidated P&L combining approved revenue and costs.",
    icon: Scale,
    tables: [],
    approvedOnly: true,
  },
  {
    key: "cash_flow",
    label: "Cash Flow",
    description: "Inflow/outflow timelines and liquidity projections.",
    icon: Banknote,
    tables: ["cash_flow_entries"],
    approvedOnly: true,
  },
  {
    key: "purchases",
    label: "Purchase Management",
    description: "Purchase orders, receipts and approval workflows.",
    icon: ShoppingCart,
    tables: ["purchase_orders", "purchase_order_items"],
    approvedOnly: true,
  },
  {
    key: "vendors",
    label: "Vendor Management",
    description: "Vendor directory, terms and spend analytics.",
    icon: Building2,
    tables: ["vendors", "vendor_contacts"],
    approvedOnly: false,
  },
];
