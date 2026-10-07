import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Panel inferior deslizante */
export default function Sheet({ title, subtitle, onClose, children }: Props) {
  return (
    <div className="backdrop" onClick={onClose}>
      <section className="sheet" onClick={(ev) => ev.stopPropagation()}>
        <header className="sheet-header">
          <div className="sheet-titles">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
