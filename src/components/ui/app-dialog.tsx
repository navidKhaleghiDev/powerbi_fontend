import { useEffect, useRef, type ReactNode } from 'react';

interface AppDialogProps {
  open: boolean;
  className: string;
  describedBy?: string;
  onClose: () => void;
  children: ReactNode;
}

export function AppDialog({ open, className, describedBy, onClose, children }: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className={className} aria-describedby={describedBy} onClose={onClose}>
      {children}
    </dialog>
  );
}
