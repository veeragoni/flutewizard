import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { IconClose } from './icons';

export function Modal(props: { title: ComponentChildren; onClose: () => void; children: ComponentChildren; wide?: boolean; actions?: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <div class="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class={'modal' + (props.wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2>{props.title}</h2>
          <div class="modal-actions">
            {props.actions}
            <button class="icon-btn plain" onClick={props.onClose} aria-label="Close"><IconClose /></button>
          </div>
        </div>
        <div class="modal-body">{props.children}</div>
      </div>
    </div>
  );
}
