import { useRef, type ReactNode } from 'react';

interface Props {
  className?: string;
  disabled?: boolean;
  onPick: (files: File[]) => void;
  children: ReactNode;
}

/** Botón que abre la galería del móvil para elegir una o varias fotos */
export default function PhotoPicker({ className, disabled, onPick, children }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(ev) => {
          const files = Array.from(ev.target.files ?? []);
          ev.target.value = '';
          if (files.length) onPick(files);
        }}
      />
    </>
  );
}
