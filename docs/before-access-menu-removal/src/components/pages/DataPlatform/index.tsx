"use client";

import { useTranslations } from "next-intl";

import { GisMapWithAnalytics } from "@/components/pages/DataPlatform/GisMap";
import { RealTimeMonitor } from "@/components/pages/DataPlatform/RealTimeMonitor";
import { DataPlatformReports } from "@/components/pages/DataPlatform/Reports";
import { SolarCalendarFilter } from "@/components/pages/DataPlatform/SolarCalendarFilter";
import { useNavigate } from "@/hooks/useNavigate";
import type { ObservabilityMetrics } from "@/lib/data-platform";
import {
  useGetIngestionBatches,
  useGetObservabilityMetrics,
  useGetConnections,
  useGetOrganization,
  useGetSyncPolicies,
  useGetSyncRuns,
} from "@/lib/hook/data-platform";
import { RouteName } from "@/routes/routesConstants";
import { LoadingSkelton } from "@uiShare/molecules/Loading/LoadingSkeleton";

/* ---------------------------------------------------------------------------
 * Observability metric card
 * ------------------------------------------------------------------------- */

interface MetricCardProps {
  label: string;
  value: string;
  status: "healthy" | "warning" | "critical";
}

const statusColors: Record<MetricCardProps["status"], string> = {
  healthy: "text-emerald-500 dark:text-emerald-400",
  warning: "text-amber-500 dark:text-amber-400",
  critical: "text-red-500 dark:text-red-400",
};

const statusBg: Record<MetricCardProps["status"], string> = {
  healthy: "bg-emerald-50 dark:bg-emerald-950/40",
  warning: "bg-amber-50 dark:bg-amber-950/40",
  critical: "bg-red-50 dark:bg-red-950/40",
};

const MetricCard = ({ label, value, status }: MetricCardProps) => (
  <div
    className={`rounded-2xl border border-gray-200 p-4 dark:border-gray-800 ${statusBg[status]}`}
  >
    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`mt-1 text-2xl font-bold ${statusColors[status]}`}>{value}</p>
  </div>
);

const getMetricStatus = (
  value: number,
  thresholds: { warning: number; critical: number },
  lowerIsBetter = true,
): MetricCardProps["status"] => {
  if (lowerIsBetter) {
    if (value >= thresholds.critical) return "critical";
    if (value >= thresholds.warning) return "warning";
    return "healthy";
  }
  if (value <= thresholds.critical) return "critical";
  if (value <= thresholds.warning) return "warning";
  return "healthy";
};

const ObservabilitySection = () => {
  const t = useTranslations("dataPlatform");
  const { data: metrics, isLoading } = useGetObservabilityMetrics();

  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <LoadingSkelton key={i} isLoading className="h-24" />
        ))}
      </div>
    );
  }

  const m = metrics as ObservabilityMetrics;

  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        label={t("observability.p95DataAge")}
        value={formatAge(m.p95DataAgeSeconds)}
        status={getMetricStatus(m.p95DataAgeSeconds, {
          warning: 300,
          critical: 900,
        })}
      />
      <MetricCard
        label={t("observability.syncBacklog")}
        value={String(m.syncBacklog)}
        status={getMetricStatus(m.syncBacklog, { warning: 5, critical: 20 })}
      />
      <MetricCard
        label={t("observability.errorRate")}
        value={`${(m.errorRate * 100).toFixed(1)}%`}
        status={getMetricStatus(m.errorRate, { warning: 0.05, critical: 0.15 })}
      />
      <MetricCard
        label={t("observability.throughput")}
        value={String(Math.round(m.throughputRowsPerSecond))}
        status={getMetricStatus(
          m.throughputRowsPerSecond,
          { warning: 200, critical: 50 },
          false,
        )}
      />
      <MetricCard
        label={t("observability.queryPerformance")}
        value={`${m.queryPerformanceP95Ms}ms`}
        status={getMetricStatus(m.queryPerformanceP95Ms, {
          warning: 500,
          critical: 2000,
        })}
      />
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Architecture overview section
 * ------------------------------------------------------------------------- */

