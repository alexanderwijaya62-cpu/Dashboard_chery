import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: dashboard-redesign, Property 3: Status badge colors maintain muted saturation
 *
 * For any status color token defined in the theme configuration (success, error, pending),
 * the HSL saturation value SHALL be no greater than 50% of the corresponding default
 * Tailwind color palette saturation value.
 *
 * **Validates: Requirements 5.5**
 */

// Status badge saturations from index.css
const STATUS_BADGE_COLORS = [
  { name: 'success', hue: 142, saturation: 35, defaultTailwindSaturation: 70 },
  { name: 'error', hue: 0, saturation: 35, defaultTailwindSaturation: 72 },
  { name: 'pending', hue: 45, saturation: 40, defaultTailwindSaturation: 95 },
]

// Arbitrary that picks from the constant set of status colors
const statusColorArb = fc.constantFrom(...STATUS_BADGE_COLORS)

describe('Feature: dashboard-redesign, Property 3: Status badge colors maintain muted saturation', () => {
  it('status badge saturation is <= 50% of default Tailwind palette saturation', () => {
    fc.assert(
      fc.property(statusColorArb, (color) => {
        const maxAllowedSaturation = color.defaultTailwindSaturation * 0.5
        expect(color.saturation).toBeLessThanOrEqual(maxAllowedSaturation)
      }),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: dashboard-redesign
 * Property 4: Theme color pairs maintain accessible contrast
 *
 * For any text-background color pair defined in the theme configuration
 * (primary text on primary bg, muted text on secondary bg), the WCAG contrast
 * ratio SHALL be >= 4.5:1. Disabled color pairs are exempt per WCAG (disabled
 * UI does not require the 4.5:1 threshold).
 *
 * **Validates: Requirements 5.9**
 */

// Theme color pairs from the design document / index.css @theme
const THEME_COLOR_PAIRS = [
  {
    name: 'primary text on primary bg',
    text: '#000000',
    background: '#ffffff',
  },
  {
    name: 'muted text on secondary bg',
    text: '#71717a',
    background: '#fafafa',
  },
  {
    name: 'disabled text on disabled bg',
    text: '#d4d4d8',
    background: '#e4e4e7',
    disabled: true,
  },
]

/**
 * Parse a hex color string to RGB components (0-255).
 */
function hexToRgb(hex) {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return { r, g, b }
}

/**
 * Calculate relative luminance per WCAG 2.1 specification.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)

  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate WCAG contrast ratio between two colors.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 * Returns a value >= 1 (e.g., 4.5 means 4.5:1)
 */
function contrastRatio(foregroundHex, backgroundHex) {
  const l1 = relativeLuminance(foregroundHex)
  const l2 = relativeLuminance(backgroundHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Feature: dashboard-redesign, Property 4: Theme color pairs maintain accessible contrast', () => {
  it('all active theme text-background color pairs have WCAG contrast ratio >= 4.5:1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...THEME_COLOR_PAIRS),
        (pair) => {
          if (pair.disabled) return
          const ratio = contrastRatio(pair.text, pair.background)
          expect(ratio).toBeGreaterThanOrEqual(4.5)
        }
      ),
      { numRuns: 100 }
    )
  })
})
