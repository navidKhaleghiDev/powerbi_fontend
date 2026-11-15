import { Check, CircleAlert, X } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { toast, useToasts } from '@/shared/lib/toast';
import { Button } from '@/shared/ui/atoms/button/button';

export const ToastViewport = () => {
  const t = useTranslations('notifications');
  const items = useToasts();

  return (
    <div className="pointer-events-none fixed top-0 left-1/2 z-[100] flex max-h-dvh w-[min(35rem,100vw)] -translate-x-1/2 flex-col gap-3 overflow-y-auto p-6">
      {items.map((item) => {
        const isError = item.kind === 'error';
        const Icon = isError ? CircleAlert : Check;
        return (
          <div
            key={item.id}
            role={isError ? 'alert' : 'status'}
            aria-atomic="true"
            data-closing={item.closing || undefined}
            onMouseEnter={() => toast.pause(item.id, 'hover')}
            onMouseLeave={() => toast.resume(item.id, 'hover')}
            onFocusCapture={() => toast.pause(item.id, 'focus')}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                toast.resume(item.id, 'focus');
            }}
            data-kind={item.kind}
            className="application-toast pointer-events-auto relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl p-3 text-start text-white shadow-lg"
          >
            <span
              className={`relative flex size-9 shrink-0 items-center justify-center rounded-lg ${isError ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="relative min-w-0 flex-1">
              <p
                className={`text-sm leading-snug font-semibold ${isError ? 'text-red-400' : 'text-slate-100'}`}
              >
                {t(isError ? 'errorTitle' : 'successTitle')}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-300">
                {item.message || t(isError ? 'requestFailed' : 'actionSucceeded')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              className="relative shrink-0 rounded-md text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-white/70"
              aria-label={t('dismiss')}
              onClick={() => toast.dismiss(item.id)}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};
