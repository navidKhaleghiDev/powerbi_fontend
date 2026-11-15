import * as React from 'react';

import { cn } from '@/shared/lib/utils';

export type InputProps = React.ComponentProps<'input'> & {
  label?: React.ReactNode;
  error?: React.ReactNode;
  endAdornment?: React.ReactNode;
};

function Input({
  className,
  type,
  label,
  error,
  endAdornment,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const control = (
    <input
      id={inputId}
      type={type}
      data-slot="input"
      aria-invalid={error ? true : ariaInvalid}
      aria-describedby={
        error ? [ariaDescribedBy, errorId].filter(Boolean).join(' ') : ariaDescribedBy
      }
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-slate-300 bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-zinc-700 selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-900 placeholder:text-slate-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-slate-300/30',
        'focus-visible:border-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-400/50',
        'aria-invalid:border-red-700 aria-invalid:ring-red-700/20 dark:aria-invalid:ring-red-700/40',
        className,
      )}
      {...props}
    />
  );

  if (!label && !error && !endAdornment) return control;

  return (
    <div data-slot="input-field" className="grid gap-2">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      {endAdornment ? (
        <div data-slot="input-control" className="relative">
          {control}
          {endAdornment}
        </div>
      ) : (
        control
      )}
      {error ? (
        <p id={errorId} role="alert" className="text-start text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Input };
