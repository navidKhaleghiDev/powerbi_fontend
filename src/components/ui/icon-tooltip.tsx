import { Tooltip } from 'radix-ui';
import { useLocale } from 'use-intl';

import type { ReactElement } from 'react';

interface Props {
  label: string;
  children: ReactElement;
}

export const IconTooltip = ({ label, children }: Props) => {
  const locale = useLocale();
  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="icon-tooltip"
            side={locale === 'fa' ? 'left' : 'right'}
            sideOffset={10}
            collisionPadding={12}
            dir={locale === 'fa' ? 'rtl' : 'ltr'}
          >
            {label}
            <Tooltip.Arrow className="icon-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
