import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUp, Info, Sparkles, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'use-intl';

import { useAssistant } from '@/features/assistant/lib/context';
import { MAX_QUESTION, SUPPORTED_MODELS } from '@/features/assistant/lib/core';
import {
  createChatFormSchema,
  type ChatFormValues,
} from '@/features/dashboards/lib/chat-form-schema';
import { DashboardPane } from '@/features/dashboards/molecules/DashboardPane';
import { Button } from '@/shared/ui/atoms/button/button';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';
import { Textarea } from '@/shared/ui/atoms/textarea/textarea';

// React text rendering escapes HTML. Fences are rendered as inert LTR code, never HTML.
const Answer = ({ text }: { text: string }) => (
  <>
    {text.split('```').map((part, index, parts) =>
      index % 2 ? (
        <pre dir="ltr" key={parts.slice(0, index + 1).join('```')}>
          <code>{part.replace(/^\w*\n/, '')}</code>
        </pre>
      ) : (
        <p dir="auto" key={parts.slice(0, index + 1).join('```')}>
          {part}
        </p>
      ),
    )}
  </>
);

export const DashboardChat = () => {
  const t = useTranslations('dashboardChat');
  const assistant = useAssistant();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ChatFormValues>({
    resolver: zodResolver(createChatFormSchema(t('messageRequired'), t('messageTooLong'))),
    defaultValues: { message: '' },
  });
  const draft = useWatch({ control, name: 'message' });
  const { apiKey, model, turns, pending, error } = assistant;
  const conversationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = conversationRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns, pending]);
  return (
    <DashboardPane className="bi-chat-pane" title={t('title')}>
      <div className="bi-chat">
        {!apiKey && <p role="alert">{t('missingKey')}</p>}
        <div
          ref={conversationRef}
          className="bi-chat-messages"
          role="log"
          aria-live="polite"
          aria-label={t('conversation')}
          aria-busy={pending}
        >
          {turns.length === 0 && !pending && (
            <div className="bi-chat-welcome">
              <span>
                <Sparkles size={24} aria-hidden="true" />
              </span>
              <h3>{t('welcome')}</h3>
            </div>
          )}
          {turns.map((turn) => (
            <div className="bi-chat-turn" key={turn.id}>
              <div className="bi-chat-message is-user">
                <strong>{t('user')}</strong>
                <p dir="auto">{turn.question}</p>
              </div>
              {turn.answer && (
                <div className="bi-chat-message is-assistant">
                  <strong>{t('assistant')}</strong>
                  <Answer text={turn.answer} />
                </div>
              )}
            </div>
          ))}
          {pending && (
            <div className="bi-chat-thinking" role="status">
              <span className="bi-chat-typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>{t('thinking')}</span>
            </div>
          )}
        </div>
        {error && <p role="alert">{t(error)}</p>}
        {!pending && turns.length > 0 && !turns.at(-1)?.answer && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!apiKey.trim()}
            onClick={() => assistant.send()}
          >
            {t('retry')}
          </Button>
        )}
        <form
          className="ui-border-trail"
          noValidate
          onSubmit={handleSubmit(({ message }) => {
            if (!apiKey.trim() || pending) return;
            if (assistant.send(message)) reset();
          })}
        >
          <div className="bi-chat-input-field">
            <Textarea
              id="dashboard-chat-input"
              aria-label={t('message')}
              placeholder={t('message')}
              dir="auto"
              rows={2}
              onKeyDown={(event) => {
                if (
                  event.key !== 'Enter' ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing ||
                  event.keyCode === 229
                )
                  return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
              maxLength={MAX_QUESTION}
              aria-invalid={!!errors.message}
              {...register('message')}
            />
            {errors.message && <p role="alert">{errors.message.message}</p>}
          </div>
          <div className="bi-chat-actions">
            <div className="bi-chat-secondary-actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('clear')}
                title={t('clear')}
                disabled={!turns.length}
                onClick={assistant.clear}
              >
                <Trash2 size={15} aria-hidden="true" />
              </Button>
              <details className="bi-chat-info">
                <summary aria-label={t('information')} title={t('information')}>
                  <Info size={16} aria-hidden="true" />
                  <span className="sr-only">{t('information')}</span>
                </summary>
                <p>{t('privacy')}</p>
              </details>
              <div className="bi-chat-composer-controls">
                <NativeSelect
                  id="dashboard-chat-model"
                  aria-label={t('model')}
                  value={model}
                  onChange={(event) => assistant.setModel(event.target.value)}
                  disabled={pending}
                >
                  {SUPPORTED_MODELS.map((id) => (
                    <option key={id} value={id}>
                      {id === 'openrouter/free' ? t('freeModel') : id}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {pending ? (
              <Button
                type="button"
                className="bi-chat-send"
                size="icon-sm"
                aria-label={t('stop')}
                title={t('stop')}
                onClick={assistant.stop}
              >
                <Square size={14} aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="bi-chat-send"
                size="icon-sm"
                aria-label={t('send')}
                title={t('send')}
                disabled={!draft.trim() || !apiKey.trim()}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </DashboardPane>
  );
};
