import { useTranslation } from 'react-i18next';

/**
 * 默认品牌区域组件
 */
export function DefaultBrandSlot() {
  const { t } = useTranslation('appLayout');

  return (
    <div className="flex items-center gap-3 px-5 border-r border-border/80 h-full">
      <img src="/assets/logo.png" alt="Simprint Logo" className="w-7 h-7 object-contain" />
      <p className="text-xs font-semibold text-foreground tracking-tight">
        Simprint
      </p>
    </div>
  );
}
