import { cloneElement, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'use-intl';

interface Props {
  label: string;
  children: ReactElement<{ 'aria-label'?: string; title?: string }>;
}

export const IconTooltip = ({ label, children }: Props) => {
  const locale = useLocale();
  const childProps = children.props;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    side: 'left' | 'right';
  } | null>(null);
  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const side = window.innerWidth - rect.right >= 270 || rect.left < 270 ? 'right' : 'left';
    setPosition({
      left: side === 'right' ? rect.right + 10 : rect.left - 10,
      top: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2)),
      side,
    });
  };

  return (
    <span
      ref={anchorRef}
      className="app-icon-tooltip"
      onMouseEnter={show}
      onMouseLeave={() => setPosition(null)}
      onFocusCapture={show}
      onBlurCapture={() => setPosition(null)}
    >
      {cloneElement(children, {
        'aria-label': childProps['aria-label'] ?? label,
      })}
      {position
        ? createPortal(
            <span
              className={`icon-tooltip icon-tooltip--${position.side}`}
              role="tooltip"
              dir={locale === 'fa' ? 'rtl' : 'ltr'}
              style={{ left: position.left, top: position.top }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
};
