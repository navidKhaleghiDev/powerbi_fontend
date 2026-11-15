import { typographyVariants } from '@/shared/lib/typography';
import { cn } from '@/shared/lib/utils';

import type { VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLElement>, VariantProps<typeof typographyVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
}

export const Typography = ({ as: Component = 'p', variant, className, ...props }: Props) => (
  <Component className={cn(typographyVariants({ variant }), className)} {...props} />
);
