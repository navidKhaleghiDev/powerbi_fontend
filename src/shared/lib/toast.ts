import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message?: string;
  closing?: boolean;
  dedupeKey?: string;
}

let sequence = 0;
let snapshot: ToastItem[] = [];
const listeners = new Set<() => void>();

const publish = () => {
  for (const listener of listeners) listener();
};

const timers = new Map<
  number,
  {
    remaining: number;
    startedAt: number;
    timeout?: ReturnType<typeof setTimeout>;
    pauses: Set<string>;
  }
>();
const duration = 5000;
const exitDuration = 200;

const dismissToast = (id: number) => {
  if (!snapshot.some((item) => item.id === id && !item.closing)) return;
  const timer = timers.get(id);
  clearTimeout(timer?.timeout);
  timers.delete(id);
  snapshot = snapshot.map((item) => (item.id === id ? { ...item, closing: true } : item));
  publish();
  setTimeout(() => {
    snapshot = snapshot.filter((item) => item.id !== id);
    publish();
  }, exitDuration);
};

const pauseToast = (id: number, reason: string) => {
  const timer = timers.get(id);
  if (!timer || timer.pauses.has(reason)) return;
  if (timer.pauses.size === 0) {
    clearTimeout(timer.timeout);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  }
  timer.pauses.add(reason);
};

const resumeToast = (id: number, reason: string) => {
  const timer = timers.get(id);
  if (!timer || !timer.pauses.delete(reason) || timer.pauses.size > 0) return;
  timer.startedAt = Date.now();
  timer.timeout = setTimeout(() => dismissToast(id), timer.remaining);
};

const addToast = (kind: ToastKind, message?: string, dedupeKey?: string) => {
  if (
    dedupeKey &&
    snapshot.some((item) => !item.closing && item.kind === kind && item.dedupeKey === dedupeKey)
  )
    return;
  const id = ++sequence;
  snapshot = [...snapshot, { id, kind, message, dedupeKey }];
  timers.set(id, {
    remaining: duration,
    startedAt: Date.now(),
    pauses: new Set(),
    timeout: setTimeout(() => dismissToast(id), duration),
  });
  publish();
};

export const toast = {
  success: (message?: string) => addToast('success', message),
  error: (message?: string, toastId?: string) => addToast('error', message, toastId),
  dismiss: dismissToast,
  pause: pauseToast,
  resume: resumeToast,
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
