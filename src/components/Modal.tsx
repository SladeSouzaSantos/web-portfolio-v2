import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  children: ReactNode;
  overlayClassName: string;
  panelClassName: string;
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  bodyClassName?: string;
}

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ children, overlayClassName, panelClassName, labelledBy, describedBy, onClose, bodyClassName }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('portfolio-modal-open');
    if (root) root.inert = true;
    if (bodyClassName) document.body.classList.add(bodyClassName);

    const focusable = () => [...(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
      .filter(element => element.getClientRects().length > 0 && !element.closest('[hidden], [inert]'));
    (focusable()[0] ?? panelRef.current)?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panelRef.current?.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('portfolio-modal-open');
      if (bodyClassName) document.body.classList.remove(bodyClassName);
      if (root) root.inert = previousInert;
      if (origin?.isConnected) origin.focus();
    };
  }, [bodyClassName]);

  return createPortal(
    <div className={`${overlayClassName} portfolio-modal-overlay`} onClick={event => {
      if (event.target === event.currentTarget) closeRef.current();
    }}>
      <div ref={panelRef} className={panelClassName} role="dialog" aria-modal="true"
        aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex={-1}>
        {children}
      </div>
    </div>, document.body,
  );
}
