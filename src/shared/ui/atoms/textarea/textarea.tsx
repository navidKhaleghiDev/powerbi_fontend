import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-slate-500 focus-visible:border-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-400/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-700 aria-invalid:ring-red-700/20 md:text-sm dark:bg-slate-300/30 dark:aria-invalid:ring-red-700/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
