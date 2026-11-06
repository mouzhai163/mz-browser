import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';

interface CreateWindowEditUrlsDialogProps {
  open: boolean;
  urls: string[]; // URL 字符串列表
  onOpenChange: (open: boolean) => void;
  onConfirm: (urls: string[]) => void;
}

/**
 * 验证 URL 格式
 */
function validateUrl(url: string, t: (key: string) => string): { valid: boolean; error?: string } {
  if (!url.trim()) {
    return { valid: false, error: t('dialog.urls.urlRequired') || '请输入 URL' };
  }
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        error: t('dialog.urls.invalidProtocol') || 'URL 必须以 http:// 或 https:// 开头',
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: t('dialog.urls.invalidUrl') || '无效的 URL 格式' };
  }
}

/**
 * 创建窗口编辑 URLs 对话框
 */
export function CreateWindowEditUrlsDialog({
  open,
  urls: initialUrls,
  onOpenChange,
  onConfirm,
}: CreateWindowEditUrlsDialogProps) {
  const { t } = useTranslation('create-window');
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // 初始化
  useEffect(() => {
    if (open) {
      setNewUrl('');
      setUrlError('');
    }
  }, [open]);

  // 添加 URL（支持多行输入，每行一个 URL）
  const handleAddUrl = () => {
    if (!newUrl.trim()) {
      setUrlError(t('dialog.urls.urlRequired') || '请输入 URL');
      return;
    }

    // 按行分割，处理多行输入
    const lines = newUrl
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const validUrls: string[] = [];
    let hasError = false;
    let firstError = '';

    for (const line of lines) {
      const validation = validateUrl(line, t);
      if (validation.valid) {
        validUrls.push(line);
      } else {
        hasError = true;
        if (!firstError) {
          firstError = validation.error || t('dialog.urls.invalidUrl') || '无效的 URL 格式';
        }
      }
    }

    if (hasError && validUrls.length === 0) {
      // 所有 URL 都无效
      setUrlError(firstError);
      return;
    }

    if (validUrls.length > 0) {
      // 添加有效的 URL 到现有列表
      const updatedUrls = [...(initialUrls || []), ...validUrls];
      onConfirm(updatedUrls);
      // 添加后关闭对话框
      setNewUrl('');
      setUrlError('');
      onOpenChange(false);
    } else {
      setUrlError(firstError);
    }
  };

  const handleClose = () => {
    setNewUrl('');
    setUrlError('');
    onOpenChange(false);
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[520px]"
      header={{
        icon: Link2,
        iconColor: 'text-green-500',
        title: t('dialog.urls.addUrl') || '添加 URL',
        description: t('dialog.urls.selectDescription') || '输入 URL，每行一个',
        gradient: 'bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10',
        className: 'border-b border-border/50',
      }}
    >
      <div className="space-y-4">
        {/* 添加 URL 区域 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            URL <span className="text-destructive">*</span>
          </Label>
          <TextareaInput
            value={newUrl}
            onChange={(e) => {
              setNewUrl(e.target.value);
              setUrlError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            className={`text-sm min-h-[80px] ${urlError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
            placeholder={
              t('dialog.urls.urlsPlaceholder') ||
              '请输入 URL，每行一个（必须以 http:// 或 https:// 开头）'
            }
          />
          {urlError && <p className="text-[10px] text-destructive mt-0.5">{urlError}</p>}
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={handleClose}>
          {t('dialog.urls.cancel') || '取消'}
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleAddUrl}
        >
          {t('dialog.urls.add') || '添加'}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
