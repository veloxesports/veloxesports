import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"]);
  } catch {
    redirect("/admin-login");
  }

  return children;
}
