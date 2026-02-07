import React, { useState, useMemo, useCallback } from 'react';
import { ColorPicker } from '../common';
import { useUI, useUIActions } from '../../store';
import { colorRegistry, COLOR_CATEGORIES, getColorsByCategory } from '../../utils/colorRegistry';
import type { ColorCategory } from '../../utils/colorRegistry';
import styles from './ColorCustomizer.module.css';

export const ColorCustomizer: React.FC = () => {
  const { resolvedTheme, customColors } = useUI();
  const { setCustomColor, resetCustomColor, resetAllCustomColors } = useUIActions();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const categorizedColors = useMemo(() => getColorsByCategory(), []);
  const currentOverrides = customColors[resolvedTheme] || {};

  const customizedCount = Object.keys(currentOverrides).length;

  const toggleCategory = useCallback((category: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const getEffectiveColor = useCallback(
    (variable: string): string => {
      if (currentOverrides[variable]) return currentOverrides[variable];
      const entry = colorRegistry.find((e) => e.variable === variable);
      if (!entry) return '#000000';
      return resolvedTheme === 'dark' ? entry.defaultDark : entry.defaultLight;
    },
    [currentOverrides, resolvedTheme]
  );

  const getDefaultColor = useCallback(
    (variable: string): string => {
      const entry = colorRegistry.find((e) => e.variable === variable);
      if (!entry) return '#000000';
      return resolvedTheme === 'dark' ? entry.defaultDark : entry.defaultLight;
    },
    [resolvedTheme]
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {customizedCount > 0 && (
            <span className={styles.badge}>
              {customizedCount} customized
            </span>
          )}
        </div>
        {customizedCount > 0 && (
          <button className={styles.resetAllButton} onClick={resetAllCustomColors}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" />
            </svg>
            Reset All
          </button>
        )}
      </div>

      {COLOR_CATEGORIES.map((category: ColorCategory) => {
        const entries = categorizedColors.get(category);
        if (!entries || entries.length === 0) return null;
        const isOpen = openCategories.has(category);

        return (
          <div key={category} className={styles.category}>
            <button
              className={styles.categoryHeader}
              onClick={() => toggleCategory(category)}
            >
              <span>{category}</span>
              <svg
                className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isOpen && (
              <div className={styles.categoryGrid}>
                {entries.map((entry) => (
                  <div key={entry.variable} className={styles.colorItem}>
                    <span className={styles.colorLabel}>{entry.label}</span>
                    <ColorPicker
                      value={getEffectiveColor(entry.variable)}
                      defaultValue={getDefaultColor(entry.variable)}
                      onChange={(color) => setCustomColor(entry.variable, color)}
                      onReset={() => resetCustomColor(entry.variable)}
                      label={entry.label}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
