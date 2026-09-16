import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Department } from "@biodinamica/supabase";
import { useAuth } from "./useAuth";
import { defaultPathFor } from "./navigation";

/** Gates a route by department and/or admin level. Leave `department`
 *  unset for screens shared across every department. Pass an array
 *  (e.g. ["comercial", "tecnica"]) for screens shared across a few
 *  specific departments only — like Almoço. Pass `requireStaffLink` for
 *  the individual self-service screens (Meu Almoço) — any login linked
 *  to a `staff` roster row, regardless of department/level. */
export function RequireAccess({
  department,
  adminOnly,
  requireStaffLink,
  children,
}: {
  department?: Department | Department[];
  adminOnly?: boolean;
  requireStaffLink?: boolean;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  if (!profile) return null;
  const departmentOk =
    !department || (Array.isArray(department) ? department.includes(profile.department) : profile.department === department);
  const allowed = departmentOk && (!adminOnly || profile.level === "admin") && (!requireStaffLink || profile.staff_id != null);
  if (!allowed) return <Navigate to={defaultPathFor(profile)} replace />;
  return <>{children}</>;
}
