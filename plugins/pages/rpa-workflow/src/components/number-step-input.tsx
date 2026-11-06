import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NumberStepInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
}

export function NumberStepInput({
  value,
  onChange,
  min = 0,
  step = 1,
  className,
  inputClassName,
  decreaseLabel,
  increaseLabel,
}: NumberStepInputProps) {
  return (
    <div
      className={[
        'flex h-10 items-stretch overflow-hidden rounded-lg border border-border/60 bg-background',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits ? Math.max(min, parseInt(digits, 10)) : min);
        }}
        className={[
          'h-full w-16 rounded-none border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0',
          inputClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <div className="flex w-8 flex-col">
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onChange(value + step)}
          aria-label={increaseLabel ?? '增加数值'}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={decreaseLabel ?? '减少数值'}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
