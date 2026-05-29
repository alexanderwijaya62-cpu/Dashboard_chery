# Requirements Document

## Introduction

This feature redesigns the Chery Dashboard application to improve mobile responsiveness, navigation consistency, visual theming, and performance. The redesign introduces a mobile-first bottom navigation bar, fixes the broken desktop navbar visibility, standardizes the logout button across all pages, applies a black-and-white color theme, and removes the heavy image upload feature from the CRO Booking Panel.

## Glossary

- **Dashboard**: The main Chery Dashboard single-page application built with React and Vite
- **Bottom_Navigation_Bar**: A fixed navigation bar at the bottom of the screen on mobile devices, displaying icon-only route buttons
- **Desktop_Navbar**: The existing floating top navigation bar that appears on hover/scroll for desktop viewports (≥768px)
- **Mobile_Viewport**: A screen width below 768px (Tailwind `md` breakpoint)
- **Desktop_Viewport**: A screen width of 768px or above
- **CRO_Booking_Panel**: The CroBookingPanel component used by CRO staff to manage service bookings
- **Logout_Button**: A standardized button component that triggers user session termination
- **Page_Component**: Any top-level routed view in the application (e.g., AdminPanel, ManagerPanel, MechanicPanel, CustomerPanel, OwnerPanel, SparepartPanel, FollowupPanel, DisplayBoard)

## Requirements

### Requirement 1: Responsive Mobile Layout

**User Story:** As a mobile user, I want all dashboard pages to display correctly on my phone screen, so that I can use the application without horizontal scrolling or layout overflow.

#### Acceptance Criteria

1. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Page_Component SHALL render all content, including images and media elements, within the visible screen width (max-width: 100vw) without horizontal overflow or horizontal scrollbar
2. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Page_Component SHALL use single-column layouts for card grids, and SHALL render data tables within a horizontally scrollable container that does not exceed the viewport width
3. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Page_Component SHALL scale buttons and input fields to a minimum tap target size of 44×44px, and SHALL render text at a minimum font size of 14px
4. WHILE the Dashboard is viewed on a Desktop_Viewport, THE Page_Component SHALL maintain the existing multi-column layout behavior
5. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Page_Component SHALL include bottom padding of at least 72px on the page content area to prevent content from being obscured by the Bottom_Navigation_Bar

### Requirement 2: Mobile Bottom Navigation Bar

**User Story:** As a mobile user, I want a fixed bottom navigation bar with icon-only buttons, so that I can quickly switch between pages using one hand.

#### Acceptance Criteria

1. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Bottom_Navigation_Bar SHALL display as a fixed bar at the bottom of the screen with a maximum height of 64px, and page content SHALL include bottom padding equal to the bar height so that no content is obscured
2. THE Bottom_Navigation_Bar SHALL display only icons without text labels for each navigation item, showing between 3 and 6 icons determined by the user's role
3. WHEN a user taps a navigation icon, THE Bottom_Navigation_Bar SHALL navigate to the corresponding route path within 300 milliseconds
4. IF a navigation icon corresponds to a page without a dedicated route path, THEN THE Bottom_Navigation_Bar SHALL navigate to the default home page for the user's role (admin → admin panel, manager → manager panel, cro → cro panel, sparepart → sparepart panel, owner → owner panel, mekanik → mechanic panel, customer → customer panel)
5. THE Bottom_Navigation_Bar SHALL highlight the currently active route icon by applying a visually differentiated style (such as filled variant, increased size, or contrasting background) that is distinguishable from inactive icons without relying on color alone
6. WHILE the Dashboard is viewed on a Desktop_Viewport, THE Bottom_Navigation_Bar SHALL remain hidden
7. WHILE the user is on the login page or public pages without authentication, THE Bottom_Navigation_Bar SHALL remain hidden
8. WHEN a user taps the icon corresponding to the currently active route, THE Bottom_Navigation_Bar SHALL remain on the current page without triggering a reload or navigation event

### Requirement 3: Fix Desktop Navbar Visibility

**User Story:** As a desktop user, I want the top navigation bar to be visible and accessible, so that I can navigate between pages without relying on hidden hover triggers.

#### Acceptance Criteria

1. WHILE the Dashboard is viewed on a Desktop_Viewport, THE Desktop_Navbar SHALL remain persistently visible at the top of the page using fixed or sticky positioning, without auto-hiding based on hover state, scroll position, or inactivity timeout
2. WHILE the user is authenticated AND the Dashboard is viewed on a Desktop_Viewport, THE Desktop_Navbar SHALL display navigation items corresponding to the user's assigned role
3. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Desktop_Navbar SHALL remain hidden (replaced by Bottom_Navigation_Bar)
4. WHILE the user is on the login page or public pages without authentication, THE Desktop_Navbar SHALL remain hidden
5. WHEN the user navigates between pages, THE Desktop_Navbar SHALL remain visible without requiring re-interaction to restore visibility

