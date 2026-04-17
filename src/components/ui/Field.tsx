import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  /** Optional suffix rendered at the right of the input */
  suffix?: ReactNode;
}

export function Field({ label, hint, children, suffix }: FieldProps) {
  return (
    <div>
      <label className="ve-field-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>{children}</div>
        {suffix && <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{suffix}</div>}
      </div>
      {hint && (
        <p style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>{hint}</p>
      )}
    </div>
  );
}

export function NumberInput(props: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const { value, onChange, step, min, max, placeholder } = props;
  return (
    <input
      type="number"
      className="ve-input"
      value={Number.isFinite(value) ? value : ""}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
    />
  );
}

export function SelectInput<T extends string | number>(props: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const { value, onChange, options } = props;
  return (
    <select
      className="ve-select"
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const match = options.find((o) => String(o.value) === raw);
        if (match) onChange(match.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
