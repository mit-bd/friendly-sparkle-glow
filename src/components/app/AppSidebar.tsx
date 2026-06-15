import { ChevronRight } from "lucide-react";
import { Link, useRouterState } from "@/lib/router";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CompanyLogo } from "./CompanyLogo";
import { ThemeToggle } from "./ThemeToggle";
import { NAV_ITEMS, OWNER_NAV_ITEMS } from "@/lib/modules";
import { useAuth } from "@/lib/auth-context";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { canAccessModule, isOwner } = useAuth();
  const { setOpenMobile } = useSidebar();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  const visible = NAV_ITEMS.filter((item) => canAccessModule(item.module));

  // Soft hover + a brand-gradient indicator bar on the active item.
  const navItemClass =
    "relative h-9 gap-2.5 rounded-lg text-sidebar-foreground/80 transition-colors duration-200 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-1 data-[active=true]:before:rounded-full data-[active=true]:before:bg-brand-gradient";

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <CompanyLogo size="sm" showTagline />
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        {isOwner && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
              Platform Owner
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {OWNER_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)} className={navItemClass}>
                      <Link to={item.to} onClick={() => setOpenMobile(false)}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visible.map((item) => {
                if (!item.children) {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)} className={navItemClass}>
                        <Link to={item.to} onClick={() => setOpenMobile(false)}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                const groupActive = item.children.some((c) => isActive(c.to));
                return (
                  <Collapsible
                    key={item.to}
                    defaultOpen={groupActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={groupActive} className={navItemClass}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="mr-0 gap-0.5 border-sidebar-border/70">
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.to}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === child.to}
                                className="text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent/80 data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
                              >
                                <Link to={child.to} onClick={() => setOpenMobile(false)}>
                                  <span>{child.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-sidebar-foreground/70">Appearance</span>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}