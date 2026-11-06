import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/theme-provider';

export const AppBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  // 获取实际的主题（处理 system 模式）
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const glowCanvas = glowCanvasRef.current;
    if (!canvas || !glowCanvas) return;

    const ctx = canvas.getContext('2d');
    const glowCtx = glowCanvas.getContext('2d');
    if (!ctx || !glowCtx) return;

    const drawBackground = () => {
      const effectiveTheme = getEffectiveTheme();
      const isDark = effectiveTheme === 'dark';

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // 设置背景 canvas
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 设置光晕 canvas
      glowCanvas.width = width * dpr;
      glowCanvas.height = height * dpr;
      glowCtx.scale(dpr, dpr);

      // 清除画布
      ctx.clearRect(0, 0, width, height);

      // 纯色背景 - 根据主题切换
      ctx.fillStyle = isDark ? '#0a0a0b' : '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 精致的网格纹理 - 统一透明度
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)';
      ctx.lineWidth = 0.5;
      const gridSize = 6;

      // 垂直线
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }

      // 水平线
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }

      // 点阵纹理 - 统一透明度
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.012)' : 'rgba(0, 0, 0, 0.012)';
      const dotSize = 0.8;
      const dotSpacing = 24;
      for (let x = 0; x <= width; x += dotSpacing) {
        for (let y = 0; y <= height; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 在光晕 canvas 上绘制光晕点（靠近四个角落）
      glowCtx.clearRect(0, 0, width, height);
      const glowPoints = [
        // 左下角
        {
          x: width * 0.1,
          y: height * 0.9,
          radius: Math.min(width, height) * 0.4,
          opacity: isDark ? 0.15 : 0.09,
        },
        // 右下角
        {
          x: width * 0.9,
          y: height * 0.9,
          radius: Math.min(width, height) * 0.4,
          opacity: isDark ? 0.15 : 0.09,
        },
      ];

      // 根据主题获取光晕颜色（参考登录界面的实现）
      const getGlowColor = () => {
        if (isDark) {
          // 深色模式：使用更亮的蓝色 (sky-300)
          return '147, 197, 253';
        } else {
          // 浅色模式：使用标准蓝色 (blue-600)
          return '37, 99, 235';
        }
      };

      const glowColor = getGlowColor();
      glowPoints.forEach((point) => {
        const gradient = glowCtx.createRadialGradient(
          point.x,
          point.y,
          0,
          point.x,
          point.y,
          point.radius
        );
        gradient.addColorStop(0, `rgba(${glowColor}, ${point.opacity})`);
        gradient.addColorStop(0.2, `rgba(${glowColor}, ${point.opacity * 0.7})`);
        gradient.addColorStop(0.5, `rgba(${glowColor}, ${point.opacity * 0.4})`);
        gradient.addColorStop(0.8, `rgba(${glowColor}, ${point.opacity * 0.15})`);
        gradient.addColorStop(1, `rgba(${glowColor}, 0)`);
        glowCtx.fillStyle = gradient;
        glowCtx.fillRect(0, 0, width, height);
      });

      // 添加微妙的噪点纹理 - 根据主题调整
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < 0.06) {
          const noise = (Math.random() - 0.5) * 2.5;
          data[i] = Math.min(255, Math.max(0, data[i] + noise));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
      }
      ctx.putImageData(imageData, 0, 0);
    };

    drawBackground();
    window.addEventListener('resize', drawBackground);

    // 监听系统主题变化（当 theme 为 'system' 时）
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        drawBackground();
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('resize', drawBackground);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: -10 }}>
      {/* 背景 canvas（网格、点阵、噪点） */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* 光晕 canvas（应用模糊） */}
      <canvas
        ref={glowCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ filter: 'blur(40px)' }}
      />
    </div>
  );
};
