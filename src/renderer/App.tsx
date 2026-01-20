import React from 'react';
import { Layout } from './components/layout';
import { SettingsPanel } from './components/settings';
import './styles/globals.css';

export const App: React.FC = () => {
  return (
    <>
      <Layout />
      <SettingsPanel />
    </>
  );
};
