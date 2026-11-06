import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
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

interface RpaDeleteDialogProps {
  open: boolean;
  task: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * RPA 任务删除确认对话框
 */
export const RpaDeleteDialog: React.FC<RpaDeleteDialogProps> = ({
  open,
  task,
  onOpenChange,
  onConfirm,
}) => {
  const { t } = useTranslation('rpa');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 p-3">
        <AlertDialogHeader className="mb-3">
          <AlertDialogTitle className="text-sm font-semibold mb-0 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t('dialog.delete.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[10px] text-muted-foreground mt-0.5 mb-0">
            {task && t('dialog.delete.description', { name: task.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert className="border-destructive/50 bg-destructive/10 mb-3 px-3 py-2">
          <AlertTriangle className="h-3 w-3 text-destructive" />
          <AlertTitle className="text-[10px] text-destructive">
            {t('dialog.delete.title')}
          </AlertTitle>
          <AlertDescription className="text-[10px] text-destructive/90">
            {t('dialog.delete.warning')}
          </AlertDescription>
        </Alert>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            className="text-[10px] px-3 py-1.5 h-7"
          >
            {t('dialog.delete.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] px-3 py-1.5 h-7"
          >
            {t('dialog.delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
