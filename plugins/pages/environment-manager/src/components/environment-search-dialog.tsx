import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEnvironmentFiltersStore } from '../stores';

interface EnvironmentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnvironmentSearchDialog({ open, onOpenChange }: EnvironmentSearchDialogProps) {
  const filtersStore = useEnvironmentFiltersStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // 当对话框打开时，自动聚焦到搜索框
  useEffect(() => {
    if (open && inputRef.current) {
      // 使用 setTimeout 确保 DOM 已经渲染
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    filtersStore.setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
    } else if (e.key === 'Enter') {
      // 按 Enter 关闭对话框
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 p-0 overflow-hidden max-w-2xl border-0 shadow-2xl bg-background/95 backdrop-blur-2xl top-1/6"
        showCloseButton={false}
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="搜索环境名称、代理、账号..."
            value={filtersStore.searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className="pl-12 pr-4 h-16 text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
