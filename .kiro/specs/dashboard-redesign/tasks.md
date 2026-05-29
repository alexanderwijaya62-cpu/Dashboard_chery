# Implementation Plan: Dashboard Redesign

## Overview

This plan implements the Chery Dashboard redesign in incremental steps: first establishing the theme and navigation infrastructure, then applying responsive layouts and component modifications, and finally wiring everything together. Each task builds on previous work to ensure no orphaned code.

## Tasks

- [x] 1. Set up theme system and navigation configuration
  - [x] 1.1 Update `src/index.css` with black-and-white theme CSS variables
    - Replace the current `@theme` block with the new color tokens (primary, bg, bg-secondary, border, text, text-muted, disabled-text, disabled-bg)
    - Remove the `--color-primary: #ef4444` red theme
    - Update `:root` CSS variables to match the new black-and-white palette
    - Add utility classes for status badge muted colors (success, error, pending with ≤50% saturation)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 1.2 Create `src/utils/navConfig.js` with role-based navigation mapping
    - Export `NAV_CONFIG` object mapping each role (admin, manager, cro, sparepart, owner, mekanik, customer) to 3–6 navigation items
    - Each item includes: `id`, `icon` (from lucide-react), `label`, `page`, `ariaLabel`
    - Export `getNavItems(role)` function that returns the items array for a given role
    - Export `getDefaultPage(role)` function that returns the default page string for a role
    - Export `DEFAULT_PAGES` mapping object
    - _Requirements: 2.2, 2.4, 7.5_

  - [x] 1.3 Create `src/components/LogoutButton.jsx` component
    - Accept props: `onLogout`, `variant` ('navbar' | 'bottomnav')
    - Render the `LogOut` icon from lucide-react with consistent size and black color
    - In 'navbar' variant: show icon + "Logout" label
    - In 'bottomnav' variant: show icon only with `aria-label="Logout"`
    - Apply `min-w-[44px] min-h-[44px]` tap target
    - Style with black icon, `hover:bg-zinc-200` transition
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 2. Implement navigation bar components
  - [x] 2.1 Create `src/components/BottomNavBar.jsx` component
    - Accept props: `user`, `currentPage`, `onNavigate`, `onLogout`
    - Render a fixed bar at the bottom with `max-h-[64px]`, `flex md:hidden`
    - Use `getNavItems(user.role)` to display icon-only navigation items
    - Highlight active route icon with visually differentiated style (filled variant or contrasting background)
    - Include `LogoutButton` with variant='bottomnav' as the last item
    - Each icon has `aria-label` from navConfig and minimum 44×44px tap target
    - Distribute icons with equal horizontal spacing, min 8px edge padding
    - Hide when `user` is null (login/public pages)
    - Prevent navigation event when tapping the already-active route icon
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 4.3, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.2 Create `src/components/DesktopNavBar.jsx` component
    - Accept props: `user`, `currentPage`, `onNavigate`, `onLogout`
    - Render a fixed/sticky bar at the top with `hidden md:flex`
    - Persistently visible — no auto-hide, no scroll-based hiding, no hover triggers
    - Use `getNavItems(user.role)` to display navigation items with labels
    - Include `LogoutButton` with variant='navbar'
    - Apply black-and-white theme styling (white bg, black text, zinc borders)
    - Hide when `user` is null (login/public pages)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2_

  - [x] 2.3 Write property test for navigation configuration (Property 1)
    - **Property 1: Role-based navigation returns valid item count and correct defaults**
    - For any valid role, `getNavItems(role)` returns 3–6 items and `getDefaultPage(role)` returns a non-empty string matching a page in the config
    - Set up Vitest + fast-check if not already configured
    - **Validates: Requirements 2.2, 2.4, 3.2**

  - [x] 2.4 Write property test for accessible navigation labels (Property 6)
    - **Property 6: Navigation items have accessible labels**
    - For any valid role, every item returned by `getNavItems(role)` has a non-empty `ariaLabel` string
    - **Validates: Requirements 7.5**

