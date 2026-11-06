import { SyncerWindow } from './components/syncer-window';

// 页面组件
const SyncerPage: React.FC = () => {
  return <SyncerWindow />;
};

const syncerPlugin = {
  id: 'syncer',
  name: 'Syncer Window',
  version: '1.0.0',
  component: SyncerPage,
  slots: [],
};

export default syncerPlugin;
export { SyncerWindow };
