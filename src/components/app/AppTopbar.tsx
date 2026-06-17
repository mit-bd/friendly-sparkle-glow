import { Bell, LogOut, User as UserIcon } from "lucide-react";
import { Link, useNavigate } from "@/lib/router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { CompanyLogo } from "./CompanyLogo";
import { GlobalSearch } from "./GlobalSearch";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/lib/auth-context";
import { getSignedUrl } from "@/lib/storage";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { useEffect, useState } from "react";

export function AppTopbar() {
  const { profile, user, primaryRole, signOut, isOwner } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { count: unread } = useUnreadNotifications();

  useEffect(() => {
    let active = true;
    getSignedUrl("avatars", profile?.avatar_url).then((u) => active && setAvatarUrl(u));
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  const displayName = profile?.full_name?.trim() || user?.email || "User";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/80 px-3 pt-safe shadow-soft backdrop-blur-xl sm:px-6 md:h-16">
      <SidebarTrigger className="-ml-1" />
      <div className="md:hidden">
        <CompanyLogo size="sm" />
      </div>
      <div className="flex-1" />

      {/* Search & notifications are company-workflow tools — hidden for the Platform Owner. */}
      {!isOwner && <GlobalSearch />}

      {!isOwner && (
        <Button variant="ghost" size="icon" asChild aria-label="Notifications" className="relative">
          <Link to="/notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-semibold leading-none text-brand-foreground ring-2 ring-background">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        </Button>
      )}
      {/* Theme toggle stays on desktop; mobile header keeps only logo, search, notifications, profile */}
      <div className="hidden md:block">
        <ThemeToggle />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="ml-1 h-9 gap-2 px-1.5">
            <Avatar className="h-7 w-7">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="text-xs">{initials || "U"}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
              {displayName}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-1.5">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user?.email}
            </span>
            {primaryRole && (
              <span className="pt-1">
                <RoleBadge role={primaryRole} />
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <UserIcon className="h-4 w-4" />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}