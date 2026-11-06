import * as React from 'react';

import { cn } from '@/lib/utils';

export type TextareaInputProps = React.ComponentProps<'textarea'>;

function normalizeSingleLineValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ');
}

/**
 * TextareaInput 组件
 *
 * 使用 textarea 标签实现的输入框组件，主要用于避免 webview 的自动完成功能。
 * 适用于邮箱、账号等需要禁用自动完成的输入场景。
 *
 * 特点：
 * - 使用 textarea 标签，完全避免自动完成提示
 * - 默认禁用 autoComplete、autoCorrect、autoCapitalize、spellCheck
 * - 保持与 Input 组件相同的高度和样式（单行显示）
 */
function TextareaInput({
  className,
  autoComplete = 'off',
  autoCorrect = 'off',
  autoCapitalize = 'off',
  spellCheck = false,
  rows = 1,
  onKeyDown,
  onChange,
  onPaste,
  value,
  defaultValue,
  ...props
}: TextareaInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 禁止回车键
    if (e.key === 'Enter') {
      e.preventDefault();
      return;
    }
    // 调用用户自定义的 onKeyDown
    onKeyDown?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const normalizedValue = normalizeSingleLineValue(e.currentTarget.value);
    if (normalizedValue !== e.currentTarget.value) {
      e.currentTarget.value = normalizedValue;
    }
    onChange?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const normalizedText = normalizeSingleLineValue(pastedText);

    if (normalizedText !== pastedText) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.setRangeText(normalizedText, start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    onPaste?.(e);
  };

  return (
    <textarea
      data-slot="textarea-input"
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      data-form-type="other"
      rows={rows}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onPaste={handlePaste}
      value={typeof value === 'string' ? normalizeSingleLineValue(value) : value}
      defaultValue={
        typeof defaultValue === 'string' ? normalizeSingleLineValue(defaultValue) : defaultValue
      }
      className={cn(
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none resize-none overflow-hidden disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm whitespace-nowrap',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      style={{
        lineHeight: '1.75rem',
        verticalAlign: 'middle',
        ...props.style,
      }}
      {...props}
    />
  );
}

export { TextareaInput };
