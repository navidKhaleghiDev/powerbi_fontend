import { useLocation } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'use-intl';

import { AssistantContext } from '@/features/assistant/lib/context';
import {
  buildMessages,
  requestAnswer,
  type ChatError,
  type PageData,
  type Turn,
} from '@/features/assistant/lib/core';
import { appEnv } from '@/shared/config/env';

export const AssistantProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const locale = useLocale();
  const apiKey = appEnv.openRouterApiKey;
  const [model, setModel] = useState('openrouter/free');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [registration, setRegistration] = useState<{
    owner: symbol;
    route: string;
    data: PageData;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const active = useRef<AbortController | null>(null);
  const lastSent = useRef(0);
  const pageData = registration?.route === pathname ? registration.data : null;
  const register = useCallback(
    (data: PageData) => {
      const owner = Symbol();
      setRegistration({ owner, route: pathname, data });
      return () => setRegistration((current) => (current?.owner === owner ? null : current));
    },
    [pathname],
  );
  const stop = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setPending(false);
  }, []);
  const clear = useCallback(() => {
    stop();
    setTurns([]);
    setError(null);
  }, [stop]);
  const disconnect = clear;
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'control-center.refresh-token') disconnect();
    };
    window.addEventListener('control-center:session-change', disconnect);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('control-center:session-change', disconnect);
      window.removeEventListener('storage', storage);
      active.current?.abort();
    };
  }, [disconnect]);
  const send = (question?: string) => {
    if (!apiKey.trim() || active.current || Date.now() - lastSent.current < 1500) return false;
    const previous = turns.at(-1);
    const retry = question === undefined;
    if (retry && (!previous || previous.answer)) return false;
    const turn: Turn =
      retry && previous
        ? previous
        : {
            id: crypto.randomUUID(),
            question: question?.trim() ?? '',
            context: structuredClone({
              version: 1 as const,
              route: pageData ? pathname : '/workspace',
              locale,
              capturedAt: new Date().toISOString(),
              data: pageData,
            }),
          };
    const history = retry ? turns.slice(0, -1) : turns;
    let messages;
    try {
      messages = buildMessages(history, turn);
    } catch {
      setError('tooLarge');
      return false;
    }
    lastSent.current = Date.now();
    const controller = new AbortController();
    active.current = controller;
    setTurns([...history.slice(-11), turn]);
    setPending(true);
    setError(null);
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60000);
    void requestAnswer(apiKey.trim(), model, messages, controller.signal)
      .then((answer) => {
        if (active.current !== controller || controller.signal.aborted) return;
        setTurns((items) =>
          items.map((item) => (item.id === turn.id ? { ...item, answer } : item)),
        );
      })
      .catch((cause: unknown) => {
        if (active.current !== controller) return;
        setError(
          timedOut ? 'timeout' : cause instanceof Error ? (cause.message as ChatError) : 'network',
        );
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (active.current === controller) {
          active.current = null;
          setPending(false);
        }
      });
    return true;
  };
  return (
    <AssistantContext.Provider
      value={{
        apiKey,
        model,
        setModel,
        turns,
        pending,
        error,
        send,
        stop: () => {
          stop();
          setError('stopped');
        },
        clear,
        register,
        pageData,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};