- [x] 3. Refactor App.jsx to use new navigation system
  - [x] 3.1 Remove old navbar auto-hide logic from `src/App.jsx`
    - Remove `isNavbarVisible`, `isAtTop`, `navbarTimerRef`, `resetNavbarTimer` state and effects
    - Remove the scroll-based navbar hiding `useEffect`
    - Remove the `useEffect` that calls `resetNavbarTimer`
    - Keep all other state and logic intact
    - _Requirements: 3.1, 3.5_

  - [x] 3.2 Integrate `DesktopNavBar` and `BottomNavBar` into `src/App.jsx`
    - Import and render `<DesktopNavBar>` and `<BottomNavBar>` conditionally based on `user` auth state
    - Pass `user`, `currentPage`, `onNavigate={setCurrentPage}`, `onLogout={handleLogout}` props
    - Hide both navbars on login page, DisplayBoard, and public pages without auth
    - Add `pb-[72px] md:pb-0` to the main content wrapper for bottom nav clearance on mobile
    - _Requirements: 2.1, 2.6, 2.7, 3.3, 3.4, 4.6_

  - [x] 3.3 Write property test for logout state clearing (Property 2)
    - **Property 2: Logout clears all session state**
    - For any authenticated user state, invoking logout results in localStorage keys removed, currentPage set to 'login', and Supabase update called
    - **Validates: Requirements 4.4**

- [x] 4. Checkpoint - Ensure navigation works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Apply black-and-white theme to page components
  - [x] 5.1 Update `src/components/AdminPanel.jsx` with black-and-white theme
    - Replace colored gradient backgrounds with `bg-white` or `bg-zinc-50`
    - Replace colored buttons with `bg-black text-white` or `border border-black text-black`
    - Apply `hover:bg-zinc-200` transitions on interactive elements
    - Ensure text uses `text-black` and minimum `text-sm` (14px) on mobile
    - Preserve functional status badge colors with muted tones
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 5.2 Update `src/components/ManagerPanel.jsx` with black-and-white theme
    - Same theme changes as AdminPanel: remove gradients, apply black/white/zinc styling
    - Ensure interactive elements have `hover:bg-zinc-200` or inverted fill transitions
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.3 Update `src/components/MechanicPanel.jsx` with black-and-white theme
    - Remove colored backgrounds, apply white/zinc-50 backgrounds
    - Style buttons with black fill or black border
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.4 Update `src/components/OwnerPanel.jsx` with black-and-white theme
    - Remove colored backgrounds, apply white/zinc-50 backgrounds
    - Style buttons and interactive elements with black-and-white palette
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.5 Update `src/components/SparepartPanel.jsx` with black-and-white theme
    - Remove colored backgrounds, apply white/zinc-50 backgrounds
    - Style buttons and interactive elements with black-and-white palette
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.6 Update `src/components/CustomerPanel.jsx` and `src/components/CustomerProfile.jsx` with black-and-white theme
    - Remove colored backgrounds, apply white/zinc-50 backgrounds
    - Style buttons and interactive elements with black-and-white palette
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.7 Update `src/components/CroBookingPanel.jsx` with black-and-white theme
    - Replace emerald/red colored elements with black-and-white styling
    - Replace `bg-emerald-500` header icon with `bg-black`
    - Replace `hover:bg-red-600` with `hover:bg-zinc-800`
    - Apply consistent black/white/zinc palette to all buttons and inputs
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.8 Update remaining components (`FollowupPanel.jsx`, `DisplayBoard.jsx`, `LoginPage.jsx`, `BookingManager.jsx`, `PublicBooking.jsx`, `PublicTracking.jsx`) with black-and-white theme
    - Apply same black-and-white theme pattern to all remaining page components
    - Ensure disabled states use zinc-300 text and zinc-200 background
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7, 5.8_

  - [x] 5.9 Write property test for theme contrast ratios (Property 4)
    - **Property 4: Theme color pairs maintain accessible contrast**
    - For any text-background color pair in the theme config, WCAG contrast ratio >= 4.5:1
    - **Validates: Requirements 5.9**

  - [x] 5.10 Write property test for status badge saturation (Property 3)
    - **Property 3: Status badge colors maintain muted saturation**
    - For any status color token, HSL saturation <= 50% of default Tailwind palette saturation
    - **Validates: Requirements 5.5**

