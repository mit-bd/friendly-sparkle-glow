import { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  FileBarChart,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouterState } from "@/lib/router";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NAV_ITEMS, OWNER_NAV_ITEMS, type ModuleKey } from "@/lib/modules";
import { useAuth } from "@/lib/auth-context";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { cn } from "@/lib/utils";

interface PrimaryItem {
  label: string;
  to: string;
  icon: LucideIcon;
  module: ModuleKey;
  /** match active state for nested routes under this section */
  match: string;
}

/** Bottom-bar primary destinations (thumb zone). */
const PRIMARY: PrimaryItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, module: "dashboard", match: "/" },
  { label: "Expenses", to: "/expenses", icon: Receipt, module: "expenses", match: "/expenses" },
  { label: "Finance", to: "/finance", icon: Landmark, module: "finance", match: "/finance" },
  {
    label: "Reports",
    to: "/reports/summary",
    icon: FileBarChart,
    module: "reports",
    match: "/reports",
  },
];

const PRIMARY_TOS = ["/", "/expenses", "/finance", "/reports/summary"];
/** Everything else lives behind the "More" drawer. */
const MORE_ITEMS = NAV_ITEMS.filter((i) => !PRIMARY_TOS.includes(i.to));

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { canAccessModule, isOwner } = useAuth();
  const { count: unread } = useUnreadNotifications();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (match: string) =>
    match === "/" ? pathname === "/" : pathname === match || pathname.startsWith(match + "/");

  const primary = PRIMARY.filter((i) => canAccessModule(i.module));
  const more = MORE_ITEMS.filter((i) => canAccessModule(i.module));

  // Is any "More" destination the active route? Highlight the More tab if so.
  const moreActive =
    more.some((i) => isActive(i.to)) ||
    (isOwner && OWNER_NAV_ITEMS.some((i) => isActive(i.to)));

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors",
      active ? "text-brand" : "text-muted-foreground active:bg-accent",
    );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl pb-safe md:hidden no-print">
        <div className="mx-auto flex h-16 max-w-lg items-stretch gap-1 px-2">
          {primary.map((item) => {
            const active = isActive(item.match);
            return (
              <Link key={item.to} to={item.to} className={tabClass(active)}>
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-brand-gradient-soft",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(moreActive)}>
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                moreActive && "bg-brand-gradient-soft",
              )}
            >
              <Menu className="h-5 w-5" />
            </span>
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-safe">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>

          {isOwner && (
            <div className="mt-4">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Platform Owner
              </p>
              <div className="grid grid-cols-3 gap-2">
                {OWNER_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition-colors active:bg-accent",
                      isActive(item.to) && "border-brand/40 bg-brand-gradient-soft",
                    )}
                  >
                    <item.icon className="h-5 w-5 text-brand" />
                    <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {more.map((item) => {
              const showBadge = item.to === "/notifications" && unread > 0;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition-colors active:bg-accent",
                    isActive(item.to) && "border-brand/40 bg-brand-gradient-soft",
                  )}
                >
                  <item.icon className="h-5 w-5 text-brand" />
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                  {showBadge && (
                    <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gradient px-1 text-[9px] font-semibold leading-none text-brand-foreground">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
