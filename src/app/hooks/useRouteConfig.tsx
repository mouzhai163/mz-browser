import { useMemo } from 'react';
import { Navigate } from 'react-router';
import type { RouteObject } from 'react-router';
import { pluginRegistry } from '@slotkitjs/core';
import { useAppState } from '../../../plugins/services/store/src';
import type { RouteConfig } from '../types';

/**
 * 构建路由配置的 Hook
 */
export function useRouteConfig(routes: RouteConfig[]) {
  const { isAuthenticated } = useAppState();

  return useMemo(() => {
    const appLayoutPlugin = pluginRegistry.getPlugin('app-layout');
    const authLayoutPlugin = pluginRegistry.getPlugin('authorization-layout');
    const AppLayoutComponent = appLayoutPlugin?.component;
    const AuthLayoutComponent = authLayoutPlugin?.component;

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

    // 分离认证路由和其他路由
    const authRoutes = routes.filter((route) => route.path.startsWith('/auth'));
    const otherRoutes = routes.filter((route) => !route.path.startsWith('/auth'));

    const routeConfig: RouteObject[] = [];

    // 添加认证布局路由
    if (authRoutes.length > 0 && AuthLayoutComponent) {
      // 如果已登录，认证路由应该重定向到首页
      if (isAuthenticated) {
        routeConfig.push({
          path: '/auth',
          element: <Navigate to="/" replace />,
        });
        routeConfig.push({
          path: '/auth/*',
          element: <Navigate to="/" replace />,
        });
      } else {
        const authChildren = authRoutes.map((route) => {
          const childPath = route.path.replace(/^\/auth/, '') || '';
          const normalizedPath = childPath.replace(/^\//, '') || 'login';
          return {
            path: normalizedPath,
            element: <route.Component />,
          };
        });

        // 找到登录页面作为默认路由
        const loginRoute = authChildren.find((c) => c.path === 'login');

        routeConfig.push({
          path: '/auth',
          element: <AuthLayoutComponent />,
          children: [
            ...(loginRoute
              ? [
                  {
                    index: true,
                    element: loginRoute.element,
                  },
                ]
              : []),
            ...authChildren,
          ],
        });
      }
    }

    // 添加应用布局路由（需要登录）
    if (otherRoutes.length > 0) {
      // 如果未登录，所有应用路由都重定向到登录页
      if (!isAuthenticated) {
        routeConfig.push({
          path: '/',
          element: <Navigate to="/auth/login" replace />,
        });
        // 添加通配符路由，确保所有未匹配的路由都重定向到登录页
        routeConfig.push({
          path: '*',
          element: <Navigate to="/auth/login" replace />,
        });
      } else {
        // 已登录，正常添加应用布局路由
        routeConfig.push({
          path: '/',
          element: <AppLayoutComponent />,
          children: otherRoutes.map((route) => {
            if (route.path === '/') {
              return {
                index: true,
                element: <route.Component />,
              };
            } else {
              const childPath = route.path.replace(/^\//, '');
              return {
                path: childPath,
                element: <route.Component />,
              };
            }
          }),
        });
      }
    } else if (!isAuthenticated) {
      // 如果没有应用路由且未登录，添加默认重定向
      routeConfig.push({
        path: '*',
        element: <Navigate to="/auth/login" replace />,
      });
    }

    return routeConfig;
  }, [routes, isAuthenticated]);
}
