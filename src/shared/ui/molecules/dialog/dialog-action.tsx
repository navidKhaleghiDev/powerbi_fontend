import { Button } from '@/shared/ui/atoms/button/button';

import type { ComponentProps } from 'react';

/** Action button for controlled dialogs, including actions inside menus or toolbars. */
export function DialogAction({
  onOpen,
  ...props
}: Omit<ComponentProps<typeof Button>, 'onClick'> & { onOpen: () => void }) {
  return <Button {...props} type="button" aria-haspopup="dialog" onClick={onOpen} />;
}
