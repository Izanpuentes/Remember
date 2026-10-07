import { PIN_COLORS } from '../types';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

/** Colores predefinidos más un selector libre */
export default function ColorPicker({ value, onChange }: Props) {
  const isCustom = !PIN_COLORS.includes(value);

  return (
    <div className="swatches">
      {PIN_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={color === value ? 'swatch selected' : 'swatch'}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={`Color ${color}`}
        />
      ))}
      <label
        className={isCustom ? 'swatch custom selected' : 'swatch custom'}
        style={isCustom ? { background: value } : undefined}
        aria-label="Otro color"
      >
        {!isCustom && '+'}
        <input type="color" value={value} onChange={(ev) => onChange(ev.target.value)} />
      </label>
    </div>
  );
}
