import { useEffect } from 'react';
import { useMihomoRuntimeStore } from '../../stores/mihomo-runtime';

export function MihomoRuntimeSubscriber() {
  useEffect(() => {
    const { startPolling, stopPolling } = useMihomoRuntimeStore.getState();
    startPolling();

    return () => {
      stopPolling();
    };
  }, []);

  return null;
}