- [x] 6. Checkpoint - Ensure theme is applied consistently
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Apply responsive mobile layout to page components
  - [x] 7.1 Add responsive layout utilities to `src/components/AdminPanel.jsx`
    - Convert multi-column card grids to single-column on mobile (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
    - Wrap data tables in horizontally scrollable container (`overflow-x-auto`)
    - Scale buttons and inputs to minimum 44×44px tap target on mobile
    - Ensure text minimum 14px (`text-sm`) on mobile
    - Ensure no horizontal overflow (max-width: 100vw)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.2 Add responsive layout to `src/components/ManagerPanel.jsx`
    - Same responsive patterns: single-column mobile, scrollable tables, 44px tap targets
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 7.3 Add responsive layout to `src/components/MechanicPanel.jsx`
    - Same responsive patterns: single-column mobile, scrollable tables, 44px tap targets
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 7.4 Add responsive layout to `src/components/CroBookingPanel.jsx`
    - Convert flex-row layouts to flex-col on mobile
    - Ensure filter/search controls stack vertically on mobile
    - Wrap booking table in scrollable container
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 7.5 Add responsive layout to remaining page components (`OwnerPanel.jsx`, `SparepartPanel.jsx`, `CustomerPanel.jsx`, `FollowupPanel.jsx`, `DisplayBoard.jsx`)
    - Apply consistent responsive patterns across all remaining components
    - Ensure bottom padding of at least 72px on mobile for bottom nav clearance
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8. Remove image upload from CRO Booking Panel
  - [x] 8.1 Remove image upload functionality from `src/components/CroBookingPanel.jsx`
    - Remove any `<input type="file" accept="image/*">` elements (if present)
    - Remove image preview/display elements and related state variables
    - Remove any image upload logic to Supabase storage
    - Retain Excel import (`accept=".xlsx, .xls"`) and all text fields (namaCustomer, noTelp, noPlat, tipeMobil, keperluanService, keluhanDetail, vin)
    - Add graceful null handling: skip image reference fields (`image`, `imageUrl`, `foto`, `attachment`) when rendering booking records without errors
    - Ensure form submission payload does not include any image/file data to Supabase storage
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.2 Write property test for booking form payload (Property 5)
    - **Property 5: Booking form submission excludes image data**
    - For any booking form data object, the payload shall not contain image-related keys and shall contain all required text fields
    - **Validates: Requirements 6.4**

- [x] 9. Remove per-page logout buttons and ensure consistency
  - [x] 9.1 Remove individual logout button implementations from page components
    - Remove any per-page logout button styling or rendering from AdminPanel, ManagerPanel, MechanicPanel, OwnerPanel, SparepartPanel, CustomerPanel, FollowupPanel
    - The logout button is now exclusively rendered within DesktopNavBar and BottomNavBar
    - Ensure logout is hidden on DisplayBoard and login page
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 9.2 Implement logout error handling in `src/App.jsx`
    - Update `handleLogout` to catch network errors from Supabase status update
    - On network failure: still clear localStorage, redirect to login, show error toast "Logout berhasil (sesi remote tidak dapat dihapus)"
    - Ensure logout completes within 2 seconds even on network failure
    - _Requirements: 4.4, 4.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses React 19 + Vite 7 + Tailwind CSS v4 (JavaScript/JSX, not TypeScript)
- fast-check + Vitest should be set up in task 2.3 for property-based testing
- All navigation logic is centralized in navConfig.js to avoid duplication

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.9", "5.10"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "8.1"] },
    { "id": 5, "tasks": ["8.2", "9.1", "9.2"] }
  ]
}
```
