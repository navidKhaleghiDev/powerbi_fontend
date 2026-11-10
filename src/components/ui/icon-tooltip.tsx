import { cloneElement, type ReactElement } from 'react';
import { useLocale } from 'use-intl';

interface Props {
  label: string;
  children: ReactElement<{ 'aria-label'?: string; title?: string }>;
}

export const IconTooltip = ({ label, children }: Props) => {
  const locale = useLocale();
  const childProps = children.props;
  return (
    <span className="app-icon-tooltip" data-side={locale === 'fa' ? 'left' : 'right'}>
      {cloneElement(children, {
        'aria-label': childProps['aria-label'] ?? label,
        title: label,
      })}
      <span className="icon-tooltip" role="tooltip" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
        {label}
      </span>
    </span>
  );
};
