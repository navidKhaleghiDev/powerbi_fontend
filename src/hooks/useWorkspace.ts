"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/api/Http";
import type {
  AnalyticsResult,
  DeploymentStatus,
  PublishedDataPreview,
  CsvPreview,
  SourceTable,
  ReportWidget,
  WorkspaceState,
} from "@/lib/flows/types";
const key = ["connected-workspace"];
export const useWorkspace = () =>
  useQuery({
    queryKey: key,
    queryFn: () => http.get<WorkspaceState>("state"),
    staleTime: 5000,
  });
export const useWorkspaceAction = <T = unknown>() => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      http.post<T>(path, body),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["warehouse-widget"] }),
        client.invalidateQueries({ queryKey: ["connector-status"] }),
      ]),
  });
};
export const useWarehouseWidget = (widget: ReportWidget) =>
  useQuery({
    queryKey: ["warehouse-widget", widget],
    queryFn: () => http.post<AnalyticsResult>("analytics", widget),
    staleTime: 30000,
    retry: false,
  });
export const requestErrorCode = (error: unknown): string => {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object" && "data" in response) {
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
      )
        return data.error;
    }
  }
  if (
    error instanceof Error &&
    ["csvLimit", "csvInvalid"].includes(error.message)
  )
    return error.message;
  return "requestFailed";
};
export const useCsvPreview = () =>
  useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) throw new Error("csvLimit");
      const csv = await file.text();
      const preview = await http.post<CsvPreview>("csv/preview", { csv });
      return { ...preview, csv, fileName: file.name };
    },
  });
export const useCsvImport = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, flowId }: { file: File; flowId: string }) => {
      if (file.size > 2 * 1024 * 1024) throw new Error("csvLimit");
      return http.post(`flows/${flowId}/import`, {
        csv: await file.text(),
        fileName: file.name,
      });
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["warehouse-widget"] }),
        client.invalidateQueries({ queryKey: ["connector-status"] }),
      ]),
  });
};
export const useSourceTables = (id: string) =>
  useQuery({
    queryKey: ["source-tables", id],
    queryFn: () => http.get<SourceTable[]>(`connections/${id}/discover`),
    enabled: !!id,
    retry: false,
  });
export const useFlowPlan = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["flow-plan", id],
    queryFn: () =>
      http.get<{ sql: string[]; topic: string | null }>(`flows/${id}/plan`),
    enabled,
    retry: false,
  });
export const useConnectorStatus = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["connector-status", id],
    queryFn: () =>
      http.get<{
        connector: string | null;
        tasks: { id: number; state: string }[];
      }>(`flows/${id}/status`),
    enabled,
    retry: false,
    refetchInterval: enabled ? 10000 : false,
  });

export const useDeploymentStatus = () =>
  useQuery({
    queryKey: ["deployment-readiness"],
    queryFn: () => http.get<DeploymentStatus>("deployment"),
    staleTime: 10000,
    refetchInterval: 15000,
    retry: false,
  });
export const usePublishedDataPreview = (
  flowId: string,
  loadId: string,
  page: number,
) =>
  useQuery({
    queryKey: ["published-data-preview", flowId, loadId, page],
    queryFn: () =>
      http.get<PublishedDataPreview>(`preview/${flowId}?page=${page}`),
    enabled: !!flowId && !!loadId,
    staleTime: 15000,
    retry: false,
  });
