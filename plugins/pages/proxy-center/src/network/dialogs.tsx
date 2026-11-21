import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AddNodesRequest, RelayGroup } from './types';

interface AddSubscriptionDialogProps {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, url: string) => Promise<void>;
}

export function AddSubscriptionDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: AddSubscriptionDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const handleConfirm = async () => {
    if (!url.trim()) return;
    await onSubmit(name.trim() || '自定义订阅', url.trim());
    setName('');
    setUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入订阅</DialogTitle>
          <DialogDescription>
            支持 Clash YAML 订阅或 Base64 节点订阅链接，导入后将自动解析所有中转节点。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">订阅名称</label>
            <Input
              placeholder="例如：香港高速订阅"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">订阅链接 (URL)</label>
            <Input
              placeholder="https://example.com/sub?token=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting || !url.trim()}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            导入订阅
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddGroupDialogProps {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
}

export function AddGroupDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: AddGroupDialogProps) {
  const [name, setName] = useState('');

  const handleConfirm = async () => {
    if (!name.trim()) return;
    await onSubmit(name.trim());
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>新建本地分组</DialogTitle>
          <DialogDescription>用于归类手动添加或粘贴的中转节点。</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <label className="text-xs font-medium text-muted-foreground">分组名称</label>
          <Input
            placeholder="例如：自建中转"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            创建分组
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddNodeDialogProps {
  open: boolean;
  groups: RelayGroup[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: AddNodesRequest) => Promise<void>;
}

export function AddNodeDialog({
  open,
  groups,
  submitting,
  onOpenChange,
  onSubmit,
}: AddNodeDialogProps) {
  const localGroups = groups.filter((g) => g.kind === 'local');
  const availableGroups = localGroups.length > 0 ? localGroups : groups;

  const [tab, setTab] = useState<'link' | 'manual'>('link');
  const [groupId, setGroupId] = useState(availableGroups[0]?.id ?? 'default-local-group');
  const [rawLinks, setRawLinks] = useState('');

  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<'socks5' | 'http' | 'https'>('socks5');
  const [server, setServer] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const effectiveGroupId = availableGroups.some((g) => g.id === groupId)
    ? groupId
    : availableGroups[0]?.id ?? 'default-local-group';

  const handleConfirm = async () => {
    if (tab === 'link') {
      if (!rawLinks.trim()) return;
      await onSubmit({
        group_id: effectiveGroupId,
        raw_links: rawLinks.trim(),
      });
      setRawLinks('');
    } else {
      const parsedPort = Number(port);
      if (!server.trim() || !parsedPort) return;
      await onSubmit({
        group_id: effectiveGroupId,
        manual_node: {
          name: name.trim() || `${server.trim()}:${parsedPort}`,
          protocol,
          server: server.trim(),
          port: parsedPort,
          username: username.trim() || undefined,
          password: password.trim() || undefined,
        },
      });
      setName('');
      setServer('');
      setPort('');
      setUsername('');
      setPassword('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加中转节点</DialogTitle>
          <DialogDescription>
            支持批量粘贴分享链接（vmess / vless / trojan / ss / hysteria2 / socks5 / http）或手动填写。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-md bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setTab('link')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  tab === 'link'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                分享链接导入
              </button>
              <button
                type="button"
                onClick={() => setTab('manual')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  tab === 'manual'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                手动配置 (HTTP/SOCKS5)
              </button>
            </div>

            <div className="w-40">
              <Select value={effectiveGroupId} onValueChange={setGroupId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择分组" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tab === 'link' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                节点链接（每行一条）
              </label>
              <textarea
                rows={6}
                placeholder={'vmess://...\nvless://...\ntrojan://...\nss://...\nsocks5://user:pass@host:port#备注'}
                value={rawLinks}
                onChange={(e) => setRawLinks(e.target.value)}
                disabled={submitting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">节点名称</label>
                <Input
                  placeholder="例如：HK 香港中转"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">协议</label>
                <Select
                  value={protocol}
                  onValueChange={(v) => setProtocol(v as 'socks5' | 'http' | 'https')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">端口</label>
                <Input
                  type="number"
                  placeholder="1080"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">服务器地址</label>
                <Input
                  placeholder="1.2.3.4 或 relay.example.com"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">用户名（可选）</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">密码（可选）</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={
              submitting ||
              (tab === 'link' ? !rawLinks.trim() : !server.trim() || !Number(port))
            }
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            添加节点
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
