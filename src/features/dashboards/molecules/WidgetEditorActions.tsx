import { useTranslations } from 'use-intl';

import { Button } from '@/shared/ui/atoms/button/button';

export const WidgetEditorActions = ({
  onCancel,
  disabled,
  pending = false,
}: {
  onCancel: () => void;
  disabled: boolean;
  pending?: boolean;
}) => {
  const t = useTranslations('analytics');

  return (
    <footer className="bi-widget-drawer-actions">
      <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
        {t('cancel')}
      </Button>
      <Button type="submit" disabled={disabled}>
        {t(pending ? 'saving' : 'apply')}
      </Button>
    </footer>
  );
};
