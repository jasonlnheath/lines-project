'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, disabled = false, size = 'md' }: ToggleProps) {
  const sizes = {
    sm: { toggle: 'w-8 h-4', dot: 'h-3 w-3', translate: 'translate-x-4' },
    md: { toggle: 'w-11 h-6', dot: 'h-5 w-5', translate: 'translate-x-5' },
  };

  const { toggle, dot, translate } = sizes[size];

  return (
    <label className="inline-flex items-center cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex flex-shrink-0 ${toggle}
          border-2 border-transparent rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span className="sr-only">{label}</span>
        <span
          className={`
            pointer-events-none inline-block ${dot} rounded-full
            bg-white shadow transform ring-0
            transition duration-200 ease-in-out
            ${checked ? translate : 'translate-x-0'}
          `}
        />
      </button>
      {label && (
        <span className="ml-3 text-sm font-medium text-gray-900">{label}</span>
      )}
    </label>
  );
}
