import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { toast, useToasts } from '@/shared/lib/toast';

export const ToastViewport = () => {
  const t = useTranslations('notifications');
  const items = useToasts();

  return (
    <div
      className="fixed end-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {items.map((item) => {
        const isError = item.kind === 'error';
        const Icon = isError ? CircleAlert : CircleCheck;
        return (
          <div
            key={item.id}
            role={isError ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-xl border bg-white p-4 text-sm text-slate-900 shadow-lg ${
              isError ? 'border-red-300' : 'border-green-300'
            }`}
          >
            <Icon
              size={18}
              aria-hidden="true"
              className={isError ? 'text-red-700' : 'text-green-700'}
            />
            <p className="min-w-0 flex-1 break-words">
              {item.message || t(isError ? 'requestFailed' : 'actionSucceeded')}
            </p>
            <button
              type="button"
              className="rounded p-0.5 text-slate-600 hover:bg-slate-50"
              aria-label={t('dismiss')}
              onClick={() => toast.dismiss(item.id)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
