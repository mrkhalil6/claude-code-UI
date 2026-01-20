import React from 'react';
import clsx from 'clsx';
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md'
}) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={clsx(
        styles.container,
        disabled && styles.disabled
      )}
      onClick={handleClick}
    >
      {label && <span className={styles.label}>{label}</span>}
      <div
        className={clsx(
          styles.toggle,
          styles[size],
          checked && styles.checked
        )}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.thumb} />
      </div>
    </div>
  );
};
