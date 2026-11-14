import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-slate-300 bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-teal-700 selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-900 placeholder:text-slate-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-slate-300/30',
        'focus-visible:border-teal-500 focus-visible:ring-[3px] focus-visible:ring-teal-500/50',
        'aria-invalid:border-red-700 aria-invalid:ring-red-700/20 dark:aria-invalid:ring-red-700/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
