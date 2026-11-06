import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  Check,
  X,
  AlertCircle,
  Network,
  ChevronLeft,
  ChevronRight,
  TestTube2,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type ColumnDef } from '@/components/data-table';
import {
  DataTableCheckboxCell,
  DataTableActionsCell,
} from '@/components/data-table/data-table-row-container';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import type { ImportProxyItem } from '../utils/import-export';
import { importProxyItems } from '../utils/import-export';

interface ProxyImportDrawerProps {
  open: boolean;
  items: ImportProxyItem[];
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

/**
 * 导入代理抽屉组件
 */
export function ProxyImportDrawer({
  open,
  items,
  onOpenChange,
  onComplete,
}: ProxyImportDrawerProps) {
  const { t } = useTranslation('proxy');

  const [submitting, setSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<number>>(new Set());
  const [testResults, setTestResults] = useState<Map<number, { status: 'healthy' | 'unreachable'; latency?: number }>>(new Map());

  // 统计
  // DataTable calls getRowKey(row) with a single argument, so derive a stable key
  // from each item's position in the full import list rather than a callback index.
  const rowIndexByItem = useMemo(
    () => new Map<ImportProxyItem, number>(items.map((item, index) => [item, index])),
    [items]
  );
  const validCount = useMemo(() => items.filter((item) => item.valid).length, [items]);
  const invalidCount = useMemo(() => items.filter((item) => !item.valid).length, [items]);

  // 分页
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(items.length / pageSize));
  }, [items.length, pageSize]);

  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  // 提交导入
  const handleSubmit = async () => {
    if (validCount === 0) {
      toast.warning('没有有效的代理数据可导入');
      return;
    }

    setSubmitting(true);
    try {
      const successCount = await importProxyItems(items);
      toast.success(`成功导入 ${successCount} 个代理`);
      onOpenChange(false);
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 选择/取消选择单个代理
  const handleSelect = (index: number, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  // 全选/取消全选
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(pagedItems.map((_, idx) => (currentPage - 1) * pageSize + idx)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 批量测试选中的代理
  const handleBatchTest = async () => {
    if (selectedIds.size === 0) {
      toast.warning('请先选择要测试的代理');
      return;
    }

    const selectedItems = Array.from(selectedIds).map(idx => items[idx]).filter(Boolean);
    
    for (const item of selectedItems) {
      const itemIndex = items.indexOf(item);
      if (itemIndex === -1 || !item.valid) continue;

      // 设置测试中状态
      setTestingIds(prev => new Set(prev).add(itemIndex));

      try {
        // TODO: 调用实际的代理测试 API
        // 这里暂时模拟测试结果
        await new Promise(resolve => setTimeout(resolve, 500));
        const isHealthy = Math.random() > 0.3;
        setTestResults(prev => new Map(prev).set(itemIndex, {
          status: isHealthy ? 'healthy' : 'unreachable',
          latency: isHealthy ? Math.floor(Math.random() * 500) + 50 : undefined,
        }));
      } catch (e) {
        setTestResults(prev => new Map(prev).set(itemIndex, { status: 'unreachable' }));
      } finally {
        // 移除测试中状态
        setTestingIds(prev => {
          const next = new Set(prev);
          next.delete(itemIndex);
          return next;
        });
      }
    }
  };

  // 计算当前页是否全选
  const isAllPageSelected = useMemo(() => {
    const pageIndices = pagedItems.map((_, idx) => (currentPage - 1) * pageSize + idx);
    return pageIndices.length > 0 && pageIndices.every(idx => selectedIds.has(idx));
  }, [pagedItems, currentPage, pageSize, selectedIds]);

  // 定义列配置
  const columns: ColumnDef<ImportProxyItem>[] = useMemo(
    () => [
      {
        id: 'checkbox',
        header: () => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllPageSelected}
              onCheckedChange={(value) => handleSelectAll(!!value)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4"
            />
          </div>
        ),
        width: 48,
        cell: ({ row, rowIndex }) => {
          const globalIndex = (currentPage - 1) * pageSize + rowIndex;
          return (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={selectedIds.has(globalIndex)}
                onCheckedChange={(value) => handleSelect(globalIndex, !!value)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
            </div>
          );
        },
      },
      {
        id: 'address',
        header: '地址',
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {row.host}:{row.port}
          </span>
        ),
      },
      {
        id: 'type',
        header: '类型',
        width: 80,
        cell: ({ row }) => (
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            {row.type || 'http'}
          </span>
        ),
      },
      {
        id: 'username',
        header: '用户名',
        width: 120,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate">{row.username || '-'}</span>
        ),
      },
      {
        id: 'status',
        header: '状态',
        width: 120,
        cell: ({ row, rowIndex }) => {
          const globalIndex = (currentPage - 1) * pageSize + rowIndex;
          const isTesting = testingIds.has(globalIndex);
          const testResult = testResults.get(globalIndex);

          // 正在测试
          if (isTesting) {
            return (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-xs text-muted-foreground">测试中...</span>
              </div>
            );
          }

          // 有测试结果
          if (testResult) {
            if (testResult.status === 'healthy') {
              return (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">
                    {testResult.latency ? `${testResult.latency}ms` : '正常'}
                  </span>
                </div>
              );
            } else {
              return (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-xs text-destructive font-medium">不可用</span>
                </div>
              );
            }
          }

          // 验证状态（未测试）
          if (row.valid) {
            return (
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-muted-foreground">有效</span>
              </div>
            );
          } else {
            return (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive">{row.error || '无效'}</span>
              </div>
            );
          }
        },
      },
    ],
    [currentPage, pageSize, selectedIds, isAllPageSelected, testingIds, testResults]
  );

  const renderPageItems = () => {
    const max = totalPages;
    const p = currentPage;
    const pages: (number | 'ellipsis')[] = [];
    if (max <= 7) {
      for (let i = 1; i <= max; i++) pages.push(i);
    } else {
      pages.push(1);
      const left = Math.max(2, p - 1);
      const right = Math.min(max - 1, p + 1);
      if (left > 2) pages.push('ellipsis');
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < max - 1) pages.push('ellipsis');
      pages.push(max);
    }

    return pages.map((it, idx) => {
      if (it === 'ellipsis') {
        return (
          <PaginationItem key={`e-${idx}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      const pageNum = it;
      return (
        <PaginationItem key={pageNum}>
          <PaginationLink
            href="#"
            isActive={pageNum === currentPage}
            size="sm"
            className="h-7 w-7 text-xs"
            onClick={(e) => {
              e.preventDefault();
              setPage(pageNum);
            }}
          >
            {pageNum}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };

  return (
    <Drawer
      open={open}
      direction="right"
      onOpenChange={(open) => {
        if (!open) {
          setPage(1);
        }
        onOpenChange(open);
      }}
    >
      <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[48vw] my-auto mr-4 rounded-md max-w-[900px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
        {/* 渐变头部 */}
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
          <DrawerHeader className="space-y-1 p-0">
            <DrawerTitle className="text-base font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" />
              {t('dialog.import.title', { defaultValue: '导入代理' })}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {t('dialog.import.drawerDescription', {
                defaultValue: '预览并确认要导入的代理数据',
              })}
            </DrawerDescription>
          </DrawerHeader>
        </div>

        {/* 内容区域 */}
        <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* 统计信息 */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  共 <span className="font-medium text-foreground">{items.length}</span> 条数据
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">
                  有效 <span className="font-medium text-emerald-600">{validCount}</span> 条
                </span>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">
                    无效 <span className="font-medium text-destructive">{invalidCount}</span> 条
                  </span>
                </div>
              )}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    已选 <span className="font-medium text-primary">{selectedIds.size}</span> 条
                  </span>
                </div>
              )}
            </div>
            {/* 批量检测按钮 */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchTest}
              disabled={selectedIds.size === 0 || testingIds.size > 0}
              className="h-7 text-xs"
            >
              <TestTube2 className="h-3.5 w-3.5 mr-1.5" />
              批量检测
            </Button>
          </div>

          {/* 表格区域 */}
          <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
            <DataTable
              data={pagedItems}
              columns={columns}
              getRowKey={(row) => `import-${rowIndexByItem.get(row) ?? -1}`}
              skeletonRows={pageSize}
              emptyText="没有数据"
              className="m-0 border-0 rounded-none flex-1 min-h-0 [&_td]:py-2 [&_th]:py-3 [&_tbody_tr:last-child]:border-b-0"
              tableClassName="min-w-full"
            />
          </div>

          {/* 分页：底部 */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                共 <span className="font-medium text-foreground">{items.length}</span> 条
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-[86px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} 条/页
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    aria-label="上一页"
                    aria-disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">上一页</span>
                  </PaginationLink>
                </PaginationItem>
                {renderPageItems()}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                    aria-label="下一页"
                    aria-disabled={currentPage === totalPages}
                  >
                    <span className="hidden sm:inline">下一页</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        {/* 底部操作栏 */}
        <DrawerFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2 flex-row items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            {t('dialog.import.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleSubmit}
            disabled={submitting || validCount === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('dialog.import.submitting', { defaultValue: '导入中...' })}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {t('dialog.import.submit', { defaultValue: '确认导入' })} ({validCount})
              </>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
