import { useEffect, useState } from 'react';
import { pluginRegistry } from '@slotkitjs/core';

interface PluginRendererProps {
  pluginId: string;
  fallback?: React.ReactNode;
  autoSubscribe?: boolean;
}

export const PluginRenderer: React.FC<PluginRendererProps> = ({
  pluginId,
  fallback = null,
  autoSubscribe = true,
}) => {
  const [plugin, setPlugin] = useState(() => pluginRegistry.getPlugin(pluginId));

  useEffect(() => {
    if (!autoSubscribe) {
      // 使用函数式更新避免在 effect 中直接调用 setState
      setPlugin(() => pluginRegistry.getPlugin(pluginId));
      return;
    }

    const currentPlugin = pluginRegistry.getPlugin(pluginId);
    if (currentPlugin) {
      // 使用函数式更新避免在 effect 中直接调用 setState
      setPlugin(() => currentPlugin);
    }

    const unsubscribe = pluginRegistry.subscribe((event) => {
      if (event.type === 'register' && event.plugin?.id === pluginId) {
        console.log(`[PluginRenderer] Plugin "${pluginId}" registered, updating render`);
        setPlugin(event.plugin);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pluginId, autoSubscribe]);

  const PluginComponent = plugin?.component;

  if (!PluginComponent) {
    return <>{fallback}</>;
  }

  return <PluginComponent />;
};
