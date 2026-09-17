import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const initialFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    initialFocus.current = document.activeElement as HTMLElement;
    ref.current?.showModal();
    ref.current?.querySelector('input')?.focus();
    return () => {
      ref.current?.close();
      initialFocus.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-heading">
          <h2 id="dialog-title">{title}</h2>
          <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
