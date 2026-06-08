import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import type { ModuleKey, PermissionAction } from "@/lib/modules";

interface PermissionGateProps {
  module: ModuleKey;
  action?: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  module,
  action = "view",
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can } = useAuth();
  if (!can(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}