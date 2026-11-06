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
import type { ProxyFormData } from '../types';

type ProxyType = 'http' | 'https' | 'socks5';

interface ProxyCreateDialogProps {
  open: boolean;
  formData: ProxyFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: ProxyFormData) => void;
  onSubmit: (extraData?: { country?: string; city?: string }) => void;
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
    descriptionKey: 'dialog.create.httpDesc',
  },
  {
    value: 'https',
    label: 'HTTPS',
    icon: Lock,
    descriptionKey: 'dialog.create.httpsDesc',
  },
  {
    value: 'socks5',
    label: 'SOCKS5',
    icon: Shield,
    descriptionKey: 'dialog.create.socks5Desc',
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

const defaultFormData: ProxyFormData = {
  name: '',
  host: '',
  port: '',
  type: 'http',
  username: '',
  password: '',
  country: '',
  remark: '',
};

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
  const { t } = useTranslation('proxy');
  const [showPassword, setShowPassword] = useState(false);

  // 代理检测
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [testIpInfo, setTestIpInfo] = useState<{ ip: string; country: string; city: string; latency: number } | null>(null);

  // 重置表单
  const resetForm = () => {
    onFormDataChange(defaultFormData);
    setShowPassword(false);
    setTestResult(null);
    setTestIpInfo(null);
  };

  // 解析粘贴的代理格式
  const handlePasteProxy = async () => {
    try {
      const text = await readText();
      if (!text?.trim()) {
        toast.warning(t('dialog.create.clipboardEmpty', { defaultValue: '剪贴板为空' }));
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
        onFormDataChange({
          ...formData,
          ...parsed,
        });
        toast.success(t('dialog.create.importSuccess', { defaultValue: '导入成功' }));
      } else {
        toast.error(t('dialog.create.parseError', { defaultValue: '无法解析代理格式' }));
      }
    } catch {
      toast.error(t('dialog.create.clipboardError', { defaultValue: '读取剪贴板失败' }));
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
          // 创建时密码总是明文
          password: formData.password ? { value: formData.password, encrypted: false } : null,
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
          // 自动更新 formData 中的 country 字段
          onFormDataChange({ ...formData, country: ipInfo.country });
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

  const canTest = formData.host.trim() && formData.port.trim();
  const canCreate = canTest;

  // 处理创建：如果还没有测试过，先静默测试获取 country 和 city
  const handleCreateClick = async () => {
    let country = formData.country || testIpInfo?.country;
    let city = formData.city || testIpInfo?.city;
    
    // 如果还没有测试过，先静默测试获取 country 和 city
    if (!testResult && !testing) {
      const ipInfo = await handleTestProxy(true); // 静默测试，等待完成
      country = ipInfo?.country || country; // 使用测试结果
      city = ipInfo?.city || city;
    }
    
    // 调用创建，直接传递 country 和 city
    onSubmit({ country, city });
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
        }
        onOpenChange(open);
      }}
      header={{
        icon: Network,
        iconColor: 'text-blue-500',
        title: t('dialog.create.title'),
        description: t('dialog.create.description', { defaultValue: '添加新的代理服务器配置' }),
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
      }}
      minWidth="max-w-[480px]"
    >
      <div className="space-y-4">
          {/* 代理类型选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('dialog.create.type')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROXY_TYPES.map((type) => (
                <ProxyTypeCard
                  key={type.value}
                  type={type}
                  isSelected={formData.type === type.value}
                  onClick={() => onFormDataChange({ ...formData, type: type.value })}
                />
              ))}
            </div>
          </div>

          {/* 下方表单区域（卡片容器） */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4">
            {/* 服务器配置 */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="proxy-host" className="text-xs">
                    {t('dialog.create.host')} <span className="text-destructive">*</span>
                  </Label>
                  <TextareaInput
                    id="proxy-host"
                    value={formData.host}
                    onChange={(e) => onFormDataChange({ ...formData, host: e.target.value })}
                    className="text-xs"
                    placeholder={t('dialog.create.hostPlaceholder', {
                      defaultValue: '例如：192.168.1.1',
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proxy-port" className="text-xs">
                    {t('dialog.create.port')} <span className="text-destructive">*</span>
                  </Label>
                  <TextareaInput
                    id="proxy-port"
                    value={formData.port}
                    onChange={(e) =>
                      onFormDataChange({
                        ...formData,
                        port: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className="text-xs"
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
                    {t('dialog.create.username')}
                  </Label>
                  <TextareaInput
                    id="proxy-username"
                    value={formData.username}
                    onChange={(e) => onFormDataChange({ ...formData, username: e.target.value })}
                    className="text-xs"
                    placeholder={t('dialog.create.optional', { defaultValue: '可选' })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proxy-password" className="text-xs flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    {t('dialog.create.password')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="proxy-password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => onFormDataChange({ ...formData, password: e.target.value })}
                      className="h-9 text-sm pr-9"
                      placeholder={t('dialog.create.optional', { defaultValue: '可选' })}
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
                  {t('dialog.create.connectionTest', { defaultValue: '连接测试' })}
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
                      {t('dialog.create.testing', { defaultValue: '检测中...' })}
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1.5" />
                      {t('dialog.create.testConnection', { defaultValue: '测试连接' })}
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
                        <div className="font-medium">
                          {t('dialog.create.testSuccess', { defaultValue: '连接成功' })}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {testIpInfo ? (
                            <span>IP: {testIpInfo.ip} {testIpInfo.country && `(${testIpInfo.country})`} - {testIpInfo.latency}ms</span>
                          ) : (
                            t('dialog.create.testSuccessDesc', {
                              defaultValue: '代理服务器响应正常',
                            })
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      <div>
                        <div className="font-medium">
                          {t('dialog.create.testFailed', { defaultValue: '连接失败' })}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {t('dialog.create.testFailedDesc', {
                            defaultValue: '请检查代理配置是否正确',
                          })}
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
              {t('dialog.create.pasteFromClipboard', { defaultValue: '从剪贴板导入' })}
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
            resetForm();
            onOpenChange(false);
          }}
          disabled={submitting}
        >
          {t('dialog.create.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleCreateClick}
          disabled={submitting || !canCreate}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.create.submitting', { defaultValue: '创建中...' })}
            </>
          ) : (
            t('dialog.create.submit', { defaultValue: '创建' })
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
