import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@/lib/tauri';
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  Shield,
  Lock,
  Zap,
  ClipboardPaste,
  Network,
  User,
} from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TextareaInput } from '@/components/textarea-input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnvironmentDialogStore } from '../stores';
import { createProxy } from '../api';

type ProxyType = 'http' | 'https' | 'socks5';

interface ProxyFormData {
  type: ProxyType;
  host: string;
  port: string;
  username: string;
  password: string;
}

interface EnvironmentCreateProxyDialogProps {
  onComplete?: () => void;
}

/**
 * 代理类型配置
 */
const PROXY_TYPES: {
  value: ProxyType;
  label: string;
  icon: React.FC<{ className?: string }>;
  descriptionKey: string;
}[] = [
  {
    value: 'http',
    label: 'HTTP',
    icon: Globe,
    descriptionKey: 'dialog.createProxy.httpDesc',
  },
  {
    value: 'https',
    label: 'HTTPS',
    icon: Lock,
    descriptionKey: 'dialog.createProxy.httpsDesc',
  },
  {
    value: 'socks5',
    label: 'SOCKS5',
    icon: Shield,
    descriptionKey: 'dialog.createProxy.socks5Desc',
  },
];

/**
 * 代理类型选择卡片
 */
const ProxyTypeCard: React.FC<{
  type: (typeof PROXY_TYPES)[number];
  isSelected: boolean;
  onClick: () => void;
}> = ({ type, isSelected, onClick }) => {
  const Icon = type.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors duration-150 ${
        isSelected
          ? 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/50 shadow-sm'
          : 'bg-card/50 border-transparent hover:bg-muted/80'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${
          isSelected
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
            : 'bg-muted text-muted-foreground'
        } transition-all duration-200`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span
        className={`text-xs font-medium ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}
      >
        {type.label}
      </span>
    </button>
  );
};

/**
 * 创建代理对话框
 */
