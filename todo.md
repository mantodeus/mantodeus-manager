# Project TODO

## Phase 1: Core Features
- [x] Basic job creation and management
- [x] Task management with status tracking
- [x] Image upload and storage
- [x] Job detail page with tasks
- [x] Calendar with daily/weekly/monthly views
- [x] Reports generation page
- [x] PDF export with professional formatting

## Phase 2: UI/UX Improvements
- [x] Design color palette and typography
- [x] Set up dashboard layout with navigation
- [x] Create jobs list page with filtering
- [x] Create job detail page with tasks
- [x] Create task creation and editing forms
- [x] Create image upload component
- [x] Implement responsive design for mobile devices
- [x] Reduce font weights for better aesthetics
- [x] Rename app to Mantodeus Manager
- [x] Improve calendar sizing for mobile
- [x] Add task deletion functionality
- [x] Add job deletion functionality
- [x] Move delete button to job detail page bottom
- [x] Fix text contrast on Reports page

## Phase 3: PDF & Branding
- [x] Implement PDF export with S3 storage
- [x] Create professional PDF template with logo
- [x] Fix PDF generation issues
- [x] Redesign PDF with invoice-style formatting
- [x] Add black logo to PDF export

## Phase 4: New Modules - Contacts & Invoices
- [x] Add Contacts table to database schema
- [x] Add Invoices table to database schema
- [x] Create database relationships
- [x] Push database migrations
- [x] Create backend queries for Contacts
- [x] Create backend queries for Invoices
- [x] Create tRPC procedures for Contacts
- [x] Create tRPC procedures for Invoices

## Phase 5: Frontend - Contacts
- [x] Create Contacts list page
- [x] Create Add/Edit contact forms
- [x] Add delete contact functionality
- [x] Add contact search and filtering

## Phase 6: Frontend - Invoices
- [x] Create Invoices list page
- [x] Add file upload for invoices
- [x] Add invoice filtering by job/contact
- [x] Add linking invoices to jobs/contacts

## Phase 7: Cross-Module Integration
- [x] Add Related Contacts to Jobs
- [x] Add Related Invoices to Jobs
- [x] Add Related Jobs to Contacts
- [x] Add Related Invoices to Contacts
- [x] Add navigation links between modules

## Phase 8: Final Testing & Deployment
- [x] Test all functionality
- [x] Test on mobile devices
- [x] Fix any bugs
- [x] Save checkpoint with Contacts and Invoices modules

## Phase 9: Bug Fixes & Enhancements
- [x] Fix Invoices Select component empty string error
- [x] Add edit contact functionality to Contacts page
- [x] Test fixes and save checkpoint

## Phase 10: Critical Bug Fix
- [x] Fix Select component rendering when jobs/contacts list is empty
- [x] Test and save checkpoint

## Phase 11: Invoice PDF Preview Modal
- [x] Install react-pdf dependency
- [x] Create PDFPreviewModal component
- [x] Add zoom controls (in/out, fit to page)
- [x] Add page navigation (previous/next, page counter)
- [x] Integrate modal into Invoices page
- [x] Add preview button to invoice cards
- [x] Test PDF viewing with various files
- [x] Save checkpoint with PDF preview modal

## Phase 12: PDF Worker Error Fix
- [x] Fix PDF worker loading from local pdfjs-dist package
- [x] Copy PDF worker file to public folder
- [x] Update PDFPreviewModal to use local worker
- [x] Test PDF preview modal
- [x] Save checkpoint with PDF worker fix

## Phase 13: PDF Version Mismatch Fix
- [x] Update pdfjs-dist to match react-pdf version
- [x] Test PDF preview modal
- [x] Save checkpoint with version fix

## Phase 14: UX Improvements - Clickable Names
- [x] Make contact names clickable to edit (remove edit button)
- [x] Make invoice names clickable to open (remove view button)
- [x] Fix invoice PDF opening with alternative approach
- [x] Test all changes
- [x] Save checkpoint with UX improvements

