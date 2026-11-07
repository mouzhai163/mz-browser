import { useMemo } from 'react';
import type { RouteObject } from 'react-router';
import { pluginRegistry } from '@slotkitjs/core';
import { useAppState } from '../../../plugins/services/store/src';
import type { RouteConfig } from '../types';

/**
 * 构建路由配置的 Hook
 *
 * 软件没有登录页：本地用户会话在启动时自动建立，打开软件就直接进入应用布局。
 */
export function useRouteConfig(routes: RouteConfig[]) {
  const { isAuthenticated } = useAppState();

  return useMemo(() => {
    const appLayoutPlugin = pluginRegistry.getPlugin('app-layout');
    const AppLayoutComponent = appLayoutPlugin?.component;

    if (!AppLayoutComponent) {
      return [
        {
          path: '*',
          element: (
            <div className="flex min-h-screen w-full overflow-hidden">
              <div className="flex-1 flex items-center justify-center">
                <p>Waiting for layout plugin...</p>
              </div>
            </div>
          ),
        },
      ];
    }

    // 本地会话由后端在启动时自动建立；走到这里说明它没能建立（数据库损坏等），给出明确提示。
    if (!isAuthenticated) {
      return [
        {
          path: '*',
          element: (
            <div className="flex min-h-screen w-full items-center justify-center text-muted-foreground">
              <p>无法初始化本地会话，请重启软件；如果仍然如此，请查看日志。</p>
            </div>
          ),
        },
      ];
    }

    if (routes.length === 0) {
      return [
        {
          path: '/',
          element: <AppLayoutComponent />,
          children: [
            {
              path: '*',
              element: (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p>等待路由配置...</p>
                  </div>
                </div>
              ),
            },
          ],
        },
      ];
    }

    const routeConfig: RouteObject[] = [
      {
        path: '/',
        element: <AppLayoutComponent />,
        children: routes.map((route) => {
          if (route.path === '/') {
            return {
              index: true,
              element: <route.Component />,
            };
          }
          return {
            path: route.path.replace(/^\//, ''),
            element: <route.Component />,
          };
        }),
      },
    ];

    return routeConfig;
  }, [routes, isAuthenticated]);
}
