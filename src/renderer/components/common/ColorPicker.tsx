import React, { useRef, useCallback } from 'react';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: string;
  defaultValue: string;
  onChange: (color: string) => void;
  onReset: () => void;
  label: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  defaultValue,
  onChange,
  onReset,
  label,
}) => {
  const nativeRef = useRef<HTMLInputElement>(null);
  const isCustomized = value !== defaultValue;

  const handleSwatchClick = useCallback(() => {
    nativeRef.current?.click();
  }, []);

  const handleNativeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Accept partial input while typing, apply when valid
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        onChange(val);
      }
    },
    [onChange]
  );

  const handleHexBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
        // Revert to current value if invalid
        e.target.value = value;
      }
    },
    [value]
  );

  return (
    <div className={styles.container} title={label}>
      <div
        className={`${styles.swatch} ${isCustomized ? styles.customized : ''}`}
        style={{ backgroundColor: value }}
        onClick={handleSwatchClick}
        role="button"
        aria-label={`Pick color for ${label}`}
      />
      <input
        ref={nativeRef}
        type="color"
        className={styles.nativeInput}
        value={value}
        onChange={handleNativeChange}
        tabIndex={-1}
      />
      <input
        type="text"
        className={styles.hexInput}
        defaultValue={value}
        key={value} // Reset when value changes externally
        onChange={handleHexChange}
        onBlur={handleHexBlur}
        maxLength={7}
        spellCheck={false}
      />
      <button
        className={`${styles.resetButton} ${isCustomized ? styles.visible : ''}`}
        onClick={onReset}
        title="Reset to default"
        aria-label={`Reset ${label} to default`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};
