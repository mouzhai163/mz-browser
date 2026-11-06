import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/theme-provider';

export const DecorativeCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  // 获取实际的主题（处理 system 模式）
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // 根据主题获取装饰颜色
  const getThemeColor = () => {
    const effectiveTheme = getEffectiveTheme();
    if (effectiveTheme === 'dark') {
      // 暗色模式：使用更亮的蓝色，提高可见度
      return {
        primary: '147, 197, 253', // 更亮的蓝色 (sky-300)，更突出
        opacity: {
          circle: { min: 0.25, max: 0.35 }, // 提高透明度使更明显
          line: { min: 0.15, max: 0.25 }, // 提高线条可见度
          dot: { min: 0.12, max: 0.18 }, // 提高点阵可见度
          curve: 0.2, // 提高曲线可见度
        },
      };
    } else {
      // 浅色模式：使用标准蓝色
      return {
        primary: '37, 99, 235', // 标准蓝色 (blue-600)
        opacity: {
          circle: { min: 0.17, max: 0.2 },
          line: { min: 0.06, max: 0.15 },
          dot: { min: 0.06, max: 0.08 },
          curve: 0.1,
        },
      };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      drawDecorations();
    };

    const drawDecorations = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const themeColor = getThemeColor();
      const { primary, opacity } = themeColor;

      ctx.clearRect(0, 0, width, height);

      // 绘制渐变圆形装饰
      const circles = [
        { x: width * 0.15, y: height * 0.2, radius: 120, opacity: opacity.circle.max },
        { x: width * 0.85, y: height * 0.3, radius: 160, opacity: opacity.circle.max * 0.9 },
        { x: width * 0.2, y: height * 0.7, radius: 140, opacity: opacity.circle.max * 0.95 },
        { x: width * 0.9, y: height * 0.8, radius: 130, opacity: opacity.circle.min },
      ];

      circles.forEach((circle) => {
        const gradient = ctx.createRadialGradient(
          circle.x,
          circle.y,
          0,
          circle.x,
          circle.y,
          circle.radius
        );
        gradient.addColorStop(0, `rgba(${primary}, ${circle.opacity})`);
        gradient.addColorStop(0.5, `rgba(${primary}, ${circle.opacity * 0.5})`);
        gradient.addColorStop(1, `rgba(${primary}, 0)`);

        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // 绘制线条装饰
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';

      // 对角线
      const lineGradient1 = ctx.createLinearGradient(
        width * 0.1,
        height * 0.1,
        width * 0.3,
        height * 0.3
      );
      lineGradient1.addColorStop(0, `rgba(${primary}, 0)`);
      lineGradient1.addColorStop(0.5, `rgba(${primary}, ${opacity.line.max})`);
      lineGradient1.addColorStop(1, `rgba(${primary}, 0)`);

      ctx.strokeStyle = lineGradient1;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, height * 0.1);
      ctx.lineTo(width * 0.3, height * 0.3);
      ctx.stroke();

      const lineGradient2 = ctx.createLinearGradient(
        width * 0.7,
        height * 0.1,
        width * 0.9,
        height * 0.3
      );
      lineGradient2.addColorStop(0, `rgba(${primary}, 0)`);
      lineGradient2.addColorStop(0.5, `rgba(${primary}, ${opacity.line.min})`);
      lineGradient2.addColorStop(1, `rgba(${primary}, 0)`);

      ctx.strokeStyle = lineGradient2;
      ctx.beginPath();
      ctx.moveTo(width * 0.7, height * 0.1);
      ctx.lineTo(width * 0.9, height * 0.3);
      ctx.stroke();

      const lineGradient3 = ctx.createLinearGradient(
        width * 0.1,
        height * 0.7,
        width * 0.3,
        height * 0.9
      );
      lineGradient3.addColorStop(0, `rgba(${primary}, 0)`);
      lineGradient3.addColorStop(0.5, `rgba(${primary}, ${opacity.line.min})`);
      lineGradient3.addColorStop(1, `rgba(${primary}, 0)`);

      ctx.strokeStyle = lineGradient3;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, height * 0.7);
      ctx.lineTo(width * 0.3, height * 0.9);
      ctx.stroke();

      const lineGradient4 = ctx.createLinearGradient(
        width * 0.7,
        height * 0.7,
        width * 0.9,
        height * 0.9
      );
      lineGradient4.addColorStop(0, `rgba(${primary}, 0)`);
      lineGradient4.addColorStop(0.5, `rgba(${primary}, ${opacity.line.min})`);
      lineGradient4.addColorStop(1, `rgba(${primary}, 0)`);

      ctx.strokeStyle = lineGradient4;
      ctx.beginPath();
      ctx.moveTo(width * 0.7, height * 0.7);
      ctx.lineTo(width * 0.9, height * 0.9);
      ctx.stroke();

      // 绘制点阵
      for (let x = width * 0.2; x < width * 0.8; x += 50) {
        for (let y = height * 0.3; y < height * 0.7; y += 50) {
          const size = 1.5 + Math.random() * 1.5;
          const dotOpacity = opacity.dot.min + Math.random() * (opacity.dot.max - opacity.dot.min);
          const dotGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
          dotGradient.addColorStop(0, `rgba(${primary}, ${dotOpacity})`);
          dotGradient.addColorStop(1, `rgba(${primary}, 0)`);

          ctx.fillStyle = dotGradient;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 添加曲线装饰
      ctx.strokeStyle = `rgba(${primary}, ${opacity.curve})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width * 0.05, height * 0.5);
      ctx.bezierCurveTo(
        width * 0.15,
        height * 0.3,
        width * 0.25,
        height * 0.4,
        width * 0.35,
        height * 0.5
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width * 0.65, height * 0.5);
      ctx.bezierCurveTo(
        width * 0.75,
        height * 0.6,
        width * 0.85,
        height * 0.5,
        width * 0.95,
        height * 0.5
      );
      ctx.stroke();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 监听系统主题变化（当 theme 为 'system' 时）
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        drawDecorations();
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none"
    />
  );
};
