import { createContext, useContext, useEffect } from 'react';

import type { ChatError, PageData, Turn } from './core';

export interface AssistantState {
  apiKey: string;
  model: string;
  setModel: (model: string) => void;
  turns: Turn[];
  pending: boolean;
  error: ChatError | null;
  send: (question?: string) => boolean;
  stop: () => void;
  clear: () => void;
  register: (data: PageData) => () => void;
  pageData: PageData | null;
}
export const AssistantContext = createContext<AssistantState | null>(null);
export const useAssistant = () => {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('AssistantProvider is missing');
  return value;
};
export const useAssistantPage = (data: PageData) => {
  const { register } = useAssistant();
  // A primitive dependency avoids re-registering equivalent page snapshots.
  const serialized = JSON.stringify(data);
  useEffect(() => register(JSON.parse(serialized) as PageData), [register, serialized]);
};
