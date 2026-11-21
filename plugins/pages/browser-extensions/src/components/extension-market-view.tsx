import { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Store,
  Upload,
  PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  MARKET_CATEGORIES,
  MARKET_EXTENSIONS,
  type MarketCategory,
  type MarketExtensionItem,
} from '../data/market-catalog';

interface ExtensionMarketViewProps {
  activeTab: 'market' | 'installed';
  installedCount: number;
  installedExtensionIds: Set<string>;
  downloadingIds: Set<string>;
  onTabChange: (tab: 'market' | 'installed') => void;
  onDownloadMarketItem: (item: MarketExtensionItem) => Promise<void>;
  onOpenChromeUrlImport: () => void;
  onOpenLocalFileImport: () => void;
  onRefresh: () => void;
  installedContent: React.ReactNode;
}

export function ExtensionMarketView({
  activeTab,
  installedCount,
  installedExtensionIds,
  downloadingIds,
  onTabChange,
  onDownloadMarketItem,
  onOpenChromeUrlImport,
  onOpenLocalFileImport,
  onRefresh,
  installedContent,
}: ExtensionMarketViewProps) {
  const [category, setCategory] = useState<MarketCategory>('全部');
  const [keyword, setKeyword] = useState('');

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return MARKET_EXTENSIONS.filter((item) => {
      const matchCat = category === '全部' || item.category === category;
      if (!matchCat) return false;
      if (!kw) return true;
      return (
        item.name.toLowerCase().includes(kw) ||
        item.description.toLowerCase().includes(kw) ||
        item.category.toLowerCase().includes(kw) ||
        item.extensionId.toLowerCase().includes(kw)
      );
    });
  }, [category, keyword]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* 顶部栏：左侧双 Tab + 右侧搜索/刷新/上传/Chrome URL */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 pb-3 pt-4">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onTabChange('market')}
            className={cn(
              'relative flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors',
              activeTab === 'market'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Store className="h-4 w-4" />
            <span>拓展市场</span>
            {activeTab === 'market' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-violet-600 dark:bg-violet-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('installed')}
            className={cn(
              'relative flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors',
              activeTab === 'installed'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <PackageCheck className="h-4 w-4" />
            <span>已下载拓展</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
              {installedCount}
            </span>
            {activeTab === 'installed' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-violet-600 dark:bg-violet-400" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'market' && (
            <div className="relative w-56">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索关键词或扩展 ID"
                className="h-8 pr-8 text-xs"
              />
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onRefresh}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            刷新
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onOpenLocalFileImport}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            上传 .crx / .zip
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onOpenChromeUrlImport}
            className="h-8 rounded-lg bg-violet-600 px-3.5 text-xs text-white hover:bg-violet-700"
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Chrome URL
          </Button>
        </div>
      </div>

      {activeTab === 'installed' ? (
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">{installedContent}</div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-6 pb-4 pt-3">
          {/* 分类标签栏 */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {MARKET_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-violet-500/12 text-violet-600 dark:text-violet-400'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* 商业化表格列表 */}
          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border/70 bg-card">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/50 text-muted-foreground backdrop-blur">
                <tr>
                  <th className="w-[28%] px-4 py-3 font-medium">拓展</th>
                  <th className="w-[12%] px-4 py-3 font-medium">分类</th>
                  <th className="w-[12%] px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">说明</th>
                  <th className="w-28 px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      未找到匹配的精选扩展，可点击右上角「Chrome URL」粘贴任意 Chrome 商店链接或 ID 直接下载。
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isInstalled = installedExtensionIds.has(item.extensionId);
                    const isDownloading = downloadingIds.has(item.extensionId);
                    return (
                      <tr
                        key={item.extensionId}
                        className="transition-colors hover:bg-accent/35"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-xs',
                                item.badgeColor
                              )}
                            >
                              {item.badgeText}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{item.name}</p>
                              <p className="truncate font-mono text-[10px] text-muted-foreground/75">
                                {item.extensionId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                        <td className="px-4 py-3 text-muted-foreground">Chrome 官方</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p className="line-clamp-2 leading-relaxed">{item.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isInstalled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3.5 w-3.5" />
                              已下载
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isDownloading}
                              onClick={() => void onDownloadMarketItem(item)}
                              className="h-7 rounded-full bg-violet-600 px-3.5 text-xs text-white hover:bg-violet-700"
                            >
                              {isDownloading ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  下载中
                                </>
                              ) : (
                                <>
                                  <Download className="mr-1 h-3 w-3" />
                                  下载
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              共精选 {filteredItems.length} 个常用扩展 · 下载时自动走「代理中心 → 网络配置」中转链路
            </span>
            <span>支持任意 Chrome 商店 URL / 32 位 ID 及本地 .crx / .zip 扩展包</span>
          </div>
        </div>
      )}
    </div>
  );
}
