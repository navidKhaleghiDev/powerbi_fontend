import { cloneElement, useId, type ReactElement } from 'react';
import { useTranslations } from 'use-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { requestErrorCode } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-auto min-h-11 md:min-h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-base text-text-primary md:text-sm transition-colors outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-surface-raised file:me-3 file:rounded-lg file:border-0 file:bg-surface-info-subtle file:px-3 file:py-1 file:text-xs file:font-medium file:text-text-info';
export const buttonClass = cn(
  buttonVariants(),
  'inline-flex h-auto min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium whitespace-normal text-white hover:bg-brand-800 active:bg-brand-900 disabled:cursor-wait md:min-h-10',
);
export const secondaryClass = cn(
  buttonVariants({ variant: 'outline' }),
  'inline-flex h-auto min-h-11 rounded-lg border-border-default bg-surface-default px-4 py-2 text-sm whitespace-normal text-text-primary hover:bg-surface-raised disabled:cursor-not-allowed md:min-h-10',
);
interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}
export const Field = ({ label, hint, error, children }: FieldProps) => {
  const id = useId();
  return (
    <div className="space-y-1.5 text-sm font-medium text-text-primary">
      <Label htmlFor={id} className="block text-sm leading-5">
        {label}
      </Label>
      {cloneElement(children, {
        id,
        'aria-invalid': !!error || children.props['aria-invalid'],
        'aria-describedby':
          [
            children.props['aria-describedby'],
            hint ? `${id}-hint` : undefined,
            error ? `${id}-error` : undefined,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-6 font-normal text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-normal text-text-warning">
          {error}
        </p>
      )}
    </div>
  );
};
interface NoticeProps {
  error?: unknown;
  success?: boolean;
  text?: string;
}
export const Notice = ({ error, success, text }: NoticeProps) => {
  const t = useTranslations('studio');
  if (error) {
    const code = requestErrorCode(error);
    return (
      <Alert
        role="alert"
        className="mt-3 rounded-xl border border-border-warning bg-surface-warning-subtle p-4 text-sm leading-6 text-text-warning"
      >
        <AlertDescription className="text-inherit">
          {t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.requestFailed')}
        </AlertDescription>
      </Alert>
    );
  }
  return success ? (
    <Alert
      role="status"
      className="mt-3 rounded-xl border border-border-success bg-surface-success-subtle p-4 text-sm leading-6 text-text-success"
    >
      <AlertDescription className="text-inherit">{text || t('saved')}</AlertDescription>
    </Alert>
  ) : null;
};
