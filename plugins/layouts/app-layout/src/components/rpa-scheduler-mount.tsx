import { useEffect } from 'react';
import { startRpaMcpBridge } from '../../../../pages/rpa-workflow/src/runtime/mcp-bridge';
import { startRpaScheduler } from '../../../../pages/rpa-workflow/src/runtime/scheduler';

/** 在应用布局里启动 RPA 定时调度，不依赖用户是否打开过任务页面 */
export function RpaSchedulerMount() {
  useEffect(() => {
    startRpaScheduler();
    startRpaMcpBridge();
  }, []);
  return null;
}
