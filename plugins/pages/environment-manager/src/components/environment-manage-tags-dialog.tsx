import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tag, Search, Plus, X, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
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
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import type { TagItem } from '../types';
import { TagTableRow } from './tag-table-row';
import { EnvironmentEditTagDialog } from './environment-edit-tag-dialog';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';
import { getTagDotColorClasses } from '../utils';

interface EnvironmentManageTagsDialogProps {
  tags: TagItem[];
  onComplete?: () => void;
}

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string) => string;
}> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <Tag className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{t('dialog.manageTags.empty')}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {t('dialog.manageTags.emptyDescription')}
    </p>
  </div>
);

/**
 * 标签管理对话框组件
 * 参考代理中心的实现，使用 DataTable 显示标签列表
 */
export function EnvironmentManageTagsDialog({
  tags,
  onComplete,
}: EnvironmentManageTagsDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<{ uuid: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // 过滤标签
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((tag) => {
      const name = tag.name?.toLowerCase() || '';
      return name.includes(q);
    });
  }, [tags, searchQuery]);

  // 分页计算
  const totalPages = useMemo(() => {
    const total = filteredTags.length;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [filteredTags.length, pageSize]);

  const currentPage = Math.min(page, totalPages);

  const pagedTags = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTags.slice(start, start + pageSize);
  }, [filteredTags, currentPage, pageSize]);

  // 渲染分页项
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
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.preventDefault();
              setPage(pageNum);
            }}
            isActive={pageNum === currentPage}
          >
            {pageNum}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };

  // 定义列
  const columns: ColumnDef<TagItem>[] = [
    {
      id: 'name',
      header: t('dialog.manageTags.table.name'),
      cell: () => null,
      width: 300,
    },
    {
      id: 'environmentsCount',
      header: t('dialog.manageTags.table.environmentsCount'),
      cell: () => null,
      width: 120,
    },
    {
      id: 'actions',
      header: t('dialog.manageTags.table.actions'),
      cell: () => null,
      width: 112,
    },
  ];

  const handleDeleteClick = (id: string, name: string) => {
    setDeletingTag({ uuid: id, name });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    setDeleting(true);
    try {
      await operations.deleteTag(deletingTag.uuid);
      setDeleteDialogOpen(false);
      setDeletingTag(null);
      toast.success(t('dialog.manageTags.deleteSuccess'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.manageTags.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (tag: TagItem) => {
    dialogStore.openEditTagDialog({
      uuid: tag.uuid,
      name: tag.name,
      color: tag.color,
    });
  };

  return (
    <>
      <Drawer
        open={dialogStore.manageTagsDialogOpen}
        direction="right"
        onOpenChange={(open) => {
          dialogStore.setManageTagsDialogOpen(open);
          if (!open) {
            setSearchQuery('');
            setSelectedIds(new Set());
            setPage(1);
          }
        }}
      >
        <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[48vw] my-auto mr-4 rounded-md max-w-[1100px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
          {/* 渐变头部 */}
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
            <DrawerHeader className="space-y-1 p-0">
              <DrawerTitle className="text-base font-semibold flex items-center gap-2">
                <Tag className="h-5 w-5 text-blue-500" />
                {t('dialog.manageTags.title')}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {t('dialog.manageTags.description')}
              </DrawerDescription>
            </DrawerHeader>
          </div>

          {/* 内容区域 */}
          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* 工具栏：搜索 + 新建标签 */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative group w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <TextareaInput
                  placeholder={t('dialog.manageTags.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-8 text-sm min-h-9 bg-muted/30 border-border/50 rounded-lg focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-dashed hover:border-primary/50 hover:bg-primary/5"
                onClick={() => dialogStore.openCreateTagDialog()}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t('dialog.manageTags.createTag')}
              </Button>
            </div>

            {/* 表格区域 */}
            {tags.length === 0 ? (
              <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center">
                <EmptyState t={t} />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-blue-500/60" />
                  </div>
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {t('dialog.manageTags.noMatch')}
                  </h4>
                  <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                    {t('dialog.manageTags.noMatchDescription')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
                <DataTable
                  data={pagedTags}
                  columns={columns}
                  getRowKey={(tag) => tag.uuid}
                  loading={false}
                  skeletonRows={pageSize}
                  emptyText=""
                  selectable
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
                    <TagTableRow
                      key={rowKey}
                      tag={row}
                      isSelected={isSelected}
                      onSelect={(id, selected) => handleSelect(selected)}
                      onEdit={handleEdit}
                      onDelete={handleDeleteClick}
                    />
                  )}
                  className="m-0 border-0 rounded-none flex-1 min-h-0 [&_td]:py-2 [&_th]:py-3 [&_tbody_tr:last-child]:border-b-0 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_td:first-child]:border-b-0"
                  tableClassName="min-w-full"
                />

                {/* 分页：底部 */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {t('dialog.manageTags.total')}{' '}
                      <span className="font-medium text-foreground">{filteredTags.length}</span>{' '}
                      {t('dialog.manageTags.items')}
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
                            {n} {t('dialog.manageTags.itemsPerPage')}
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
                          aria-label={t('dialog.manageTags.previous')}
                          aria-disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">
                            {t('dialog.manageTags.previous')}
                          </span>
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
                          aria-label={t('dialog.manageTags.next')}
                          aria-disabled={currentPage === totalPages}
                        >
                          <span className="hidden sm:inline">{t('dialog.manageTags.next')}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </PaginationLink>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* 删除确认对话框 */}
      <FormattedDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        minWidth="min-w-[440px]"
        header={{
          icon: Trash2,
          iconColor: 'text-destructive',
          title: t('dialog.manageTags.deleteTitle'),
          description: deletingTag
            ? t('dialog.manageTags.deleteDescription', { name: deletingTag.name })
            : undefined,
          gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
          className: 'border-b border-destructive/20',
        }}
        contentPadding="p-5"
      >
        {/* 标签信息卡片 */}
        {deletingTag && (
          <div className="bg-muted/50 rounded-md p-3 border border-border/50">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded border shrink-0 ${getTagDotColorClasses(
                  tags.find((t) => t.uuid === deletingTag.uuid)?.color || 'blue'
                )}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{deletingTag.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('dialog.manageTags.tagInfo')}
                </p>
              </div>
            </div>
          </div>
        )}

        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('dialog.manageTags.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {t('dialog.manageTags.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t('dialog.manageTags.confirm')}
              </>
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 编辑标签对话框 */}
      <EnvironmentEditTagDialog onComplete={onComplete} />
    </>
  );
}
