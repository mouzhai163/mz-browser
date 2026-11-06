/* eslint-disable react-refresh/only-export-components */
export * from './api';
export * from './runtime';
export * from './running-envs-store';
export * from './types';

const environmentPlugin = {
  id: 'environment',
  name: 'Environment Service',
  version: '1.0.0',
  component: null,
  slots: [],
};

export default environmentPlugin;
