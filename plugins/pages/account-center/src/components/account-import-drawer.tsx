import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  Check,
  X,
  AlertCircle,
  User,
  ChevronLeft,
  ChevronRight,
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
import type { ImportAccountItem } from '../utils/import-export';
import { importAccountItems } from '../utils/import-export';

interface AccountImportDrawerProps {
  open: boolean;
  items: ImportAccountItem[];
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

/**
 * 导入账号抽屉组件
 */
export function AccountImportDrawer({
  open,
  items,
  onOpenChange,
  onComplete,
}: AccountImportDrawerProps) {
  const { t } = useTranslation('account');

  const [submitting, setSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // 统计
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
      toast.warning('没有有效的账号数据可导入');
      return;
    }

    setSubmitting(true);
    try {
      const successCount = await importAccountItems(items);
      toast.success(`成功导入 ${successCount} 个账号`);
      onOpenChange(false);
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 定义列配置
  const columns: ColumnDef<ImportAccountItem>[] = useMemo(
    () => [
      {
        id: 'status',
        header: '状态',
        width: 64,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.valid ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-3 w-3 text-emerald-500" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center">
                <AlertCircle className="h-3 w-3 text-destructive" />
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'platform',
        header: '平台',
        cell: ({ row }) => <span className="text-sm truncate">{row.platform || '-'}</span>,
      },
      {
        id: 'account',
        header: '账号',
        cell: ({ row }) => (
          <span className="text-sm font-medium truncate">{row.account || '-'}</span>
        ),
      },
      {
        id: 'password',
        header: '密码',
        width: 120,
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {row.password ? '••••••••' : '-'}
          </span>
        ),
      },
      {
        id: 'remark',
        header: '备注',
        width: 120,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate">{row.remark || '-'}</span>
        ),
      },
      {
        id: 'error',
        header: '错误',
        width: 120,
        cell: ({ row }) =>
          row.error ? <span className="text-xs text-destructive truncate">{row.error}</span> : null,
      },
    ],
    []
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
              {t('dialog.import.drawerTitle', { defaultValue: '导入账号' })}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {t('dialog.import.drawerDescription', {
                defaultValue: '预览并确认要导入的账号数据',
              })}
            </DrawerDescription>
          </DrawerHeader>
        </div>

        {/* 内容区域 */}
        <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* 统计信息 */}
          <div className="flex items-center gap-4 px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
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
          </div>

          {/* 表格区域 */}
          <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
            <DataTable
              data={pagedItems}
              columns={columns}
              getRowKey={(_, index) => `import-${index}`}
              skeletonRows={pageSize}
              emptyText="没有数据"
              className="m-0 border-0 rounded-none flex-1 min-h-0 [&_td]:py-2 [&_th]:py-3 [&_tbody_tr:last-child]:border-b-0"
              tableClassName="min-w-full"
            />
          </div>

          {/* 分页 */}
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
