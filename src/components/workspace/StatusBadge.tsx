import { Badge } from '@/components/ui/badge';

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const tones = {
  neutral: 'border-border-default bg-surface-raised text-text-primary',
  success: 'border-brand-200 bg-surface-info-subtle text-text-info',
  warning: 'border-border-warning bg-surface-warning-subtle text-text-warning',
  danger: 'border-border-warning bg-surface-warning-subtle text-text-warning',
};

export const StatusBadge = ({ children, tone = 'neutral' }: Props) => (
  <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 font-medium ${tones[tone]}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    {children}
  </Badge>
);