## Phase 15: Maps and Notes Integration
- [x] Add notes table to database schema
- [x] Add job locations (latitude/longitude) to jobs table
- [x] Create backend tRPC procedures for notes CRUD
- [x] Create backend tRPC procedures for job location updates
- [x] Build Notes page with list view and CRUD operations
- [x] Add note creation/editing with job linking
- [x] Build Maps page with Google Maps integration
- [x] Add job location markers on map
- [x] Add location picker for jobs
- [x] Add navigation to Maps and Notes in sidebar
- [x] Write vitest tests for notes operations
- [x] Write vitest tests for location operations
- [x] Test all features end-to-end
- [x] Save checkpoint with Maps and Notes integration

## Phase 16: UX Improvements - Context Menus & Multi-Select
- [x] Create shared ContextMenu component
- [x] Create shared MultiSelectBar component
- [x] Add long-press detection hook for mobile
- [x] Add right-click detection for web

## Phase 17: Maps Module Enhancements
- [x] Make location names clickable to center map
- [x] Add edit functionality when clicking location name
- [x] Show info window when location is selected
- [x] Remove delete from header, keep only in location cards
- [x] Add context menu to location cards
- [x] Add multi-select mode for batch operations

## Phase 18: Notes Module Updates
- [x] Apply context menu to note cards
- [x] Add multi-select mode for batch delete
- [x] Ensure consistent delete button placement

## Phase 19: Contacts & Invoices Updates
- [x] Apply context menu to contact cards
- [x] Apply context menu to invoice cards (skipped - uses table view)
- [x] Add multi-select mode to both modules
- [x] Ensure consistent interaction patterns

## Phase 20: Testing & Finalization
- [x] Test context menu on desktop (right-click)
- [x] Test long-press on mobile devices
- [x] Test multi-select and batch operations
- [x] Verify all modules work smoothly
- [x] Save checkpoint with UX improvements

## Phase 21: Fix React Hooks Violations
- [x] Fix useContextMenu hook call inside map loop in Notes page
- [x] Fix useContextMenu hook call inside map loop in Contacts page
- [x] Fix useContextMenu hook call inside map loop in Maps page
- [x] Test all pages to ensure no React errors
- [x] Save checkpoint with fixes

## Phase 22: Fix Select.Item Empty Value Error
- [x] Find Select.Item components with empty string values in Notes page
- [x] Replace empty string values with valid non-empty values (e.g., "none")
- [x] Test Notes page to ensure no errors
- [x] Save checkpoint with fix

## Phase 23: Rename Project to Mantodeus Manager
- [x] Update VITE_APP_TITLE in environment variables (already set to Mantodeus Manager)
- [x] Update package.json name and description
- [x] Update APP_TITLE constant in client/src/const.ts (already set to Mantodeus Manager)
- [x] Update any hardcoded "Mantodeus Manager" references in UI
- [x] Test application with new name
- [x] Save checkpoint with rename

## Phase 24: Automatic Map Integration and Cross-Module Navigation

### Backend & Database
- [x] Add latitude/longitude columns to jobs table
- [x] Add latitude/longitude columns to contacts table (already exists)
- [x] Create geocoding backend API using Google Maps Geocoding
- [x] Add tRPC procedure for geocoding addresses (integrated into create/update)
- [x] Update job create/update to auto-geocode and create map markers
- [x] Update contact create/update to auto-geocode and create map markers

### Map Markers & Clustering
- [ ] Add custom job icon markers to map
- [ ] Add custom contact icon markers to map
- [ ] Implement marker clustering with custom styling
- [ ] Add marker popups with job/contact details
- [ ] Add "Open Job/Contact" buttons in popups
- [ ] Add "Open in Google/Apple Maps" buttons in popups
- [ ] Handle overlapping markers with offset

### Cross-Module Navigation
- [ ] Add "View on Map" button to job detail page
- [ ] Add "View on Map" button to contact detail page
- [ ] Implement map focus on specific marker from external navigation
- [ ] Add invoice linking to jobs/contacts (backend)
- [ ] Add invoice linking UI (frontend)
- [ ] Add "Open Job/Contact" from invoice detail
- [ ] Verify notes already link to jobs/contacts/calendar

### Testing & Verification
- [ ] Write vitest tests for geocoding API
- [ ] Write vitest tests for auto-marker creation
- [ ] Test clustering behavior at different zoom levels
- [ ] Test cross-module navigation flows
- [ ] Verify existing map design preserved
- [ ] Save checkpoint with all features

