import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

export const DashboardPane = ({
  title,
  className,
  actions,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  className: string;
  actions?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) => {
  const t = useTranslations('dashboard');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const id = useId();
  const label = t(collapsed ? 'expandPane' : 'collapsePane', { name: title });
  return (
    <aside
      className={[className, 'bi-collapsible-pane', collapsed ? 'is-collapsed' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={title}
    >
      <div className="bi-pane-title">
        {!collapsed && <h2>{title}</h2>}
        <div className="bi-pane-buttons">
          {!collapsed && actions}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={label}
            aria-label={label}
            aria-expanded={!collapsed}
            aria-controls={id}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelRightOpen aria-hidden="true" />
            ) : (
              <PanelRightClose aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      {collapsed && (
        <Button
          variant="ghost"
          size="auto"
          type="button"
          className="bi-pane-tab"
          onClick={() => setCollapsed(false)}
          aria-label={label}
          aria-expanded={false}
          aria-controls={id}
        >
          {title}
        </Button>
      )}
      <div id={id} hidden={collapsed}>
        {children}
      </div>
    </aside>
  );
};
