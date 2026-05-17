import React, { useRef } from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
}

/** Displays DD/MM/YYYY, stores YYYY-MM-DD. */
export const DateInput: React.FC<DateInputProps> = ({ value, onChange, className = '', min, max }) => {
  const ref = useRef<HTMLInputElement>(null);

  const displayValue = value
    ? value.split('-').reverse().join('/')
    : '';

  return (
    <div className="relative">
      <div className={className} onClick={() => ref.current?.showPicker()}>
        {displayValue || <span className="text-bullMuted">DD/MM/YYYY</span>}
      </div>
      <button
        type="button"
        onClick={() => ref.current?.showPicker()}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-bullMuted hover:text-white z-10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
      />
    </div>
  );
};