export function EnvironmentCreateProxyDialog({ onComplete }: EnvironmentCreateProxyDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();

  // 表单数据
  const [formData, setFormData] = useState<ProxyFormData>({
    type: 'http',
    host: '',
    port: '',
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 代理检测
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [testIpInfo, setTestIpInfo] = useState<{ ip: string; country: string; city: string; latency: number } | null>(null);

  // 重置表单
  const resetForm = () => {
    setFormData({ type: 'http', host: '', port: '', username: '', password: '' });
    setShowPassword(false);
    setTestResult(null);
    setTestIpInfo(null);
  };

  // 解析粘贴的代理格式
  const handlePasteProxy = async () => {
    try {
      const text = await readText();
      if (!text.trim()) {
        toast.warning(t('dialog.createProxy.clipboardEmpty'));
        return;
      }

      // 支持的格式：
      // host:port
      // host:port:username:password
      // username:password@host:port
      // type://host:port
      // type://username:password@host:port

      let parsed: Partial<ProxyFormData> = {};

      // 检测是否有协议前缀
      const protocolMatch = text.match(/^(http|https|socks5):\/\//i);
      let remaining = text;
      if (protocolMatch) {
        parsed.type = protocolMatch[1].toLowerCase() as ProxyType;
        remaining = text.slice(protocolMatch[0].length);
      }

      // 检测 username:password@host:port 格式
      const atMatch = remaining.match(/^([^:]+):([^@]+)@(.+)$/);
      if (atMatch) {
        parsed.username = atMatch[1];
        parsed.password = atMatch[2];
        remaining = atMatch[3];
      }

      // 解析 host:port 或 host:port:username:password
      const parts = remaining.split(':');
      if (parts.length >= 2) {
        parsed.host = parts[0];
        parsed.port = parts[1];
        if (parts.length >= 4 && !parsed.username) {
          parsed.username = parts[2];
          parsed.password = parts[3];
        }
      }

      if (parsed.host && parsed.port) {
        setFormData((prev) => ({
          ...prev,
          ...parsed,
        }));
        toast.success(t('dialog.createProxy.importSuccess'));
      } else {
        toast.error(t('dialog.createProxy.parseError'));
      }
    } catch {
      toast.error(t('dialog.createProxy.clipboardError'));
    }
  };

  // 测试代理
  const handleTestProxy = async (silent = false) => {
    if (!formData.host.trim() || !formData.port.trim()) {
      return null;
    }

    setTesting(true);
    if (!silent) {
      setTestResult(null);
      setTestIpInfo(null);
    }

    try {
      const result = await invoke<{
        success: boolean;
        ip_info?: { ip: string; country: string; country_code: string; city: string };
        latency_ms?: number;
        error?: string;
      }>('test_proxy', {
        config: {
          proxy_type: formData.type,
          host: formData.host.trim(),
          port: parseInt(formData.port, 10),
          username: formData.username || null,
          password: formData.password
            ? { value: formData.password, encrypted: false }
            : null,
        },
      });

      if (result.success && result.ip_info) {
        const ipInfo = {
          ip: result.ip_info.ip,
          country: result.ip_info.country || result.ip_info.country_code || '',
          city: result.ip_info.city || '',
          latency: result.latency_ms || 0,
        };
        if (!silent) {
          setTestResult('success');
          setTestIpInfo(ipInfo);
        }
        return ipInfo;
      } else {
        if (!silent) {
          setTestResult('failed');
        }
        return null;
      }
    } catch (e) {
      if (!silent) {
        setTestResult('failed');
      }
      return null;
    } finally {
      setTesting(false);
    }
  };

  // 创建代理
  const handleCreate = async () => {
    if (!formData.host.trim()) {
      toast.warning(t('dialog.proxy.hostRequired'));
      return;
    }
    if (!formData.port.trim()) {
      toast.warning(t('dialog.proxy.portRequired'));
      return;
    }

    setSubmitting(true);
    try {
      // 如果还没有测试过，先静默测试获取 country 和 city
      let country = testIpInfo?.country;
      let city: string | undefined;
      if (!testResult && !testing) {
        const ipInfo = await handleTestProxy(true); // 静默测试
        country = ipInfo?.country;
        city = ipInfo?.city;
      } else if (testIpInfo) {
        // 如果已经测试过，使用测试结果中的 city
        city = testIpInfo.city;
      }

      const proxyName = `${formData.host}:${formData.port}`;
      
      // 创建代理，传递 country 和 city（如果有）
      await createProxy({
        name: proxyName,
        host: formData.host,
        port: parseInt(formData.port, 10),
        proxy_type: formData.type,
        username: formData.username || undefined,
        password: formData.password || undefined,
        country: country,
        city: city,
      });
      
      toast.success(t('dialog.createProxy.createSuccess'));
      
      dialogStore.closeCreateProxyDialog();
      resetForm();
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.createProxy.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const canTest = formData.host.trim() && formData.port.trim();
  const canCreate = canTest;

  return (
    <FormattedDialog
      open={dialogStore.createProxyDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          dialogStore.closeCreateProxyDialog();
          resetForm();
        }
      }}
      minWidth="min-w-[480px]"
      header={{
        icon: Network,
        iconColor: 'text-blue-500',
        title: t('dialog.createProxy.title'),
        description: t('dialog.createProxy.description'),
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-border/50',
      }}
    >
      <div className="space-y-4">
          {/* 代理类型选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('dialog.createProxy.proxyType')}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PROXY_TYPES.map((type) => (
                <ProxyTypeCard
                  key={type.value}
                  type={type}
                  isSelected={formData.type === type.value}
                  onClick={() => setFormData({ ...formData, type: type.value })}
                />
              ))}
            </div>
          </div>

        {/* 下方表单区域（卡片容器） */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4">
          {/* 服务器配置 */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="proxy-host" className="text-xs text-muted-foreground">
                  {t('dialog.createProxy.hostLabel')} <span className="text-destructive">*</span>
                </Label>
                <TextareaInput
                  id="proxy-host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="text-sm min-h-9"
                  placeholder={t('dialog.createProxy.hostPlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proxy-port" className="text-xs text-muted-foreground">
                  {t('dialog.createProxy.portLabel')} <span className="text-destructive">*</span>
                </Label>
                <TextareaInput
                  id="proxy-port"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      port: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  className="text-sm min-h-9"
                  placeholder="8080"
                />
              </div>
            </div>
          </div>

          {/* 认证信息（可选） */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proxy-username" className="text-xs flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  {t('dialog.createProxy.username')}
                </Label>
                <TextareaInput
                  id="proxy-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="text-sm min-h-9"
                  placeholder={t('dialog.createProxy.optional')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proxy-password" className="text-xs flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  {t('dialog.createProxy.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="proxy-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-9 text-sm pr-9"
                    placeholder={t('dialog.createProxy.optional')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center hover:bg-accent rounded-r transition-colors"
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
          </div>

          {/* 代理检测 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                {t('dialog.createProxy.connectionTest')}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleTestProxy(false)}
                disabled={testing || !canTest}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    {t('dialog.createProxy.testing')}
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1.5" />
                    {t('dialog.createProxy.testConnection')}
                  </>
                )}
              </Button>
            </div>
            {testResult && (
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                  testResult === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}
              >
                {testResult === 'success' ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{t('dialog.createProxy.testSuccess')}</div>
                      <div className="text-[10px] opacity-80">
                        {testIpInfo ? (
                          <span>IP: {testIpInfo.ip} {testIpInfo.country && `(${testIpInfo.country})`} - {testIpInfo.latency}ms</span>
                        ) : (
                          t('dialog.createProxy.testSuccessDesc')
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{t('dialog.createProxy.testFailed')}</div>
                      <div className="text-[10px] opacity-80">
                        {t('dialog.createProxy.testFailedDesc')}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <FormattedDialogFooter>
          {/* 剪切板导入按钮 - 左侧 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
                onClick={handlePasteProxy}
                disabled={submitting}
              >
                <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                {t('dialog.createProxy.pasteFromClipboard')}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="text-muted-foreground font-mono">host:port</p>
              <p className="text-muted-foreground font-mono">host:port:user:pass</p>
              <p className="text-muted-foreground font-mono">socks5://host:port</p>
            </TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              dialogStore.closeCreateProxyDialog();
              resetForm();
            }}
            disabled={submitting}
          >
            {t('dialog.createProxy.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleCreate}
            disabled={submitting || !canCreate}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('dialog.createProxy.creating')}
              </>
            ) : (
              t('dialog.createProxy.create')
            )}
          </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
