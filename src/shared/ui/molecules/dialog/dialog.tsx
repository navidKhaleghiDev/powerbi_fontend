import { useEffect, useId, useRef, type ReactNode } from 'react';

import { useOutsideClick } from '@/shared/hooks/useOutsideClick';

export interface DialogVariants {
  initial: Keyframe;
  animate: Keyframe;
  exit: Keyframe;
}

const defaultVariants: DialogVariants = {
  initial: { opacity: 0, transform: 'translateY(40px) scale(0.95)' },
  animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
  exit: { opacity: 0, transform: 'translateY(40px) scale(0.95)' },
};

export interface DialogProps {
  open: boolean;
  className?: string;
  describedBy?: string;
  labelledBy?: string;
  onClose: () => void;
  onAfterClose?: () => void;
  children: ReactNode;
  variants?: DialogVariants;
  duration?: number;
}

/** Native modal semantics with independently configurable entry and exit keyframes. */
export function Dialog({
  open,
  className = '',
  describedBy,
  labelledBy,
  onClose,
  onAfterClose,
  children,
  variants = defaultVariants,
  duration = 250,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const afterCloseRef = useRef(onAfterClose);
  useEffect(() => {
    afterCloseRef.current = onAfterClose;
  }, [onAfterClose]);

  useOutsideClick(dialogRef, () => {
    if (open && dialogRef.current?.open) onClose();
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open && !dialog.open) return;
    if (open && !dialog.open) dialog.showModal();
    // Associate existing header titles without requiring every consumer to supply IDs.
    const title = dialog.querySelector('h1, h2, h3');
    if (!labelledBy && title) {
      if (!title.id) title.id = titleId;
      dialog.setAttribute('aria-labelledby', title.id);
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = dialog.animate(
      open ? [variants.initial, variants.animate] : [variants.animate, variants.exit],
      { duration: reduced ? 0 : duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    animation.onfinish = () => {
      if (!open) {
        dialog.close();
        afterCloseRef.current?.();
      }
    };
    return () => animation.cancel();
  }, [open, variants, duration, labelledBy, titleId]);

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog ${className}`}
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        if (open) onClose();
      }}
      onPointerDown={(event) => {
        // Native backdrops target the dialog itself; distinguish its padding from the backdrop.
        if (event.target !== event.currentTarget || !open) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      {children}
    </dialog>
  );
}
