import { useEffect, useRef } from 'react';
import { useUI } from '../store';
import type { ColorOverrides } from '../store/slices/ui.slice';

/** Convert a hex color (#rrggbb) to an "r, g, b" triplet string */
function hexToRgbTriplet(hex: string): string | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}`;
}

/**
 * CSS variables that have companion -rgb triplet variables.
 * When the user overrides the base color, we auto-derive the rgb triplet.
 */
const RGB_COMPANIONS: Record<string, string> = {
  'accent-primary': 'accent-primary-rgb',
  'accent-secondary': 'accent-secondary-rgb',
  'text-link': 'text-link-rgb',
  'text-warning': 'text-warning-rgb',
  'text-success': 'text-success-rgb',
  'text-error': 'text-error-rgb',
  'text-secondary': 'text-secondary-rgb',
};

/**
 * CSS variables that are derived as rgba() from a solid color variable.
 * Maps derived variable -> [source variable, opacity]
 */
const RGBA_DERIVED: Record<string, [string, number]> = {
  'diff-added-bg': ['diff-added-line', 0.12],
  'diff-added-gutter': ['diff-added-line', 0.3],
  'diff-removed-bg': ['diff-removed-line', 0.12],
  'diff-removed-gutter': ['diff-removed-line', 0.3],
};

export function useCustomColors() {
  const { resolvedTheme, customColors } = useUI();
  const prevAppliedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const el = document.documentElement;
    const overrides: ColorOverrides = customColors[resolvedTheme] || {};
    const newApplied = new Set<string>();

    // Remove previously applied overrides that are no longer present
    for (const prop of prevAppliedRef.current) {
      if (!(prop in overrides) && !Object.values(RGB_COMPANIONS).includes(prop) && !Object.keys(RGBA_DERIVED).includes(prop)) {
        el.style.removeProperty(`--${prop}`);
      }
    }

    // Apply overrides
    for (const [variable, color] of Object.entries(overrides)) {
      el.style.setProperty(`--${variable}`, color);
      newApplied.add(variable);

      // Auto-derive RGB companion
      if (RGB_COMPANIONS[variable]) {
        const triplet = hexToRgbTriplet(color);
        if (triplet) {
          const rgbVar = RGB_COMPANIONS[variable];
          el.style.setProperty(`--${rgbVar}`, triplet);
          newApplied.add(rgbVar);
        }
      }
    }

    // Auto-derive rgba-based variables from their source colors
    for (const [derivedVar, [sourceVar, opacity]] of Object.entries(RGBA_DERIVED)) {
      if (overrides[sourceVar]) {
        const triplet = hexToRgbTriplet(overrides[sourceVar]);
        if (triplet) {
          el.style.setProperty(`--${derivedVar}`, `rgba(${triplet}, ${opacity})`);
          newApplied.add(derivedVar);
        }
      } else {
        // Remove derived if source was cleared
        if (prevAppliedRef.current.has(derivedVar)) {
          el.style.removeProperty(`--${derivedVar}`);
        }
      }
    }

    // Clean up any previously applied vars that are no longer in the set
    for (const prop of prevAppliedRef.current) {
      if (!newApplied.has(prop)) {
        el.style.removeProperty(`--${prop}`);
      }
    }

    prevAppliedRef.current = newApplied;
  }, [resolvedTheme, customColors]);
}
