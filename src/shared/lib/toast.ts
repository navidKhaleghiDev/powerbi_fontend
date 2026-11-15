import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message?: string;
}

let sequence = 0;
let snapshot: ToastItem[] = [];
const listeners = new Set<() => void>();

const publish = () => {
  for (const listener of listeners) listener();
};

const dismissToast = (id: number) => {
  snapshot = snapshot.filter((item) => item.id !== id);
  publish();
};

const addToast = (kind: ToastKind, message?: string, toastId?: string) => {
  if (toastId && snapshot.some((item) => item.kind === kind && item.message === toastId)) return;
  const id = ++sequence;
  snapshot = [...snapshot, { id, kind, message }];
  publish();
  window.setTimeout(() => dismissToast(id), 5000);
};

export const toast = {
  success: (message?: string) => addToast('success', message),
  error: (message?: string, toastId?: string) => addToast('error', message, toastId),
  dismiss: dismissToast,
};

export const useToasts = (): ToastItem[] =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => [],
  );
