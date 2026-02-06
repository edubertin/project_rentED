export type DashboardData = {
  kpis: {
    monthlyRent: number;
    monthlyMaintenance: number;
    activeWorkOrders: number;
    avgHealthScore: number;
  };
  trends: {
    months: string[];
    rent: number[];
    maintenance: number[];
    workOrders: number[];
  };
  insights: { id: string; title: string; body: string; severity?: "info" | "warn" | "danger" }[];
  warnings: { id: string; title: string; body: string; dueDate?: string; severity: "info" | "warn" | "danger" }[];
  health: {
    watch: { propertyId: number; name: string; score: number; maintenance30d: number }[];
    healthy: { propertyId: number; name: string; score: number; maintenance30d: number }[];
  };
};

export async function fetchDashboardData(): Promise<DashboardData> {
  // TODO: Replace with real backend endpoint (e.g. GET /dashboard)
  return {
    kpis: {
      monthlyRent: 58240,
      monthlyMaintenance: 7420,
      activeWorkOrders: 8,
      avgHealthScore: 86,
    },
    trends: {
      months: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"],
      rent: [42, 45, 46, 49, 54, 58],
      maintenance: [6, 8, 5, 7, 9, 7],
      workOrders: [3, 4, 6, 5, 7, 8],
    },
    insights: [
      {
        id: "ins-1",
        title: "Renewals outlook",
        body: "3 leases are within 90 days of renewal. Consider pre‑inspections to avoid churn.",
        severity: "info",
      },
      {
        id: "ins-2",
        title: "Maintenance spike",
        body: "Maintenance costs rose 12% vs last month driven by plumbing work orders.",
        severity: "warn",
      },
      {
        id: "ins-3",
        title: "Healthy occupancy",
        body: "Occupancy is stable and rent collection remains consistent across top properties.",
        severity: "info",
      },
    ],
    warnings: [
      {
        id: "warn-1",
        title: "Overdue inspection",
        body: "Property Condominio Lago is overdue for a safety inspection.",
        dueDate: "2026-02-12",
        severity: "warn",
      },
      {
        id: "warn-2",
        title: "High maintenance",
        body: "Residencial Azul exceeded monthly maintenance budget.",
        dueDate: "2026-02-20",
        severity: "danger",
      },
    ],
    health: {
      watch: [
        { propertyId: 101, name: "Condominio Lago", score: 62, maintenance30d: 4 },
        { propertyId: 104, name: "Residencial Azul", score: 68, maintenance30d: 3 },
      ],
      healthy: [
        { propertyId: 110, name: "Vista Verde", score: 92, maintenance30d: 1 },
        { propertyId: 112, name: "Casa Prime", score: 89, maintenance30d: 0 },
      ],
    },
  };
}
