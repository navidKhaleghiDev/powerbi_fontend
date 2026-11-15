import { useTranslations } from 'use-intl';

import { Button } from '@/shared/ui/atoms/button/button';

export const WidgetEditorActions = ({
  onCancel,
  disabled,
}: {
  onCancel: () => void;
  disabled: boolean;
}) => {
  const t = useTranslations('analytics');

  return (
    <footer className="bi-widget-drawer-actions">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('cancel')}
      </Button>
      <Button type="submit" disabled={disabled}>
        {t('apply')}
      </Button>
    </footer>
  );
};
