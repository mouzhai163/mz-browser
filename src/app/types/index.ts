import React from 'react';

/**
 * 路由配置类型
 */
export interface RouteConfig {
  path: string;
  Component: React.ComponentType;
  children?: RouteConfig[];
}
