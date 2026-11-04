"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { parseCsv } from "@/lib/flows/csv";
import type {
  AnalyticsResult, PublishedDataPreview, SourceTable, ReportWidget, WorkspaceState,
} from "@/lib/flows/types";

/** Empty UI state, not a connected workspace or synthetic warehouse. */
const emptyWorkspace: WorkspaceState = {
  bindings: [], connections: [], flows: [], runs: [], reports: [],
};
const unavailable = (): never => { throw new Error("backendUnavailable"); };

export const useWorkspace = () => useQuery({
  queryKey: ["frontend-workspace"],
  queryFn: () => emptyWorkspace,
  initialData: emptyWorkspace,
  staleTime: Infinity,
});

/** Retained UI interface: server operations are unavailable and never issue requests. */
export const useWorkspaceAction = <T = unknown>() => useMutation({
  mutationFn: async (_action: { path: string; body: unknown }): Promise<T> => unavailable(),
});

export const requestErrorCode = (error: unknown): string =>
  error instanceof Error && ["csvLimit", "csvInvalid", "backendUnavailable"].includes(error.message)
    ? error.message : "requestFailed";

export const useCsvPreview = () => useMutation({
  mutationFn: async (file: File) => {
    if (file.size > 2 * 1024 * 1024) throw new Error("csvLimit");
    const csv = await file.text();
    return { ...parseCsv(csv), csv, fileName: file.name };
  },
});

export const useCsvImport = () => useMutation({
  mutationFn: async (_input: { file: File; flowId: string }): Promise<unknown> => unavailable(),
});

export const useWarehouseWidget = (widget: ReportWidget) => useQuery({
  queryKey: ["warehouse-widget", widget],
  queryFn: async (): Promise<AnalyticsResult> => unavailable(),
  retry: false,
});
export const useSourceTables = (id: string) => useQuery({
  queryKey: ["source-tables", id],
  queryFn: async (): Promise<SourceTable[]> => unavailable(),
  enabled: !!id,
  retry: false,
});
export const useFlowPlan = (id: string, enabled: boolean) => useQuery({
  queryKey: ["flow-plan", id],
  queryFn: async (): Promise<{ sql: string[]; topic: string | null }> => unavailable(),
  enabled,
  retry: false,
});
export const useConnectorStatus = (id: string, enabled: boolean) => useQuery({
  queryKey: ["connector-status", id],
  queryFn: async (): Promise<{ connector: string | null; tasks: { id: number; state: string }[] }> => unavailable(),
  enabled,
  retry: false,
});
export const usePublishedDataPreview = (flowId: string, loadId: string, page: number) => useQuery({
  queryKey: ["published-data-preview", flowId, loadId, page],
  queryFn: async (): Promise<PublishedDataPreview> => unavailable(),
  enabled: !!flowId && !!loadId,
  retry: false,
});
