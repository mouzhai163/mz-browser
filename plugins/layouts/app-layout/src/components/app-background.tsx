/**
 * 应用背景：纯色页面底色（Ant Design 风格的浅灰 / 深色），
 * 不再绘制网格和光晕，卡片与表格直接坐在底色上。
 */
export const AppBackground: React.FC = () => {
  return <div className="pointer-events-none absolute inset-0 z-[-1] bg-page" aria-hidden />;
};