### Requirement 4: Consistent Logout Button

**User Story:** As a user, I want the logout button to look and behave the same on every page, so that I always know where to find it and how it works.

#### Acceptance Criteria

1. THE Logout_Button SHALL use the same icon, size, color, and shape across all Page_Components, with no per-page style overrides
2. WHILE the Dashboard is viewed on a Desktop_Viewport, THE Logout_Button SHALL be positioned within the Desktop_Navbar on every authenticated page
3. WHILE the Dashboard is viewed on a Mobile_Viewport, THE Logout_Button SHALL be positioned within the Bottom_Navigation_Bar on every authenticated page
4. WHEN a user activates the Logout_Button, THE Dashboard SHALL clear the stored session data, update the user status to offline, and redirect to the login page within 2 seconds
5. IF the session termination request fails due to a network error, THEN THE Dashboard SHALL still clear local session data, redirect to the login page, and display an error message indicating the remote session could not be terminated
6. WHILE the user is on the DisplayBoard or login page, THE Logout_Button SHALL remain hidden

### Requirement 5: Black and White Theme

**User Story:** As a user, I want the dashboard to use a clean black-and-white color scheme with black text, so that the interface is visually consistent and easy to read.

#### Acceptance Criteria

1. THE Dashboard SHALL use white (#FFFFFF) as the primary background color for all Page_Components
2. THE Dashboard SHALL use black (#000000) as the primary text color for all headings, body text, labels, and input values
3. THE Dashboard SHALL use the Tailwind zinc palette within the range of zinc-100 to zinc-400 for borders, dividers, placeholder text, disabled input fields, helper text, and non-primary icons
4. THE Dashboard SHALL remove all colored gradient backgrounds from page containers and card elements, replacing them with solid white or zinc-50 backgrounds
5. THE Dashboard SHALL preserve functional color indicators for status badges (e.g., green for success, red for error, yellow for pending) using muted tones with saturation no greater than 50% of the default Tailwind color palette values
6. THE Dashboard SHALL style all interactive elements (buttons, links, clickable icons) with black (#000000) fill or a 1px black border on a white background, instead of colored backgrounds
7. WHEN a user hovers over or focuses on an interactive element, THE Dashboard SHALL provide visual feedback by transitioning the element background to zinc-200 or inverting fill and border colors within 150ms
8. IF an interactive element is in a disabled state, THEN THE Dashboard SHALL render it with zinc-300 text and zinc-200 background to visually distinguish it from active elements without using color
9. THE Dashboard SHALL maintain a minimum contrast ratio of 4.5:1 between text and its background across all Page_Components

### Requirement 6: Remove Image Upload from CRO Booking Panel

**User Story:** As a system administrator, I want the image upload feature removed from the CRO Booking Panel, so that Supabase storage usage is reduced and the panel handles only text data.

#### Acceptance Criteria

1. THE CRO_Booking_Panel SHALL NOT display any image upload input fields, image attachment buttons, or image preview elements
2. THE CRO_Booking_Panel SHALL retain all text-based data fields (customer name, phone, plate number, car type, service type, complaint details, VIN) and the Excel import/export functionality
3. IF existing booking records contain image references, THEN THE CRO_Booking_Panel SHALL render the record without displaying any image placeholder, broken image indicator, or empty space where the image previously appeared
4. THE CRO_Booking_Panel SHALL NOT send any image or file data to Supabase storage on form submission, while continuing to insert text-based booking records into the database
5. WHEN a booking record containing image reference fields is loaded, THE CRO_Booking_Panel SHALL skip image reference fields during rendering without throwing runtime errors or displaying console errors to the user

### Requirement 7: Bottom Navigation Icon-Only Display

**User Story:** As a mobile user, I want the bottom navigation to show only icons without any text, so that the navigation bar stays compact and does not take up excessive screen space.

#### Acceptance Criteria

1. THE Bottom_Navigation_Bar SHALL render each navigation item as an icon element only, with no accompanying text label, and no tooltip or subtitle visible on screen
2. THE Bottom_Navigation_Bar SHALL maintain a maximum height of 64px including internal padding to preserve content viewing area
3. THE Bottom_Navigation_Bar SHALL distribute icons with equal horizontal spacing across the full screen width, with a minimum horizontal padding of 8px from each screen edge
4. THE Bottom_Navigation_Bar SHALL render each icon with a minimum tap target size of 44×44px to ensure touch accessibility
5. THE Bottom_Navigation_Bar SHALL provide an accessible label (e.g., aria-label) on each icon element so that screen readers can identify the navigation destination without a visible text label
