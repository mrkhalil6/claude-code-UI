import React from 'react';
import { Layout } from './components/layout';
import { SettingsPanel } from './components/settings';
import { useTheme } from './hooks/useTheme';
import { useCustomColors } from './hooks/useCustomColors';
import './styles/globals.css';

export const App: React.FC = () => {
  // Initialize theme system and listen for OS changes
  useTheme();
  // Apply custom color overrides after theme is set
  useCustomColors();

  return (
    <>
      <Layout />
      <SettingsPanel />
    </>
  );
};
