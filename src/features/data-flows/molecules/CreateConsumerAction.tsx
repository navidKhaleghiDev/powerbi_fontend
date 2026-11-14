import { Link } from '@tanstack/react-router';
import { PlusCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

export const CreateConsumerAction = ({ connectorName }: { connectorName: string }) => {
  const locale = useLocale();
  const t = useTranslations('cdcConnections.consumer');
  return (
    <Link
      to="/$locale/cdc-connections/$connectorName/consumer"
      params={{ locale, connectorName }}
      aria-label={t('open')}
      title={t('open')}
      className="inline-flex size-8 items-center justify-center rounded-md bg-white text-slate-900 hover:bg-teal-50"
    >
      <PlusCircle aria-hidden="true" className="size-4" />
    </Link>
  );
};
