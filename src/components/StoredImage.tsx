import { useEffect, useState } from 'react';
import { fileUrl } from '../storage';

interface Props {
  path: string;
  className?: string;
  alt?: string;
}

/** <img> de un fichero guardado en el almacenamiento de la app */
export default function StoredImage({ path, className, alt = '' }: Props) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setSrc(undefined);
    fileUrl(path).then(
      (url) => !cancelled && setSrc(url),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  return src ? <img src={src} className={className} alt={alt} draggable={false} /> : <div className={className} />;
}
