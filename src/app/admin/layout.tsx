import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { getAdminStats } from "@/features/admin/actions";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await loadAdminContext();
  return <AdminWorkspace adminName={context.name} adminRole={context.role} counts={context.counts}>{children}</AdminWorkspace>;
}

async function loadAdminContext() {
  try {
    const [admin, statsResult] = await Promise.all([
      requireRole(["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"]),
      getAdminStats(),
    ]);
    const stats = statsResult.success && statsResult.data ? statsResult.data : null;
    return {
      name: admin.username ?? "VELOX admin",
      role: admin.role,
      counts: {
        disputes: stats?.pendingDisputes ?? 0,
        finance: (stats?.pendingPayments ?? 0) + (stats?.pendingTransactions ?? 0),
        matches: stats?.matchesNeedingAttention ?? 0,
        registrations: stats?.registrations ?? 0,
        notifications: 0,
      },
    };
  } catch {
    redirect("/admin-login");
  }
}
