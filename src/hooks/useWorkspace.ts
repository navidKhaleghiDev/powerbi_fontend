import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { useLocale } from 'use-intl';

import { parseCsv } from '@/lib/flows/csv';

import type {
  AnalyticsResult,
  PublishedDataPreview,
  SourceTable,
  ReportWidget,
  WorkspaceState,
} from '@/lib/flows/types';

/** Empty UI state, not a connected workspace or synthetic warehouse. */
const emptyWorkspace: WorkspaceState = {
  bindings: [],
  connections: [],
  flows: [],
  runs: [],
  reports: [],
};
const unavailable = <T>(): Promise<T> => Promise.reject(new Error('backendUnavailable'));

/** Development fixtures are limited to the Reports panel and can be disabled locally. */
export const useReportsMockMode = () => {
  const { pathname } = useLocation();
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_REPORTS_MOCKS !== 'false' &&
    pathname.split('/').includes('analytics')
  );
};

export const useWorkspace = () => {
  const mocked = useReportsMockMode();
  const locale = useLocale() === 'fa' ? 'fa' : 'en';
  return useQuery({
    queryKey: ['frontend-workspace', mocked ? 'reports-mock' : 'empty', locale],
    queryFn: async (): Promise<WorkspaceState> => {
      if (import.meta.env.DEV && mocked)
        return (await import('@/lib/mocks/reports')).createReportsWorkspace(locale);
      return emptyWorkspace;
    },
    initialData: mocked ? undefined : emptyWorkspace,
    staleTime: Infinity,
  });
};

/** Retained UI interface: server operations are unavailable and never issue requests. */
export const useWorkspaceAction = <T = unknown>() =>
  useMutation({
    mutationFn: (_action: { path: string; body: unknown }): Promise<T> => unavailable(),
  });

export const requestErrorCode = (error: unknown): string =>
  error instanceof Error && ['csvLimit', 'csvInvalid', 'backendUnavailable'].includes(error.message)
    ? error.message
    : 'requestFailed';

export const useCsvPreview = () =>
  useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) throw new Error('csvLimit');
      const csv = await file.text();
      return { ...parseCsv(csv), csv, fileName: file.name };
    },
  });

export const useCsvImport = () =>
  useMutation({
    mutationFn: (_input: { file: File; flowId: string }): Promise<unknown> => unavailable(),
  });

export const useWarehouseWidget = (widget: ReportWidget) => {
  const mocked = useReportsMockMode();
  const locale = useLocale() === 'fa' ? 'fa' : 'en';
  return useQuery({
    queryKey: ['warehouse-widget', mocked, locale, widget],
    queryFn: async (): Promise<AnalyticsResult> => {
      if (import.meta.env.DEV && mocked)
        return (await import('@/lib/mocks/reports')).queryReportsWidget(widget, locale);
      return unavailable();
    },
    retry: false,
  });
};
export const useSourceTables = (id: string) =>
  useQuery({
    queryKey: ['source-tables', id],
    queryFn: (): Promise<SourceTable[]> => unavailable(),
    enabled: !!id,
    retry: false,
  });
export const useFlowPlan = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['flow-plan', id],
    queryFn: (): Promise<{ sql: string[]; topic: string | null }> => unavailable(),
    enabled,
    retry: false,
  });
export const useConnectorStatus = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['connector-status', id],
    queryFn: (): Promise<{ connector: string | null; tasks: { id: number; state: string }[] }> =>
      unavailable(),
    enabled,
    retry: false,
  });
export const usePublishedDataPreview = (flowId: string, loadId: string, page: number) => {
  const mocked = useReportsMockMode();
  const locale = useLocale() === 'fa' ? 'fa' : 'en';
  return useQuery({
    queryKey: ['published-data-preview', mocked, locale, flowId, loadId, page],
    queryFn: async (): Promise<PublishedDataPreview> => {
      if (import.meta.env.DEV && mocked)
        return (await import('@/lib/mocks/reports')).previewReportsData(
          flowId,
          loadId,
          page,
          locale,
        );
      return unavailable();
    },
    enabled: !!flowId && !!loadId,
    retry: false,
  });
};
