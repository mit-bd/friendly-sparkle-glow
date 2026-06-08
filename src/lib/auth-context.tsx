import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { ModuleKey, PermissionAction } from "./modules";
import { logActivity } from "./audit";

export type AppRole = "admin" | "manager" | "accountant" | "viewer";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive";
  avatar_url: string | null;
}

interface PermissionRow {
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_export: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  primaryRole: AppRole | null;
  can: (module: ModuleKey, action: PermissionAction) => boolean;
  canAccessModule: (module: ModuleKey) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = ["admin", "manager", "accountant", "viewer"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionRow>>({});
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile) ?? null);
    const userRoles = (roleRows ?? []).map((r) => r.role as AppRole);
    setRoles(userRoles);

    if (userRoles.length > 0) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("module, can_view, can_edit, can_approve, can_export")
        .in("role", userRoles);
      const map: Record<string, PermissionRow> = {};
      for (const p of perms ?? []) {
        const existing = map[p.module];
        map[p.module] = existing
          ? {
              module: p.module,
              can_view: existing.can_view || p.can_view,
              can_edit: existing.can_edit || p.can_edit,
              can_approve: existing.can_approve || p.can_approve,
              can_export: existing.can_export || p.can_export,
            }
          : (p as PermissionRow);
      }
      setPermissions(map);
    } else {
      setPermissions({});
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) await loadUserData(data.session.user.id);
  }, [loadUserData]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadUserData(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        // defer to avoid deadlock inside the callback
        setTimeout(() => loadUserData(sess.user.id), 0);
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRoles([]);
        setPermissions({});
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const isAdmin = roles.includes("admin");

  const can = useCallback(
    (module: ModuleKey, action: PermissionAction) => {
      if (isAdmin) return true;
      const row = permissions[module];
      if (!row) return false;
      return action === "view"
        ? row.can_view
        : action === "edit"
          ? row.can_edit
          : action === "approve"
            ? row.can_approve
            : row.can_export;
    },
    [permissions, isAdmin],
  );

  const primaryRole = useMemo(
    () => ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null,
    [roles],
  );

  // A user can reach a module if they hold ANY capability on it (view, edit,
  // approve, or export). This lets roles such as "accountant" — who can create
  // but not view-all — still open the module while RLS scopes their data.
  const canAccessModule = useCallback(
    (module: ModuleKey) =>
      isAdmin ||
      (["view", "edit", "approve", "export"] as PermissionAction[]).some((a) =>
        can(module, a),
      ),
    [can, isAdmin],
  );

  const signOut = useCallback(async () => {
    await logActivity({ action: "logout", entityType: "session" });
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setPermissions({});
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    loading,
    isAdmin,
    primaryRole,
    can,
    canAccessModule,
    refresh,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}