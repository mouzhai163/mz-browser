import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ProxyType = 'http' | 'https' | 'socks5' | 'ssh';

export interface ProxyFormData {
  type: ProxyType;
  host: string;
  port: string;
  username: string;
  password: string;
}

interface ProxyCreateDialogProps {
  open: boolean;
  formData: ProxyFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: ProxyFormData) => void;
  onSubmit: () => void;
}

/**
 * 创建代理对话框组件
 */
export function ProxyCreateDialog({
  open,
  formData,
  submitting,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: ProxyCreateDialogProps) {
  const { t } = useTranslation('create-window');
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 代理检测功能
  const handleTestProxy = async () => {
    if (!formData.host.trim() || !formData.port.trim()) {
      setTestResult({ success: false, message: t('proxyDialog.testError.required') });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // TODO: 实现实际的代理检测逻辑
      // 这里应该调用 API 检测代理
      // 暂时模拟检测过程
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 模拟检测结果
      const success = Math.random() > 0.3; // 70% 成功率
      setTestResult({
        success,
        message: success ? t('proxyDialog.testSuccess') : t('proxyDialog.testFailed'),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('proxyDialog.testError.unknown'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.host.trim()) {
      toast.warning(t('proxyDialog.hostError.required'));
      return;
    }
    if (!formData.port.trim()) {
      toast.warning(t('proxyDialog.portError.required'));
      return;
    }
    onSubmit();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onFormDataChange({ type: 'http', host: '', port: '', username: '', password: '' });
          setTestResult(null);
          setShowPassword(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px] gap-0 p-3">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold mb-0">{t('proxyDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* 代理类型 */}
          <div className="space-y-1">
            <Label htmlFor="proxy-type" className="text-[10px] mb-0.5">
              {t('proxyDialog.type')} *
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => onFormDataChange({ ...formData, type: value as ProxyType })}
            >
              <SelectTrigger id="proxy-type" className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="https">HTTPS</SelectItem>
                <SelectItem value="socks5">SOCKS5</SelectItem>
                <SelectItem value="ssh">SSH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Host 和 Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="proxy-host" className="text-[10px] mb-0.5">
                {t('proxyDialog.host')} *
              </Label>
              <TextareaInput
                id="proxy-host"
                value={formData.host}
                onChange={(e) => onFormDataChange({ ...formData, host: e.target.value })}
                className="text-xs"
                placeholder={t('proxyDialog.hostPlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proxy-port" className="text-[10px] mb-0.5">
                {t('proxyDialog.port')} *
              </Label>
              <TextareaInput
                id="proxy-port"
                value={formData.port}
                onChange={(e) => onFormDataChange({ ...formData, port: e.target.value })}
                className="text-xs"
                placeholder={t('proxyDialog.portPlaceholder')}
              />
            </div>
          </div>

          {/* 账号和密码 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="proxy-username" className="text-[10px] mb-0.5">
                {t('proxyDialog.username')}
              </Label>
              <TextareaInput
                id="proxy-username"
                value={formData.username}
                onChange={(e) => onFormDataChange({ ...formData, username: e.target.value })}
                className="text-xs"
                placeholder={t('proxyDialog.usernamePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proxy-password" className="text-[10px] mb-0.5">
                {t('proxyDialog.password')}
              </Label>
              <div className="relative">
                <TextareaInput
                  id="proxy-password"
                  value={formData.password}
                  onChange={(e) => onFormDataChange({ ...formData, password: e.target.value })}
                  className="pr-8 text-xs"
                  placeholder={t('proxyDialog.passwordPlaceholder')}
                  style={
                    {
                      WebkitTextSecurity: showPassword ? 'none' : 'disc',
                      lineHeight: '1.75rem',
                    } as React.CSSProperties
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-8 w-8 flex items-center justify-center hover:bg-accent rounded-r transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 代理检测 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] mb-0.5">{t('proxyDialog.test')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[10px] px-3 py-1.5 h-7"
                onClick={handleTestProxy}
                disabled={testing || !formData.host.trim() || !formData.port.trim()}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {t('proxyDialog.testing')}
                  </>
                ) : (
                  t('proxyDialog.testButton')
                )}
              </Button>
            </div>
            {testResult && (
              <div
                className={`text-[10px] px-2 py-1 rounded ${
                  testResult.success
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[10px] px-3 py-1.5 h-7"
            onClick={() => {
              onOpenChange(false);
              onFormDataChange({ type: 'http', host: '', port: '', username: '', password: '' });
              setTestResult(null);
              setShowPassword(false);
            }}
          >
            {t('proxyDialog.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-[10px] px-3 py-1.5 h-7"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t('proxyDialog.submitting') : t('proxyDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