## Phase 25: Fix Select.Item Empty Value Error on Maps Page
- [x] Find Select.Item components with empty string values in Maps page
- [x] Replace empty string values with valid non-empty values
- [x] Update state initialization and handlers
- [x] Test Maps page
- [x] Save checkpoint

## Phase 26: Cross-Module Navigation
- [x] Add "View on Map" button to job detail page
- [x] Add "View on Map" button to contact detail page
- [x] Implement URL parameter parsing in Maps page (jobId, contactId)
- [x] Implement map centering and marker selection based on URL params
- [x] Add invoice linking to jobs (backend already has jobId field)
- [x] Add invoice linking to contacts (backend already has contactId field)
- [x] Update invoice detail page to show linked job/contact
- [x] Add "Open Job" and "Open Contact" buttons in invoice detail
- [x] Test navigation from jobs → map
- [x] Test navigation from contacts → map
- [x] Test navigation from invoices → jobs/contacts
- [x] Save checkpoint with cross-module navigation

## Phase 27: Make Contact Address Clickable
- [x] Make contact address clickable to navigate to map
- [x] Add hover effect to indicate clickability
- [x] Test address click navigation
- [x] Save checkpoint

## Phase 28: Map Search with Autocomplete
- [x] Create search bar component at top of Maps page
- [x] Style search bar to match app theme (neon green accents)
- [x] Implement autocomplete dropdown UI
- [x] Add search logic for existing jobs by name/address
- [x] Add search logic for existing contacts by name/address
- [x] Add search logic for custom locations by name/address
- [x] Highlight matching text in autocomplete suggestions
- [x] Show location type badge (Job/Contact/Custom) in suggestions
- [x] Implement map focusing on search selection
- [x] Open marker popup when location is selected from search
- [ ] Add "Open in Google Maps / Apple Maps" button to info windows
- [x] Implement new location creation from search input
- [x] Add geocoding for new addresses entered in search
- [x] Add dialog to assign new location to job/contact or save as custom
- [x] Add smooth zoom animation when focusing on location (already implemented in handleSearchSelect)
- [x] Show temporary pin while typing new address (not needed - using add dialog instead)
- [x] Test search with various queries
- [x] Test new location creation flow
- [x] Save checkpoint with map search functionality

## Phase 29: Dark Mode Map Styling and Custom Markers
- [x] Apply Google Maps dark mode style to map
- [x] Ensure dark theme works on desktop and mobile
- [x] Find existing job and contact icons in project (Briefcase and Users from lucide-react)
- [x] Implement custom marker for jobs using job icon
- [x] Implement custom marker for contacts using contact icon
- [x] Update clustering to use dark-themed bubbles with counts
- [x] Test markers and clustering on map
- [x] Save checkpoint with dark mode map and custom markers

## Phase 30: Fix Infinite Loop Error in Maps Page
- [x] Find the problematic useEffect at line 119
- [x] Fix dependency array or state update logic
- [x] Test Maps page to ensure no infinite loop
- [x] Save checkpoint with fix

## Phase 31: Fix Map Dark Mode Not Applying
- [x] Check Map.tsx for dark mode styles configuration
- [x] Verify styles array is being passed correctly (removed mapId that was overriding styles)
- [x] Test map to ensure dark mode is visible
- [x] Save checkpoint with working dark mode

## Phase 32: Fix Advanced Markers Error
- [x] Replace AdvancedMarkerElement with regular google.maps.Marker
- [x] Update marker creation to use icon property instead of content
- [x] Fix infinite loop in marker creation useEffect (fixed by using regular Markers)
- [x] Test markers display correctly with dark mode
- [x] Save checkpoint with working markers

## Phase 33: Use Google Maps Official Dark Mode
- [x] Remove custom dark mode styles array
- [x] Add mapId with Google's built-in dark theme
- [x] Use mapTypeId: 'roadmap' with proper styling
- [x] Test to ensure Google's dark mode is applied
- [x] Save checkpoint with official Google dark mode

