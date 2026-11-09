import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

import { DashboardPane } from './DashboardPane';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

export const DashboardChat = () => {
  const t = useTranslations('dashboardChat');
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  const [model, setModel] = useState('openrouter/free');
  const models = useQuery({
    queryKey: ['openrouter-models'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) throw new Error('Models unavailable');
      const result: unknown = await response.json();
      const data = (result as { data?: unknown }).data;
      if (!Array.isArray(data)) throw new Error('Invalid models response');
      return data
        .filter(
          (item: unknown): item is { id: string; name: string } =>
            typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            typeof item.id === 'string' &&
            'name' in item &&
            typeof item.name === 'string',
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const chat = useMutation({
    mutationFn: async (history: Message[]) => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key?.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      const content = (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]
        ?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Empty response');
      return content;
    },
    onSuccess: (content) =>
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', content }]),
  });

  return (
    <DashboardPane className="bi-chat-pane" title={t('title')}>
      <div className="bi-chat">
        <p>{t('description')}</p>
        <p role={models.isError ? 'alert' : undefined}>
          {models.isPending
            ? t('modelsLoading')
            : models.isError
              ? t('modelsError')
              : t('modelNotice')}
        </p>
        {models.isError && (
          <Button type="button" variant="outline" size="sm" onClick={() => void models.refetch()}>
            {t('retryModels')}
          </Button>
        )}
        {!key?.trim() && <p role="alert">{t('missingKey')}</p>}
        <div className="bi-chat-messages" aria-live="polite" aria-label={t('conversation')}>
          {messages.length === 0 && <p>{t('empty')}</p>}
          {messages.map((message) => (
            <div className={`bi-chat-message is-${message.role}`} key={message.id}>
              <strong>{t(message.role)}</strong>
              <p>{message.content}</p>
            </div>
          ))}
          {chat.isPending && <p>{t('thinking')}</p>}
        </div>
        {chat.isError && <p role="alert">{t('error')}</p>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const content = draft.trim();
            if (!content || !key?.trim() || chat.isPending) return;
            const history: Message[] = [
              ...messages,
              { id: crypto.randomUUID(), role: 'user', content },
            ];
            setMessages(history);
            setDraft('');
            chat.mutate(history);
          }}
        >
          <Textarea
            id="dashboard-chat-input"
            aria-label={t('message')}
            placeholder={t('message')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="bi-chat-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={chat.isPending || !messages.length}
              onClick={() => {
                setMessages([]);
                chat.reset();
              }}
            >
              {t('clear')}
            </Button>
            <div className="bi-chat-composer-controls">
              <NativeSelect
                aria-label={t('model')}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={chat.isPending}
              >
                <option value="openrouter/free">{t('freeModel')}</option>
                {models.data
                  ?.filter((item) => item.id !== 'openrouter/free')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </NativeSelect>
              <Button
                type="submit"
                size="icon-sm"
                aria-label={t('send')}
                title={t('send')}
                disabled={chat.isPending || !draft.trim() || !key?.trim()}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardPane>
  );
};
