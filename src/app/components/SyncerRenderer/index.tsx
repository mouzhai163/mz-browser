import { PluginRenderer } from '../PluginRenderer';

export const SyncerRenderer: React.FC = () => {
  return (
    <PluginRenderer
      pluginId="syncer"
      fallback={
        <div className="flex items-center justify-center h-screen font-sans text-primary bg-background">
          加载同步器...
        </div>
      }
    />
  );
};
