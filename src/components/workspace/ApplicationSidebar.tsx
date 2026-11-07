import { Link } from '@tanstack/react-router';
import { Globe2, LayoutDashboard } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { IconTooltip } from '@/components/ui/icon-tooltip';

export const ApplicationSidebar = () => {
  const t = useTranslations('studio');
  const tw = useTranslations('workspace');
  const locale = useLocale();
  const otherLocale = locale === 'fa' ? 'en' : 'fa';

  return (
    <aside className="workspace-rail">
      <IconTooltip label={t('design.brand')}>
        <Link
          to="/$locale/data-platform"
          params={{ locale }}
          className="workspace-rail-brand"
          aria-label={t('design.brand')}
        >
          <img src="/brand/netsep-logo.png" width={27} height={34} alt="" />
        </Link>
      </IconTooltip>
      <nav className="workspace-rail-links" aria-label={t('workspaceNavigation')}>
        <IconTooltip label={t('design.overviewTab')}>
          <Link
            to="/$locale/data-platform"
            params={{ locale }}
            className="workspace-rail-link is-active"
            aria-label={t('design.overviewTab')}
            aria-current="page"
            data-label={t('design.overviewTab')}
          >
            <LayoutDashboard size={19} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
      </nav>
      <div className="workspace-rail-footer">
        <IconTooltip label={tw('language')}>
          <Link
            className="workspace-rail-link"
            to="/$locale/data-platform"
            params={{ locale: otherLocale }}
            lang={otherLocale}
            aria-label={tw('language')}
            data-label={tw('language')}
          >
            <Globe2 size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
      </div>
    </aside>
  );
};
