import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Radio({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="radio"
      data-slot="radio"
      className={cn(
        'size-4 shrink-0 accent-zinc-300 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Radio };
