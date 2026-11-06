import { forwardRef } from 'react';
import { TextareaInput, type TextareaInputProps } from '@/components/textarea-input';
import { cn } from '@/lib/utils';

export const MihomoTextInput = forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  ({ className, style, ...props }, ref) => (
    <TextareaInput
      ref={ref}
      rows={1}
      className={cn('h-10 min-h-10 px-3 py-[7px] font-mono text-xs', className)}
      style={{
        lineHeight: '1.5rem',
        ...style,
      }}
      {...props}
    />
  )
);

MihomoTextInput.displayName = 'MihomoTextInput';
