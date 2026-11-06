import * as React from 'react';

import { cn } from '@/lib/utils';

export type NumberInputProps = Omit<React.ComponentProps<'input'>, 'type' | 'inputMode'>;

function normalizeNumberValue(value: string) {
  return value.replace(/[^\d]/g, '');
}

function NumberInput({
  className,
  onChange,
  onPaste,
  value,
  defaultValue,
  ...props
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalizedValue = normalizeNumberValue(e.currentTarget.value);
    if (normalizedValue !== e.currentTarget.value) {
      e.currentTarget.value = normalizedValue;
    }
    onChange?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const normalizedText = normalizeNumberValue(pastedText);

    if (normalizedText !== pastedText) {
      e.preventDefault();
      const input = e.currentTarget;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.setRangeText(normalizedText, start, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    onPaste?.(e);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      data-slot="number-input"
      value={typeof value === 'string' ? normalizeNumberValue(value) : value}
      defaultValue={
        typeof defaultValue === 'string' ? normalizeNumberValue(defaultValue) : defaultValue
      }
      onChange={handleChange}
      onPaste={handlePaste}
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  );
}

export { NumberInput };
