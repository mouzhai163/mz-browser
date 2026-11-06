import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
}

interface Segment {
  min: number;
  max: number;
  label: string;
}

const segments: Segment[] = [
  { min: 1, max: 3, label: '1-3' }, // 3个值
  { min: 4, max: 8, label: '4-8' }, // 5个值
  { min: 9, max: 15, label: '9-15' }, // 7个值
  { min: 16, max: 25, label: '16-25' }, // 10个值
];

const MIN_VALUE = 1;
const MAX_VALUE = 25;

// 计算每段的高度比例（基于包含的数量）
const getSegmentHeight = (segment: Segment): string => {
  const count = segment.max - segment.min + 1;
  // 总数量：3 + 5 + 7 + 10 = 25
  // 高度比例：3/25, 5/25, 7/25, 10/25（阶梯式增长）
  const totalCount = 25;
  const percentage = (count / totalCount) * 100;
  return `${percentage}%`;
};

/**
 * 可拖拽的数量选择器组件
 * 保持分段显示，但支持拖拽精确选择 1-25 之间的任意数字
 */
export function QuantitySelector({ value, onChange }: QuantitySelectorProps) {
  const { t } = useTranslation('create-window');
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragStartValueRef = useRef<number>(value); // 拖拽开始时的值，用于锁定颜色
  const rafRef = useRef<number | null>(null);

  // 确定当前值属于哪个段
  const getSegmentIndex = (val: number): number => {
    for (let i = 0; i < segments.length; i++) {
      if (val >= segments[i].min && val <= segments[i].max) {
        return i;
      }
    }
    return segments.length - 1;
  };

  // 将值转换为百分比位置（从顶部开始，顶部是1，底部是25）
  const valueToPercent = (val: number): number => {
    return ((val - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * 100;
  };

  // 将百分比位置转换为值
  const percentToValue = (percent: number): number => {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const rawValue = MIN_VALUE + (clampedPercent / 100) * (MAX_VALUE - MIN_VALUE);
    return Math.round(rawValue);
  };

  // 使用 ref 存储最新的 onChange，避免闭包问题
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 处理鼠标/触摸事件 - 使用 requestAnimationFrame 节流，直接操作 DOM
  const handlePointerMove = useCallback((clientY: number) => {
    if (!sliderRef.current || !handleRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const percent = (y / rect.height) * 100; // 从顶部开始计算，顶部是0%，底部是100%
    const newValue = percentToValue(percent);

    // 取消之前的动画帧
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // 使用 requestAnimationFrame 节流更新
    rafRef.current = requestAnimationFrame(() => {
      if (!handleRef.current) return;

      // 直接操作 DOM 更新手柄位置，避免 React 重新渲染
      handleRef.current.style.top = `${percent}%`;

      // 更新值，但不触发段的重新渲染
      onChangeRef.current(newValue);
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStartValueRef.current = value; // 锁定拖拽开始时的值
    setIsDragging(true);
    handlePointerMove(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMoveGlobal = (e: PointerEvent) => {
      e.preventDefault();
      handlePointerMove(e.clientY);
    };

    const handlePointerUp = (e: PointerEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };

    document.addEventListener('pointermove', handlePointerMoveGlobal, { passive: false });
    document.addEventListener('pointerup', handlePointerUp, { passive: false });

    return () => {
      document.removeEventListener('pointermove', handlePointerMoveGlobal);
      document.removeEventListener('pointerup', handlePointerUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, handlePointerMove]);

  // 计算当前值在段内的相对位置（0-1）
  const getValueInSegmentProgress = (val: number, segmentIndex: number): number => {
    const segment = segments[segmentIndex];
    if (val < segment.min) return 0;
    if (val > segment.max) return 1;
    // 计算值在段内的位置：例如值2在段1-3中，位置是 (2-1)/(3-1) = 1/2 = 0.5
    return (val - segment.min) / (segment.max - segment.min);
  };

  // 拖拽时使用拖拽开始时的值来锁定颜色，避免颜色变化
  // 非拖拽时使用当前值
  const valueForColor = isDragging ? dragStartValueRef.current : value;
  const currentSegmentIndex = getSegmentIndex(value);
  const currentPercent = valueToPercent(value);

  // 同步手柄位置到实际值（拖拽时由 DOM 直接更新，这里只是初始化和非拖拽时的同步）
  useEffect(() => {
    if (!isDragging && handleRef.current) {
      handleRef.current.style.top = `${currentPercent}%`;
    }
  }, [currentPercent, isDragging]);

  // 计算每个段在整体渐变中的起始位置百分比
  const getSegmentStartPercent = (segmentIndex: number): number => {
    let startPercent = 0;
    for (let i = 0; i < segmentIndex; i++) {
      const count = segments[i].max - segments[i].min + 1;
      startPercent += (count / 25) * 100;
    }
    return startPercent;
  };

  return (
    <div
      ref={sliderRef}
      className="relative flex flex-col gap-0.5 select-none overflow-visible"
      style={{
        width: '12px',
        height: '350px',
        minWidth: '12px',
        maxWidth: '12px',
      }}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {segments.map((segment, index) => {
        const segmentHeight = getSegmentHeight(segment);
        const startPercent = getSegmentStartPercent(index);
        const segmentCount = segment.max - segment.min + 1;
        const endPercent = startPercent + (segmentCount / 25) * 100;

        // 判断段的激活状态
        const isBeforeCurrent = index < currentSegmentIndex; // 前面的段，完全高亮
        const isCurrentSegment = index === currentSegmentIndex; // 当前段，部分高亮
        const isAfterCurrent = index > currentSegmentIndex; // 后面的段，不高亮

        // 计算当前段的高亮比例（0-1）
        const highlightProgress = isCurrentSegment
          ? getValueInSegmentProgress(valueForColor, index)
          : isBeforeCurrent
            ? 1
            : 0;

        // 计算该段在渐变中的颜色
        const getSegmentGradient = () => {
          // 根据段的位置计算渐变颜色，使用主题 primary 颜色（深蓝色）
          // 使用主题 primary 颜色 #2563eb (rgb(37, 99, 235))，从 0.5 到 1.0 透明度，增大跨度增强对比
          const startOpacity = 0.5 + (startPercent / 100) * 0.5;
          const endOpacity = 0.5 + (endPercent / 100) * 0.5;
          const startColor = `rgba(37, 99, 235, ${startOpacity})`; // primary color
          const endColor = `rgba(37, 99, 235, ${endOpacity})`; // primary color
          return `linear-gradient(to bottom, ${startColor}, ${endColor})`;
        };

        // 亮灰色渐变背景（根据段位置计算不同深浅）
        const getGrayGradient = () => {
          // 从亮灰色 #f3f4f6 过渡到稍深的灰色 #e5e7eb
          const startLightness = 245 - (startPercent / 100) * 20; // 245 -> 225
          const endLightness = 245 - (endPercent / 100) * 20;
          const startColor = `rgb(${startLightness}, ${startLightness + 1}, ${startLightness + 3})`;
          const endColor = `rgb(${endLightness}, ${endLightness + 1}, ${endLightness + 3})`;
          return `linear-gradient(to bottom, ${startColor}, ${endColor})`;
        };

        return (
          <div
            key={index}
            data-segment
            style={{
              flex: `0 0 ${segmentHeight}`,
              height: segmentHeight,
              minWidth: 0,
              maxWidth: '12px',
              background: getGrayGradient(),
              border: '1px solid transparent',
              borderRadius: '9999px',
              cursor: isDragging ? 'grabbing' : 'grab',
              position: 'relative',
              overflow: 'hidden',
            }}
            className="relative w-full flex items-center justify-center"
            title={`${segment.min}-${segment.max} 个窗口`}
          >
            {/* 高亮部分 - 使用 height 只显示部分，从上到下，保持圆角 */}
            {highlightProgress > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${highlightProgress * 100}%`,
                  background: getSegmentGradient(),
                  borderRadius: '9999px',
                  // 如果未完全填充，添加底部圆角遮罩
                  ...(highlightProgress < 1 && {
                    borderBottomLeftRadius: '9999px',
                    borderBottomRightRadius: '9999px',
                  }),
                }}
              />
            )}
          </div>
        );
      })}

      {/* 滑块手柄 - 显示当前值的位置，拖拽时直接操作 DOM，只有悬停或拖拽时显示 */}
      <div
        ref={handleRef}
        className="absolute rounded-full bg-white border-2 border-primary shadow-lg z-20 pointer-events-none"
        style={{
          width: '12px',
          height: '12px',
          left: '0',
          top: `${currentPercent}%`,
          transform: 'translateY(-50%)',
          willChange: isDragging ? 'top' : 'auto',
          transition: isDragging ? 'none' : 'top 0.15s ease-out, opacity 0.2s ease-out',
          opacity: isHovering || isDragging ? 1 : 0,
        }}
      />
    </div>
  );
}
