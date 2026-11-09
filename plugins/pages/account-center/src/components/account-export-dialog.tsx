import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ExportRange } from '../types';

interface AccountExportDialogProps {
  open: boolean;
  exportRange: ExportRange;
  allCount: number;
  selectedCount: number;
  filteredCount: number;
  onOpenChange: (open: boolean) => void;
  onExportRangeChange: (range: ExportRange) => void;
  onSubmit: () => void;
}

export function AccountExportDialog({
  open,
  exportRange,
  allCount,
  selectedCount,
  filteredCount,
  onOpenChange,
  onExportRangeChange,
  onSubmit,
}: AccountExportDialogProps) {
  const { t } = useTranslation('account');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialog.export.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs">{t('dialog.export.range')}</Label>
            <RadioGroup
              value={exportRange}
              onValueChange={(value) => onExportRangeChange(value as ExportRange)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="range-all" />
                <Label htmlFor="range-all" className="text-sm cursor-pointer">
                  {t('dialog.export.rangeAll')} ({allCount})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="selected"
                  id="range-selected"
                  disabled={selectedCount === 0}
                />
                <Label
                  htmlFor="range-selected"
                  className={`text-sm cursor-pointer ${selectedCount === 0 ? 'text-muted-foreground' : ''}`}
                >
                  {t('dialog.export.rangeSelected', { count: selectedCount })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="filtered" id="range-filtered" />
                <Label htmlFor="range-filtered" className="text-sm cursor-pointer">
                  {t('dialog.export.rangeFiltered', { count: filteredCount })}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dialog.export.cancel')}
          </Button>
          <Button onClick={onSubmit}>{t('dialog.export.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
