import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-all focus-visible:border-teal-500 focus-visible:ring-[3px] focus-visible:ring-teal-500/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-700 aria-invalid:ring-red-700/20 dark:aria-invalid:ring-red-700/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-teal-700 text-white hover:bg-teal-700/90',
        destructive:
          'bg-red-700 text-white hover:bg-red-700/90 focus-visible:ring-red-700/20 dark:bg-red-700/60 dark:focus-visible:ring-red-700/40',
        outline:
          'border bg-white shadow-xs hover:bg-teal-50 hover:text-slate-900 dark:border-slate-300 dark:bg-slate-300/30 dark:hover:bg-slate-300/50',
        secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-100/80',
        ghost: 'hover:bg-teal-50 hover:text-slate-900 dark:hover:bg-teal-50/50',
        link: 'text-teal-700 underline-offset-4 hover:underline',
      },
      size: {
        auto: 'block h-auto whitespace-normal',
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9 !border-0',
        'icon-xs': "size-6 rounded-md !border-0 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8 !border-0',
        'icon-lg': 'size-10 !border-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'submit',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
