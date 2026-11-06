import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ProxyBatchDeleteDialogProps {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 批量删除代理对话框组件
 */
export function ProxyBatchDeleteDialog({
  open,
  count,
  onOpenChange,
  onConfirm,
}: ProxyBatchDeleteDialogProps) {
  const { t } = useTranslation('proxy');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 p-3">
        <AlertDialogHeader className="mb-3">
          <AlertDialogTitle className="text-sm font-semibold mb-0 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t('dialog.batchDelete.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[10px] text-muted-foreground mt-0.5 mb-0">
            {t('dialog.batchDelete.description', { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert className="border-destructive/50 bg-destructive/10 mb-3 px-3 py-2">
          <AlertTriangle className="h-3 w-3 text-destructive" />
          <AlertTitle className="text-[10px] text-destructive">
            {t('dialog.batchDelete.warningTitle')}
          </AlertTitle>
          <AlertDescription className="text-[10px] text-destructive/90">
            {t('dialog.batchDelete.warningDescription')}
          </AlertDescription>
        </Alert>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel className="text-[10px] px-3 py-1.5 h-7">
            {t('dialog.batchDelete.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] px-3 py-1.5 h-7"
          >
            {t('dialog.batchDelete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
