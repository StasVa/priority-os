import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { AuthLoading } from "./AuthLoading";

export function RequireAnon({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
