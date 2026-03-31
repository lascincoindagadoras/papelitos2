'use client';
import { useState, useRef, useEffect } from 'react';

interface FormLabelProps {
  label: string;
  required?: boolean;
  help?: string;
}

export default function FormLabel({ label, required, help }: FormLabelProps) {
  const [showHelp, setShowHelp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowHelp(false);
      }
    };
    if (showHelp) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHelp]);

  return (
    <div className="flex items-center gap-1.5 mb-1" ref={ref}>
      <label className="block text-sm font-semibold text-stone-600">
        {label}{required && ' *'}
      </label>
      {help && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="w-[18px] h-[18px] rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center hover:bg-amber-200 transition-colors leading-none"
          >
            ?
          </button>
          {showHelp && (
            <div className="absolute left-6 -top-1 z-50 bg-stone-800 text-white text-xs rounded-lg px-3 py-2 w-52 shadow-lg">
              {help}
              <div className="absolute left-[-6px] top-2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-stone-800" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
