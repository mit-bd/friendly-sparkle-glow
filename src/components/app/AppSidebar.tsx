import { ChevronRight } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CompanyLogo } from "./CompanyLogo";
import { NAV_ITEMS } from "@/lib/modules";
import { useAuth } from "@/lib/auth-context";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = useAuth();
  const { setOpenMobile } = useSidebar();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  const visible = NAV_ITEMS.filter((item) => can(item.module, "view"));

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3.5">
        <CompanyLogo size="sm" showTagline />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                if (!item.children) {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)}>
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
                        <SidebarMenuButton isActive={groupActive}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.to}>
                              <SidebarMenuSubButton asChild isActive={pathname === child.to}>
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
    </Sidebar>
  );
}