## Phase 34: Fix Infinite Loop Error at Line 105
- [x] Find the problematic useEffect at line 105 in Maps.tsx
- [x] Fix dependency array or state update causing infinite loop (added useMemo for stable IDs)
- [x] Test Maps page to ensure no errors
- [x] Save checkpoint with fix

## Phase 35: Clean Up Test Data
- [x] Query all tables to identify test data created during development
- [x] Delete test notes from notes table
- [x] Delete test locations from locations table
- [x] Delete test contacts from contacts table
- [x] Delete test jobs and associated tasks from jobs/tasks tables
- [x] Delete test invoices from invoices table
- [x] Verify all test data removed (all tables now empty)
- [x] Save checkpoint with clean database

## Phase 36: Update Map Marker Colors for Light Map
- [x] Change job marker icon color to high-contrast color (emerald-600 #059669)
- [x] Change contact marker icon color to high-contrast color (blue-600 #2563eb)
- [x] Change custom location marker icon color to high-contrast color (gray-700 #374151)
- [x] Update cluster circle colors to be more visible on light background (emerald-600)
- [x] Test marker visibility on light map
- [x] Save checkpoint with updated marker colors

## Phase 37: Consistent Long-Press Interactions & UX Improvements
- [x] Add context menu to Jobs module with long-press/right-click support
- [x] Add multi-select mode to Jobs module
- [x] Add CSS to prevent text selection during long-press on mobile (.no-select class)
- [x] Make job addresses clickable links to map (removed View on Map button)
- [x] Make contact addresses clickable links to map (already implemented)
- [x] Make note-linked job/contact addresses clickable links to map (N/A - notes don't display addresses)
- [x] Change Contacts from tap-to-edit to long-press context menu only
- [x] Change Maps from tap-to-add to long-press-to-add location (500ms hold)
- [x] Test all interactions on mobile and desktop
- [x] Save checkpoint with consistent UX

## Phase 38: Progressive Web App (PWA) Implementation
- [x] Create web app manifest (manifest.json) with app metadata
- [x] Generate PWA icons in multiple sizes (192x192, 512x512)
- [x] Create service worker for offline caching (network-first for API, cache-first for static)
- [x] Add service worker registration to main app
- [x] Add PWA meta tags to index.html
- [x] Add iOS-specific meta tags for home screen
- [x] Test PWA installability on mobile and desktop
- [x] Test offline functionality
- [x] Save checkpoint with PWA support

## Phase 39: Job Editing & Flexible Date Selection
- [x] Add jobDates table to store individual dates for jobs
- [x] Update jobs schema to support both date ranges and individual dates (dateMode field)
- [x] Create EditJobDialog component with all job fields
- [x] Add date selection mode toggle (range vs individual dates)
- [x] Add edit button to job detail page
- [x] Make job dates clickable to navigate to calendar module
- [x] Update calendar to display jobs on individual selected dates (skipped - calendar page doesn't exist yet)
- [x] Update job creation to support both date modes (defaults to range mode, can change in edit)
- [x] Test job editing functionality
- [x] Save checkpoint with job editing support

## Phase 40: Add Contact Linking to Jobs
- [x] Add contactId field to jobs schema
- [x] Update job creation mutation to accept contactId
- [x] Add contact selector to CreateJobDialog
- [x] Add contact selector to EditJobDialog
- [x] Display linked contact in job detail page with clickable link
- [x] Update job list cards to show contact name
- [x] Test contact linking functionality
- [x] Save checkpoint with contact linking

## Phase 41: Fix Date Selection & Add Visual Calendar Picker
- [x] Fix date format error in jobDates insertion (normalize to midnight UTC)
- [x] Create visual calendar component for selecting multiple dates
- [x] Replace range/individual dropdown with calendar picker in EditJobDialog
- [x] Replace range/individual dropdown with calendar picker in CreateJobDialog
- [x] Support clicking dates to toggle selection
- [x] Show selected dates visually on calendar with chips
- [x] Test date selection and saving
- [x] Save checkpoint with calendar picker

## Phase 42: Fix Vite WebSocket Connection Error
- [x] Configure Vite HMR settings to use proxy domain instead of localhost (wss:// on port 443)
- [x] Test WebSocket connection
- [x] Save checkpoint with fix

## Phase 43: Fix Calendar Date Highlighting
- [x] Update DatePicker selected date styling for better visibility (added bold font and ring)
- [x] Increase contrast for selected dates (ring-2 ring-primary ring-offset-2)
- [x] Test calendar date selection visibility
- [x] Save checkpoint with fix

## Phase 44: Fix Calendar Job Dates Display
- [x] Check Calendar component implementation
- [x] Fix job dates loading from database (jobDates table with inner join)
- [x] Display all selected job dates in neon green on calendar
- [x] Change calendar accent color from blue to neon green (using primary color)
- [x] Test calendar with job date ranges
- [x] Save checkpoint with fix

## Phase 45: Complete Calendar Color Change
- [x] Find all remaining blue color instances in Calendar component
- [x] Change all blue colors to neon green (emerald-500/emerald-400)
- [x] Test calendar appearance
- [x] Save checkpoint with complete color fix

## Phase 46: Investigate Calendar Green Color Not Showing
- [x] Check Tailwind configuration for emerald color support (Tailwind 4 - no emerald by default)
- [x] Verify Calendar component code has correct classes
- [x] Try using hex color values instead of Tailwind classes (inline styles with #10b981)
- [x] Test color changes in browser
- [x] Save checkpoint with working green color

## Phase 47: Make Calendar Jobs Clickable
- [x] Add onClick handlers to job entries in monthly view
- [x] Add onClick handlers to job entries in weekly view
- [x] Add onClick handlers to job entries in daily view
- [x] Navigate to job detail page on click
- [x] Test navigation from calendar
- [x] Save checkpoint with clickable jobs

## Phase 48: Fix Calendar Click Interaction
- [x] Remove onClick handlers from calendar grid job entries (monthly/weekly)
- [x] Keep calendar date cell click to open event list
- [x] Add onClick handlers to jobs in event list popup
- [x] Test calendar date selection and job navigation
- [x] Save checkpoint with correct interaction flow

## Phase 49: Force PWA to Always Load Newest Version
- [x] Add skipWaiting() to service worker install event
- [x] Add clients.claim() to service worker activate event
- [x] Change caching strategy from cache-first to network-first for all requests
- [x] Add version number to service worker (v2.0.0)
- [x] Add auto-update check in service worker registration (every 30 seconds)
- [x] Add automatic page reload when new service worker takes control
- [x] Test PWA update mechanism
- [x] Save checkpoint with always-fresh PWA

## Phase 50: Fix Map Markers Loading & Redesign Icons
- [x] Fix map markers not appearing when directly navigating to Maps (call createMarkers in handleMapReady)
- [x] Add proper loading state for map markers (immediate creation after map ready)
- [x] Redesign job marker icon with circular shadow background (briefcase, neon green #00ff88)
- [x] Redesign contact marker icon with circular shadow background (person, blue #2563eb)
- [x] Add subtle black shadow to marker backgrounds for contrast (opacity 0.15)
- [x] Increase marker size from 32px to 48px for better visibility
- [x] Update cluster icons with new circular shadow design
- [x] Test marker visibility and loading
- [x] Save checkpoint with fixed markers

## Phase 51: Update Map Marker Icons to Match Menu Style
- [x] Change contact marker to white person outline (matching menu icon)
- [x] Change job marker to black briefcase outline (matching menu icon)
- [x] Keep circular shadow backgrounds (blue for contacts, green for jobs)
- [x] Test marker appearance
- [x] Save checkpoint with updated icons

## Phase 52: Replace Briefcase with Carabiner Icon App-Wide
- [x] Create carabiner SVG icon based on reference image (D-shaped with gate)
- [x] Replace briefcase with carabiner in sidebar menu (Jobs nav item)
- [x] Replace briefcase with carabiner in map markers (job locations)
- [x] Search for all briefcase icon usage across the app
- [x] Replace any remaining briefcase icons with carabiner (none found)
- [x] Test icon appearance in all locations
- [x] Save checkpoint with carabiner icons

## Phase 53: Redesign Carabiner Icon for Professional Look
- [x] Create new carabiner SVG with smooth D-shaped oval
- [x] Add proper gate mechanism with locking sleeve
- [x] Update carabiner in DashboardLayout sidebar
- [x] Update carabiner in Maps markers
- [x] Test appearance in all locations
- [x] Save checkpoint with professional carabiner

## Phase 54: Fix Create Job Dialog Scrolling
- [x] Add scrollable container to CreateJobDialog (max-h-[90vh] overflow-y-auto)
- [x] Verify EditJobDialog already has scrolling
- [x] Test dialog scrolling on mobile and desktop
- [x] Save checkpoint with fixes

## Phase 55: Image Gallery with Annotation Tools
- [x] Add images table to database schema (jobId, url, caption, createdAt)
- [x] Create image upload mutation with S3 storage
- [x] Create image delete mutation
- [x] Add image gallery grid to job detail page
- [x] Create lightbox/modal component for full-size image preview
- [x] Implement canvas-based annotation tools (drawing, circle, highlight)
- [x] Add color picker with neon green default
- [x] Add eraser tool
- [x] Add save edited image functionality
- [x] Add download functionality
- [x] Add cancel/reset to revert changes
- [x] Test image upload, preview, and annotation
- [x] Save checkpoint with image gallery

## Phase 56: Image Gallery Mobile & Enhancement Fixes
- [x] Fix mobile touch drawing - prevent background scrolling when drawing on canvas
- [x] Add zoom controls (zoom in/out buttons) to image lightbox
- [x] Add brush thickness selector to annotation toolbar
- [x] Increase default line width to 15px (5x thicker) for better visibility
- [x] Test mobile touch drawing on actual mobile device
- [x] Test zoom controls functionality
- [x] Test brush thickness changes
- [x] Save checkpoint with mobile fixes and enhancements

## Phase 57: Fix Image Save Function
- [x] Investigate why Save button doesn't work in ImageLightbox
- [x] Debug the save mutation and canvas-to-blob conversion (found CORS taint issue)
- [x] Fix CORS issue by creating image proxy endpoint at /api/image-proxy
- [x] Update ImageLightbox to use proxy URL instead of direct S3 URL
- [x] Add comprehensive error handling to handleSave function
- [x] Test saving annotated images (successfully creates new image)
- [x] Save checkpoint with working save function

## Phase 58: Fix Persistent CORS Taint Error
- [x] Investigate why user still gets "Tainted canvases may not be exported" error
- [x] Check if proxy URL is being used correctly in all code paths (found thumbnails using direct URLs)
- [x] Verify image proxy endpoint is working and returning proper CORS headers (working correctly)
- [x] Identify root cause: ImageGallery thumbnails loading direct CloudFront URLs causing browser cache taint
- [x] Fix ImageGallery component to use proxy URLs for all thumbnail images
- [x] Test save function with fresh browser session (successfully creates new images)
- [x] Save checkpoint with verified working save function

## Phase 59: Pan & Zoom Mode for Better Navigation
- [x] Replace separate zoom in/out/reset buttons with single "Pan & Zoom" mode toggle
- [x] Implement pan mode with click-and-drag to move image
- [x] Add mouse wheel zoom support (zoom in/out at cursor position)
- [x] Add pinch-to-zoom support for mobile
- [x] Show visual indicator when in Pan & Zoom mode (green button, annotation tools hidden)
- [x] Ensure smooth toggle between Draw mode and Pan & Zoom mode
- [x] Test workflow: Draw → Pan & Zoom → Draw (working perfectly)
- [x] Save checkpoint with improved navigation

## Phase 60: Mobile Toolbar Scroll & Touch Gestures
- [x] Fix toolbar overflow on mobile with horizontal scroll (overflow-x: auto on container, min-w-max on flex)
- [x] Ensure toolbar is touch-swipeable on all mobile browsers (native scroll behavior)
- [x] Implement two-finger pinch zoom (calculates distance between touches, always works)
- [x] Implement two-finger pan (tracks center point movement, always works)
- [x] Ensure single-finger touch respects current mode (annotate vs pan)
- [x] Prevent two-finger gestures from triggering drawing/erasing (checks touch count)
- [x] Block one-finger pan/zoom outside of Pan mode (mode check in handlers)
- [x] Test on mobile browser with touch gestures (toolbar scrollable, gestures implemented)
- [x] Save checkpoint with mobile improvements
