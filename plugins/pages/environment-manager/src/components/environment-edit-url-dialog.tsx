import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Globe, Plus, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEnvironmentDialogStore } from '../stores';
import { listEnvironmentUrls, addEnvironmentUrl, clearEnvironmentUrls } from '../api';

interface EnvironmentEditUrlDialogProps {
  onComplete?: () => void;
}

/**
 * 编辑环境 URL 对话框（支持多个 URL）
 */
export function EnvironmentEditUrlDialog({ onComplete }: EnvironmentEditUrlDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const [urls, setUrls] = useState<{ url: string; title?: string }[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载 URLs
  useEffect(() => {
    if (dialogStore.editUrlEnvironment && dialogStore.editUrlDialogOpen) {
      loadUrls();
    }
  }, [dialogStore.editUrlEnvironment, dialogStore.editUrlDialogOpen]);

  const loadUrls = async () => {
    if (!dialogStore.editUrlEnvironment) return;

    setLoading(true);
    try {
      const result = await listEnvironmentUrls(dialogStore.editUrlEnvironment.uuid);
      // 按 sort_order 排序
      const sortedUrls = [...result].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setUrls(sortedUrls.map((item) => ({ url: item.url, title: item.title })));
    } catch (e) {
      console.error('Failed to load URLs:', e);
      setUrls([]);
    } finally {
      setLoading(false);
    }
  };

  // 验证 URL 格式
  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setUrlError('');
      return false;
    }
    try {
      const urlObj = new URL(value);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setUrlError(t('dialog.editUrl.invalidProtocol'));
        return false;
      }
      setUrlError('');
      return true;
    } catch {
      setUrlError(t('dialog.editUrl.invalidUrl'));
      return false;
    }
  };

  // 添加 URL
  const handleAddUrl = () => {
    if (!newUrl.trim()) return;
    if (!validateUrl(newUrl)) return;

    // 检查是否重复
    if (urls.some((item) => item.url === newUrl.trim())) {
      toast.warning(t('dialog.editUrl.duplicate'));
      return;
    }

    setUrls((prev) => [...prev, { url: newUrl.trim() }]);
    setNewUrl('');
    setUrlError('');
  };

  // 移除 URL
  const handleRemoveUrl = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // 移动 URL（上移/下移）
  const handleMoveUrl = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === urls.length - 1) return;

    const newUrls = [...urls];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newUrls[index], newUrls[targetIndex]] = [newUrls[targetIndex], newUrls[index]];
    setUrls(newUrls);
  };

  // 保存 URLs
  const handleSave = async () => {
    if (!dialogStore.editUrlEnvironment) return;

    setSaving(true);
    try {
      const uuid = dialogStore.editUrlEnvironment.uuid;

      // 先清空现有 URLs
      await clearEnvironmentUrls(uuid);

      // 添加所有 URLs（按顺序）
      for (let i = 0; i < urls.length; i++) {
        await addEnvironmentUrl(uuid, urls[i].url, urls[i].title, i);
      }

      dialogStore.closeEditUrlDialog();
      toast.success(t('dialog.editUrl.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.editUrl.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setUrls([]);
    setNewUrl('');
    setUrlError('');
    dialogStore.closeEditUrlDialog();
  };

  if (!dialogStore.editUrlEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.editUrlDialogOpen && !!dialogStore.editUrlEnvironment}
      onOpenChange={(open) => {
        dialogStore.setEditUrlDialogOpen(open);
        if (!open) {
          handleClose();
        }
      }}
      minWidth="min-w-[600px]"
      header={{
        icon: Globe,
        iconColor: 'text-blue-500',
        title: t('dialog.editUrl.title'),
        description: t('dialog.editUrl.description'),
      }}
    >
      <div className="space-y-4">
        {/* 添加 URL 区域 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editUrl.addUrl')}
          </Label>
          <div className="flex gap-2">
            <TextareaInput
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                if (e.target.value) {
                  validateUrl(e.target.value);
                } else {
                  setUrlError('');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddUrl();
                }
              }}
              placeholder={t('dialog.editUrl.urlPlaceholder')}
              className={`flex-1 text-sm min-h-9 ${urlError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
              disabled={saving || loading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddUrl}
              disabled={!newUrl.trim() || !!urlError || saving || loading}
              className="shrink-0 h-9"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t('dialog.editUrl.add')}
            </Button>
          </div>
          {urlError && <p className="text-[10px] text-destructive">{urlError}</p>}
          <p className="text-[10px] text-muted-foreground">{t('dialog.editUrl.hint')}</p>
        </div>

        {/* URL 列表 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editUrl.urlList')} ({urls.length})
          </Label>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground border border-border/50 rounded-md">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">{t('dialog.editUrl.loading')}</span>
            </div>
          ) : urls.length > 0 ? (
            <ScrollArea className="h-[240px] border border-border/50 rounded-md">
              <div className="p-2 space-y-1">
                {urls.map((item, index) => (
                  <div key={index} className="flex items-center gap-1 group">
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveUrl(index, 'up')}
                        disabled={index === 0 || saving || loading}
                      >
                        <i className="fa-solid fa-chevron-up text-[8px]"></i>
                      </button>
                      <button
                        type="button"
                        className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveUrl(index, 'down')}
                        disabled={index === urls.length - 1 || saving || loading}
                      >
                        <i className="fa-solid fa-chevron-down text-[8px]"></i>
                      </button>
                    </div>
                    <div className="flex-1 h-8 px-2 flex items-center text-xs bg-muted rounded overflow-hidden">
                      <span className="text-muted-foreground mr-2 text-[10px] font-medium">
                        {index + 1}.
                      </span>
                      <span className="truncate">{item.url}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleRemoveUrl(index)}
                      disabled={saving || loading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-32 px-4 flex items-center justify-center text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-md">
              {t('dialog.editUrl.noUrls')}
            </div>
          )}
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={handleClose} disabled={saving || loading}>
          {t('dialog.editUrl.cancel')}
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.editUrl.saving')}
            </>
          ) : (
            t('dialog.editUrl.save')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
