import { cloneElement, useId, type ReactElement } from 'react';
import { useTranslations } from 'use-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { requestErrorCode } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-auto min-h-11 md:min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 md:text-[13px] transition-colors outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 file:me-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-teal-800';
export const buttonClass = cn(
  buttonVariants(),
  'inline-flex h-auto min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-[13px] font-medium whitespace-normal text-white hover:bg-teal-800 active:bg-teal-900 disabled:cursor-wait md:min-h-10',
);
export const secondaryClass = cn(
  buttonVariants({ variant: 'outline' }),
  'inline-flex h-auto min-h-11 rounded-lg border-slate-300 bg-white px-4 py-2 text-[13px] whitespace-normal text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed md:min-h-10',
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
    <div className="space-y-1.5 text-[13px] font-medium text-slate-700">
      <Label htmlFor={id} className="block text-[13px] leading-5">
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
        <p id={`${id}-hint`} className="text-xs leading-6 font-normal text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-normal text-amber-700">
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
        className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-6 text-amber-800"
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
      className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-6 text-emerald-800"
    >
      <AlertDescription className="text-inherit">{text || t('saved')}</AlertDescription>
    </Alert>
  ) : null;
};
