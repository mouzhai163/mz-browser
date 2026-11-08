import { useMemo } from 'react';
import type { RouteObject } from 'react-router';
import { pluginRegistry } from '@slotkitjs/core';
import type { RouteConfig } from '../types';

/**
 * 构建路由配置的 Hook
 *
 * 软件没有登录页，打开就直接进入应用布局。
 */
export function useRouteConfig(routes: RouteConfig[]) {
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
  }, [routes]);
}
