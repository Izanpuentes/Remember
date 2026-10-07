import { useState } from 'react';
import { searchPlaces, type SearchResult } from '../search';

interface Props {
  onClose: () => void;
  onPick: (result: SearchResult) => void;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

/** Buscador de lugares por nombre. Se ancla arriba para que el teclado no lo tape. */
export default function SearchPanel({ onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);

  const search = async () => {
    const text = query.trim();
    if (!text || status === 'loading') return;
    setStatus('loading');
    try {
      setResults(await searchPlaces(text));
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="backdrop top" onClick={onClose}>
      <section className="search" onClick={(ev) => ev.stopPropagation()}>
        <form
          className="search-bar"
          onSubmit={(ev) => {
            ev.preventDefault();
            search();
          }}
        >
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Pueblo, ciudad, isla, país…"
          />
          <button className="button" disabled={status === 'loading' || !query.trim()}>
            {status === 'loading' ? '…' : 'Buscar'}
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </form>

        {status === 'error' && <p className="empty">No se ha podido buscar. Comprueba la conexión a internet.</p>}
        {status === 'done' && results.length === 0 && <p className="empty">No se ha encontrado ningún lugar.</p>}

        {status === 'done' && results.length > 0 && (
          <ul className="list search-results">
            {results.map((result) => (
              <li key={result.id}>
                <button className="list-item" onClick={() => onPick(result)}>
                  <span className="list-text">
                    <strong>{result.name}</strong>
                    <small>{result.detail}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {status === 'done' && <p className="credit">Resultados de © OpenStreetMap</p>}
      </section>
    </div>
  );
}
