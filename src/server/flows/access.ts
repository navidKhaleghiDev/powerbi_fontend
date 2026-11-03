import type { FlowStore, MetricBinding, SessionUser } from "@/lib/flows/types";
/** Shared published definitions are reusable; another user's private draft is not. */
export const canReadBinding = (
  state: FlowStore,
  user: SessionUser,
  binding: MetricBinding,
): boolean =>
  user.role === "provider" ||
  binding.ownerId === user.id ||
  state.reports.some(
    (report) =>
      !!report.publishedAt &&
      !!report.publishedWidgets?.some(
        (widget) => widget.bindingId === binding.id,
      ),
  );
