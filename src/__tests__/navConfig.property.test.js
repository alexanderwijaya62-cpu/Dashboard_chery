import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getNavItems, getDefaultPage, NAV_CONFIG } from '../utils/navConfig.js';

/**
 * Feature: dashboard-redesign
 * Property 1: Role-based navigation returns valid item count and correct defaults
 *
 * For any valid role, getNavItems(role) returns 3–6 items and
 * getDefaultPage(role) returns a non-empty string matching a page in the config.
 *
 * **Validates: Requirements 2.2, 2.4, 3.2**
 */

const VALID_ROLES = ['admin', 'manager', 'cro', 'sparepart', 'owner', 'mekanik', 'customer'];

// Collect all valid page identifiers from the navigation configuration
const ALL_PAGES = new Set(
  Object.values(NAV_CONFIG).flatMap(items => items.map(item => item.page))
);

describe('Feature: dashboard-redesign, Property 1: Role-based navigation returns valid item count and correct defaults', () => {
  it('getNavItems(role) returns between 3 and 6 items for any valid role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_ROLES),
        (role) => {
          const items = getNavItems(role);
          expect(items.length).toBeGreaterThanOrEqual(3);
          expect(items.length).toBeLessThanOrEqual(6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getDefaultPage(role) returns a non-empty string for any valid role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_ROLES),
        (role) => {
          const defaultPage = getDefaultPage(role);
          expect(typeof defaultPage).toBe('string');
          expect(defaultPage.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getDefaultPage(role) returns a page that exists in the navigation config for any valid role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_ROLES),
        (role) => {
          const defaultPage = getDefaultPage(role);
          // The default page should match a page identifier known in the config
          const roleItems = getNavItems(role);
          const rolePages = roleItems.map(item => item.page);
          // Default page should be one of the pages available to that role
          // OR a valid page in the overall config
          expect(ALL_PAGES.has(defaultPage) || rolePages.includes(defaultPage)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: dashboard-redesign
 * Property 6: Navigation items have accessible labels
 *
 * For any valid role, every item returned by getNavItems(role) has a non-empty ariaLabel string.
 *
 * **Validates: Requirements 7.5**
 */
describe('Feature: dashboard-redesign, Property 6: Navigation items have accessible labels', () => {
  it('every navigation item has a non-empty ariaLabel string for any valid role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_ROLES),
        (role) => {
          const items = getNavItems(role);

          for (const item of items) {
            expect(item).toHaveProperty('ariaLabel');
            expect(typeof item.ariaLabel).toBe('string');
            expect(item.ariaLabel.trim().length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