const ArchitectureSection = () => {
  const t = useTranslations("dataPlatform");

  const layers = [
    {
      key: "raw",
      color:
        "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
    },
    {
      key: "staging",
      color:
        "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
    },
    {
      key: "core",
      color:
        "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900",
    },
    {
      key: "marts",
      color:
        "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Control plane vs Data plane */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("overview.controlPlane")}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("overview.controlPlaneDesc")}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("overview.dataPlane")}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("overview.dataPlaneDesc")}
          </p>
        </div>
      </div>

      {/* Warehouse layers */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
          {t("overview.layers")}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {layers.map((layer) => (
            <div
              key={layer.key}
              className={`rounded-2xl border p-4 ${layer.color}`}
            >
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {t(`overview.${layer.key}`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Quick stats summary
 * ------------------------------------------------------------------------- */

const StatsSummary = () => {
  const t = useTranslations("dataPlatform");
  const { data: connections } = useGetConnections();
  const { data: policies } = useGetSyncPolicies();
  const { data: runs } = useGetSyncRuns();
  const { data: batches } = useGetIngestionBatches();

  const activeRuns = (runs ?? []).filter((r) => r.status === "running").length;
  const publishedBatches = (batches ?? []).filter(
    (b) => b.status === "published",
  ).length;
  const failedRuns = (runs ?? []).filter(
    (r) => r.status === "failed" || r.status === "quarantined",
  ).length;

  const stats = [
    { label: t("sources.connectionCount"), value: connections?.length ?? 0 },
    { label: t("sources.syncMode"), value: policies?.length ?? 0 },
    { label: t("ingestion.runId"), value: activeRuns },
    { label: t("ingestion.statuses.published"), value: publishedBatches },
    { label: t("ingestion.runStatuses.failed"), value: failedRuns },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Navigation cards
 * ------------------------------------------------------------------------- */

const NavCards = () => {
  const t = useTranslations("dataPlatform");
  const router = useNavigate();

  const navItems = [
    {
      label: t("nav.sources"),
      description: t("sources.description"),
      route: RouteName.data_platform_sources.path,
    },
    {
      label: t("nav.ingestion"),
      description: t("ingestion.description"),
      route: RouteName.data_platform_ingestion.path,
    },
    {
      label: t("nav.schema"),
      description: t("schema.description"),
      route: RouteName.data_platform_schema.path,
    },
    {
      label: t("nav.scenarios"),
      description: t("scenarios.description"),
      route: RouteName.data_platform_scenarios.path,
    },
    {
      label: t("pivot.title"),
      description: t("pivot.description"),
      route: RouteName.data_platform_pivot.path,
    },
    {
      label: t("accessManagement.title"),
      description: t("accessManagement.description"),
      route: RouteName.data_platform_access.path,
    },
    {
      label: t("reportManagement.title"),
      description: t("reportManagement.description"),
      route: RouteName.data_platform_reports.path,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {navItems.map((item) => (
        <button
          key={item.route}
          onClick={() => router.push(item.route)}
          className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-start transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
        >
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {item.label}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {item.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Main dashboard
 * ------------------------------------------------------------------------- */

export const DataPlatformDashboard = () => {
  const t = useTranslations("dataPlatform");
  const { data: organization } = useGetOrganization();

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("subtitle")}
        </p>
        {organization && (
          <p className="mt-2 text-sm font-medium text-teal-700">
            {t("organizationContext", { name: organization.name })}
          </p>
        )}
      </div>

      {/* Stats summary */}
      <StatsSummary />

      {/* Solar calendar filter */}
      <SolarCalendarFilter />

      {/* Observability metrics */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          {t("observability.title")}
        </h2>
        <ObservabilitySection />
      </section>

      {/* Architecture overview */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          {t("overview.title")}
        </h2>
        <ArchitectureSection />
      </section>

      {/* Real-time monitor */}
      <RealTimeMonitor />

      {/* Reports with charts */}
      <DataPlatformReports />

      {/* GIS / Geographic data flow with analytics */}
      <GisMapWithAnalytics />

      {/* Navigation */}
      <section>
        <NavCards />
      </section>
    </div>
  );
};
