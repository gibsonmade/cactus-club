# Cactus Club V2 Implementation Guide

This guide rebuilds **Cactus Club** from scratch as a clean `apps/cactus-club-v2` app. It assumes a new computer, no prior conversation history, no local context, and a developer using Codex inside VS Code.

The current app got to its final state through many iterations. V2 should not copy that path. Build the product from first principles: product model first, data contracts second, interaction architecture third, visual system fourth, then polish and verification.

## Product Definition

**Cactus Club** is a warm, premium Austin nightlife and social discovery app.

It is not an event calendar, Eventbrite clone, Yelp table, admin dashboard, or filter database. It helps someone answer: **what should I do today, tonight, this weekend, or soon?**

The product should feel like:

- A friendly best-friend AI for Austin plans
- Apple-level simplicity and restraint
- Airbnb warmth and spatial confidence
- Yelp-style local usefulness without Yelp clutter
- Walmart-level obvious actions and practical navigation
- Spotify-style recommendation confidence

The product should not feel like:

- A finance dashboard
- A generic Tailwind template
- A CRUD app
- A giant search/filter feed
- A cold database browser

## Core Jobs To Be Done

1. **Open the app and quickly know what is worth doing.**
   The Today page should reduce decision fatigue and narrate the day.

2. **Browse by vibe or neighborhood without overthinking.**
   Explore should feel like premium ecommerce browsing, not a database.

3. **Save a plan and trust it will persist.**
   Saved events and venues should survive reloads. Expired events should disappear automatically.

4. **Understand a venue quickly.**
   Venue pages should show vibe, neighborhood, upcoming events, evergreen ideas, and outbound actions.

5. **Inspect event details without losing browsing momentum.**
   Events open in a bottom sheet on mobile and side drawer on larger screens.

6. **Use lightweight intelligence without exposing algorithms.**
   Area, vibe, popularity, weather, time of day, and distance should shape recommendations invisibly.

7. **Accept and review community submissions from day one.**
   V2 should seed from Google Sheets, persist normalized records in Supabase, and include submission flows for events, venues, evergreen events, and evergreen venues. Local JSON remains a build/cache fallback, not the primary long-term architecture.

## Required Final Feature Set

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- lucide-react
- lottie-react
- Google Sheets import script
- Supabase persistence as the main data architecture
- Local JSON seed/cache fallback for static preview and offline development
- Submit flows for events, venues, evergreen events, and evergreen venues
- Admin/moderation review queue for submitted records
- Auth-ready structure with anonymous browsing and protected review actions
- `localStorage` save system
- Browser geolocation
- Weather-aware section using a free weather API
- Time-aware greeting and day/night theme behavior
- User theme override: `auto`, `dark`, `light`
- Default dark mode, auto light during day and dark at night
- Four primary tabs only:
  - Today
  - Explore
  - Places
  - Plan
- Today narrative page
- Explore one-line mobile filter bar
- Event detail bottom sheet / side drawer
- Venue detail pages with URLs
- Places page with carousel rows by neighborhood and category
- Plan page with saved events, saved venues, filters, sorting, and plan modes
- Lottie-style category and nav icons
- Plan badge animation when saving
- Graceful image fallbacks
- Responsive mobile-first app shell
- Desktop editorial layout
- Typecheck and production build verification

## V2 Architecture

Build V2 as a feature-oriented app, not one large component file.

```txt
apps/cactus-club-v2/
  app/
    layout.tsx
    page.tsx
    loading.tsx
    today/page.tsx
    explore/page.tsx
    places/page.tsx
    places/[venueId]/page.tsx
    plan/page.tsx
  components/
    app-shell/
      app-shell.tsx
      bottom-nav.tsx
      top-bar.tsx
      location-menu.tsx
    cards/
      event-card.tsx
      venue-card.tsx
      plan-card.tsx
    discovery/
      today-page.tsx
      weather-plan.tsx
      category-lanes.tsx
      move-maker.tsx
      evergreen-discovery.tsx
    explore/
      explore-page.tsx
      browse-bar.tsx
      date-range-picker.tsx
      filter-panel.tsx
    places/
      places-page.tsx
      venue-rail.tsx
      venue-detail-page.tsx
    plan/
      plan-page.tsx
      plan-controls.tsx
      plan-group.tsx
    ui/
      glass-panel.tsx
      safe-image.tsx
      empty-state.tsx
      skeleton.tsx
      lottie-icon.tsx
      drawer.tsx
  lib/
    data/
      local-data-source.ts
      supabase-data-source.ts
      repository.ts
      normalize.ts
    domain/
      types.ts
      areas.ts
      vibes.ts
      scoring.ts
      recommendations.ts
      time.ts
      location.ts
      weather.ts
    storage/
      use-local-storage.ts
      saved-plan.ts
      preferences.ts
    theme/
      theme-provider.tsx
      theme-tokens.ts
    utils/
      cn.ts
  scripts/
    import-events.mjs
  public/data/
    events.json
    venues.json
    evergreen-events.json
    evergreen-venues.json
    import-report.json
```

## Data Strategy

### Production Runtime

Supabase is part of the main build. The app should browse approved Supabase records when environment variables are configured.

Supabase tables:

- `events`
- `venues`
- `evergreen_events`
- `evergreen_venues`
- `submissions`
- `submission_audit_log`

Required status model:

- `draft`
- `pending`
- `approved`
- `rejected`
- `archived`

Required source model:

- `sheet`
- `user`
- `admin`
- `evergreen`

Required submission flows:

- Submit an event
- Submit a venue
- Submit an evergreen event/activity
- Submit an evergreen venue/place

Required review flows:

- Review pending submissions
- Approve into canonical tables
- Reject with internal reason
- Archive stale records
- Preserve source and audit fields

### Local Fallback

Local JSON is still required so the app can run in static-preview mode and so builds remain resilient if Supabase credentials are missing.

- `/public/data/events.json`
- `/public/data/venues.json`
- `/public/data/evergreen-events.json`
- `/public/data/evergreen-venues.json`

### Import Pipeline

Build script fetches Google Sheets CSV tabs, normalizes rows, enriches records, writes local JSON, and writes an import report.

The importer should handle:

- Main events
- Evergreen events
- Evergreen venues
- Invalid rows
- Missing images
- Venue derivation
- Area inference
- Vibe tagging
- Future-only filtering for event feeds

### Main Repository Boundary

Do not wire Supabase or local JSON directly into UI components. Add a data-source interface:

```ts
export interface CactusClubDataSource {
  getEvents(): Promise<EventItem[]>;
  getVenues(): Promise<VenueItem[]>;
  getEvergreenEvents(): Promise<EvergreenEventItem[]>;
  getEvergreenVenues(): Promise<EvergreenVenueItem[]>;
  submitEvent(input: EventSubmissionInput): Promise<SubmissionResult>;
  submitVenue(input: VenueSubmissionInput): Promise<SubmissionResult>;
  submitEvergreenEvent(input: EvergreenEventSubmissionInput): Promise<SubmissionResult>;
  submitEvergreenVenue(input: EvergreenVenueSubmissionInput): Promise<SubmissionResult>;
  getPendingSubmissions(): Promise<SubmissionItem[]>;
  approveSubmission(id: string): Promise<void>;
  rejectSubmission(id: string, reason: string): Promise<void>;
}
```

Implement:

- `supabaseDataSource` for production browsing, submissions, and review
- `localDataSource` for static JSON fallback and offline development
- `repository.ts` as the only import surface for UI code

Repository rules:

- Prefer Supabase when environment variables are present.
- Fall back to local JSON when Supabase is unavailable.
- Submission APIs should return graceful unavailable states if Supabase is not configured.
- UI should never need to know which data source is active.

## Domain Types

Core types:

- `Area`
- `VibeTag`
- `MoveIntent`
- `EventItem`
- `VenueItem`
- `EvergreenEventItem`
- `EvergreenVenueItem`
- `ScoreSet`
- `SavedState`
- `UserLocation`
- `ThemeMode`

Areas:

- Downtown
- East Side
- Central
- Barton/Zilker
- South Austin
- North Austin
- Burbs

Display `Burbs` as `Suburbs` in UI.

Vibe tags:

- Date Night
- Free
- Weird Austin
- Low-Key
- Popular
- Social
- Outdoors
- Patio
- Late Night
- Wellness
- Live Music
- Comedy
- Dancing
- Under the Radar

## Theme And Design System

Use CSS variables and Tailwind tokens. Do not hard-code the whole brand into one-off classes.

Required tokens:

- `--color-bg`
- `--color-surface`
- `--color-surface-strong`
- `--color-text`
- `--color-muted`
- `--color-accent`
- `--color-accent-warm`
- `--color-border`
- `--shadow-soft`
- `--shadow-card`
- `--radius-card`
- `--radius-pill`
- `--font-sans`
- `--font-display`

Theme behavior:

- Default is `auto`
- Auto uses light mode during daytime and dark mode at night
- User can override `dark` or `light`
- Store override in `localStorage`
- Keep dark mode as the brand default if time detection is unavailable

Design direction:

- Warm glass panels
- Soft shadows
- Large readable type
- Fewer competing elements
- Clear hierarchy
- Friendly copy
- Premium motion
- Calm inputs and controls
- Mobile-first app feel

## Prompt Series Overview

Use these prompts sequentially. They are designed to be pasted into Codex inside VS Code. Each prompt should end with typecheck/build verification before moving on.

If you want to stack all prompts into one larger request, use the **Master Prompt** at the end.

## Prompt A - Scaffold, Architecture, Tokens

```txt
You are a senior product engineer and product designer. Build a clean Cactus Club V2 app from scratch at apps/cactus-club-v2.

Goal:
Create the foundation for a premium Austin nightlife discovery app called Cactus Club. It should feel warm, Apple-like, glassy, helpful, and modern. Mobile is primary. Desktop should feel editorial and spacious.

Tech:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- lucide-react
- lottie-react
- Supabase persistence and storage
- local JSON seed/cache fallback
- localStorage for saved state
- auth-ready anonymous browsing
- protected submission review actions

Architecture:
Create a feature-oriented folder structure:
- app routes for /today, /explore, /places, /places/[venueId], /plan, plus root redirect/entry
- components/app-shell
- components/cards
- components/discovery
- components/explore
- components/places
- components/plan
- components/ui
- lib/data
- lib/domain
- lib/storage
- lib/theme
- lib/utils
- scripts
- public/data

Design system:
Set up CSS variables for colors, typography, radii, shadows, glass surfaces, and focus states. Default to dark brand mode but support auto theme based on time of day, with user override for auto/dark/light stored in localStorage.

Build:
1. Install needed dependencies.
2. Configure Tailwind and Next image remote patterns.
3. Create the app shell with top bar and mobile bottom nav.
4. Add route shells for Today, Explore, Places, Plan, Submit, Review, and venue detail.
5. Add reusable UI primitives: GlassPanel, EmptyState, Skeleton, SafeImage, LottieIcon, Drawer.
6. Add route loading skeleton.
7. Verify with npm run typecheck and npm run build.

Do not build the full product yet. Focus on clean architecture, tokens, shell, routing, and reusable primitives.
```

Acceptance criteria:

- `apps/cactus-club-v2` exists.
- Four primary tabs exist.
- Root opens to Today.
- Theme provider supports `auto`, `dark`, `light`.
- Supabase environment validation exists.
- UI primitives exist.
- Build passes.

## Prompt B - Data Pipeline, Domain Model, Enrichment

```txt
Continue Cactus Club V2.

Build the complete data/domain layer before UI features.

Data source:
The app seeds from a published Google Sheets document with CSV tabs for:
- events
- evergreen_events
- evergreen_venues

Production runtime should use Supabase when configured. Local JSON from public/data is a seed/cache fallback. The Google Sheet is fetched by scripts/import-events.mjs, then data is normalized for both JSON output and Supabase upsert.

Tasks:
1. Create lib/domain/types.ts with Area, VibeTag, MoveIntent, EventItem, VenueItem, EvergreenEventItem, EvergreenVenueItem, ScoreSet, SavedState, UserLocation.
2. Create lib/domain/time.ts:
   - upcoming-event filters
   - today/tomorrow/weekend/next-week helpers
   - date range matching
   - soonest sorting
   - display helpers that avoid redundant dates/times
3. Create lib/domain/areas.ts:
   - area display labels
   - neighborhood personality copy
   - venue override map
   - area inference from venue name, address, zip, and known Austin heuristics
   - display Burbs as Suburbs
4. Create lib/domain/vibes.ts:
   - derive vibe tags from title, category, venue, area, time, popularity, free/paid, recurring
5. Create lib/domain/scoring.ts:
   - smart, popular, weird, dateNight, social, lowKey, wellness, nearby
   - scoring should never be visible in UI
6. Create lib/domain/recommendations.ts:
   - chooseForMove
   - category rails
   - weather-matched events
   - personalized scoring using saved preferences
7. Create lib/location.ts and lib/weather.ts:
   - distance calculation
   - browser location type
   - Open-Meteo weather adapter
8. Create lib/data:
   - local-data-source.ts
   - supabase-data-source.ts production adapter
   - repository.ts
   - normalize.ts
   - submissions.ts
   - moderation.ts
9. Create scripts/import-events.mjs:
   - fetch CSV tabs
   - parse CSV robustly
   - normalize events
   - derive venues
   - enrich areas, tags, scores
   - write public/data/events.json, venues.json, evergreen-events.json, evergreen-venues.json, import-report.json
   - upsert approved seed records into Supabase when environment variables are configured
   - drop invalid rows
   - keep only upcoming event records where appropriate
10. Create Supabase SQL migrations for events, venues, evergreen_events, evergreen_venues, submissions, submission_audit_log, and required indexes.
11. Add submission schemas for submit event, venue, evergreen event, and evergreen venue.
12. Add npm scripts import:data and db:types or documented type generation.

Important:
- Keep domain logic framework-independent.
- UI must import from repository/domain helpers, not reimplement rules.
- Use graceful fallbacks for missing images and missing venues.

Verify:
- npm run import:data
- basic JSON counts are printed
- npm run typecheck
- npm run build
```

Acceptance criteria:

- Import pipeline writes all JSON files.
- Supabase schema/migrations are included.
- Supabase adapter can browse and upsert seed data when env vars are present.
- Submission and moderation types are included.
- Events and venues have stable IDs.
- Past events do not appear in app feeds.
- Domain helpers are independently reusable.

## Prompt C - App State, Storage, Shell Behavior

```txt
Continue Cactus Club V2.

Build app state, persistence, shell behavior, and cross-page UX.

Tasks:
1. Create localStorage hooks for:
   - savedEvents
   - savedVenues
   - hiddenEvents
   - preferredVibes
   - preferredAreas
   - userLocation
   - themeMode
2. Saved behavior:
   - saved events persist through reload
   - expired saved events are pruned automatically
   - saved venues remain
   - plan count badge updates across app
   - plan nav item animates when something is saved
3. Location behavior:
   - header location dropdown includes Use my location, Downtown, East Side, South Austin, Barton/Zilker, North Austin, Suburbs, Central/Mueller
   - selecting a neighborhood on non-Places pages routes to /explore?area=
   - selecting a neighborhood on Places keeps the user on Places
   - current location enables nearby sorting and distance labels
4. Weather behavior:
   - fetch Open-Meteo for user location or Austin fallback
   - cache enough in component state to avoid jank
   - degrade gracefully if API fails
5. App shell:
   - sticky glass top bar
   - mobile glass bottom nav
   - desktop pill nav
   - Lottie-style nav icons
   - accessible focus states
6. Event detail:
   - clicking an event opens a bottom sheet on mobile
   - opens a side drawer on tablet/desktop
   - drawer includes all event details and outbound links
7. Data loading:
   - repository load with module-level cache
   - skeletons while loading
   - no blank app states
8. Submission state:
   - create submit flows for event, venue, evergreen event, and evergreen venue
   - validate each submission with typed schemas
   - save submissions to Supabase with status pending
   - show friendly success and error states
9. Review state:
   - create protected review surface for pending submissions
   - approve submissions into canonical tables
   - reject submissions with reason
   - write submission_audit_log records

Verify:
- save/unsave persists through reload
- plan count increments
- expired saved events prune
- location dropdown routes correctly
- submit flows create pending submissions
- review flow can approve/reject pending submissions
- app works if weather fails
- npm run typecheck
- npm run build
```

Acceptance criteria:

- State is centralized and predictable.
- No page loses its URL on refresh.
- User can browse, save, reload, and see the same plan.

## Prompt D - Today/Home Discovery Experience

```txt
Continue Cactus Club V2.

Build the Today page as the main product experience. It should feel like a friendly best-friend AI helping plan the day, not a feed dump.

Page goals:
- Open directly into Today.
- Tell a clear scrolling story.
- Show today, tomorrow, this weekend, and next week in a logical progression.
- Reduce decision fatigue.
- Use carousels and asymmetry where useful.
- Avoid giant equal grids.

Required sections:
1. Narrative intro:
   - time-aware greeting
   - clear value proposition
   - friendly copy
2. Weather widget:
   - uses current weather
   - recommends indoor/outdoor events based on weather
   - no extra noisy icons
3. Pick a lane:
   - category grid on mobile
   - single row or compact grid on desktop
   - Lottie-style icons
   - categories link to Explore with URL params
4. What's the move:
   - signature interaction
   - compact button/chip controls
   - vibe, energy, who-with choices
   - returns exactly 3 curated picks
5. Make your plan:
   - Today, Tomorrow, Weekend, Next week controls
   - event carousel, full bleed to the right but aligned to section title on the left
6. More lanes:
   - rows of carousels for live music, comedy, date night, free, weird Austin, etc.
   - icons by titles in Lottie style with no circle fill
7. Evergreen discovery:
   - Tinder-like idea card for evergreen activities
   - refresh card to show another idea
   - save venue and link to venue page
8. Don't miss out:
   - top 3 popular events today

Event cards:
- Focus on title, image, date, time, venue, area
- Whole card is clickable
- No Details button
- Bottom gradient for title readability
- Save button top right
- Use tags sparingly

Motion:
- soft page entrance
- staggered sections
- gentle hover lift
- smooth carousel feel
- no bouncy gimmicks

Verify:
- mobile has no horizontal overflow
- content is readable on cards
- Today's weather picks only use today events
- carousels align left with section titles and bleed right
- npm run typecheck
- npm run build
```

Acceptance criteria:

- Today feels like a narrative, not a database.
- User can find 2-3 good options quickly.
- The app feels warm, premium, and Austin-native.

## Prompt E - Explore, Places, Plan, Venue Pages

```txt
Continue Cactus Club V2.

Build the secondary product surfaces: Explore, Places, Plan, and Venue detail pages.

Explore:
1. Build a one-line mobile browse bar:
   - search
   - date
   - vibe
   - area
   - clear/results
   - horizontal scroll on mobile, no wrapping
2. Date picker:
   - sexy but usable calendar
   - one day or range
   - hover preview for range on desktop
   - selected state is obvious
   - no past date selection
   - URL params persist selected dates
3. Vibe dropdown:
   - same categories and Lottie-style icons from Today
4. Area dropdown/chips:
   - filters correctly
   - Burbs displays as Suburbs
   - Suburbs means outside central Austin, not in-town
5. Results:
   - sort soonest to latest by default
   - nearby sort when location mode selected
   - progressively render results
   - show all relevant results, not hard capped at 10
   - cards fill gaps after filtering

Places:
1. Not a directory.
2. Use carousel rows:
   - Popular hang outs
   - Browse by neighborhood
   - Browse by kind of night
   - Patio Weather
   - Live Music Institutions
   - Music-first rooms
   - Comedy-adjacent places
   - Nearby if location is enabled
3. Venue cards:
   - real image with fallback
   - vibe
   - area
   - upcoming count or evergreen ideas
   - save action
   - map/site action
   - link to venue detail page

Plan:
1. Feels like "your upcoming life", not a saved list.
2. Modes:
   - Timeline
   - Neighborhood
   - Places
3. Filters:
   - area dropdown
   - sort by soonest, popular, neighborhood
4. Cards:
   - neighborhood tags
   - X remove button
   - no "Saved" label
5. Empty state:
   - "No plans yet. Let's fix that."

Venue detail pages:
1. URL per venue.
2. Back to Places.
3. Hero image and venue vibe.
4. Saved venue button.
5. Upcoming events at that venue.
6. Evergreen ideas at that venue.
7. Outbound venue URL and map URL.
8. Event cards open the global event detail drawer.

Verify:
- all pages have URLs and refresh correctly
- filters update URL state
- saved state persists
- venue pages work from card click and browser refresh
- npm run typecheck
- npm run build
```

Acceptance criteria:

- Explore is useful without becoming enterprise software.
- Places supports browsing by neighborhood and category.
- Plan is functional and emotionally coherent.

## Prompt F - A-F Polish, Performance, QA, Production Readiness

```txt
Finish Cactus Club V2 with a senior product designer, frontend engineer, and creative director polish pass.

Audit the entire app and improve:
- visual design
- UX flow
- component polish
- animation quality
- brand tone
- mobile responsiveness
- accessibility
- loading behavior
- performance
- production readiness

Design direction:
- friendly best-friend AI
- Apple-level simplicity
- glass/translucent panels where tasteful
- warm, calm, premium
- not a finance dashboard
- not generic Tailwind
- not cluttered

Blunt review requirements:
1. Identify the top 10 product/design problems in the current implementation.
2. Fix them directly.
3. Keep changes maintainable.
4. Do not overcomplicate the app.

Component polish:
- spacing
- border radius
- shadows
- hover states
- focus states
- empty states
- loading states
- microcopy
- mobile behavior
- accessibility
- subtle animation

Motion:
- soft page entrance
- staggered cards where useful
- gentle hover lift
- smooth panel transitions
- input focus animation
- loading shimmer/skeleton
- no distracting bounce

Performance:
- module-level data cache
- lazy render heavy sections
- progressive result rendering
- use next/image with configured remote hosts
- avoid avoidable re-renders
- avoid one giant file if possible
- avoid repeated data scans where maps/selectors help

Theme:
- verify auto day/night theme
- verify user override
- keep tokens variable-driven

QA checklist:
- mobile Today no overflow
- Explore date range works
- Explore area filter works
- Explore sorts soonest to latest
- weather picks use today's events
- save/unsave persists through reload
- Plan badge animates
- Plan filters and modes work
- Places carousels work
- venue pages refresh correctly
- event drawer opens from all cards
- fallback images work
- no past events in feeds or Plan
- typecheck passes
- build passes

After edits:
1. Run npm run typecheck.
2. Run npm run build.
3. Restart the dev server.
4. Summarize the most important design and architecture changes.
```

Acceptance criteria:

- App feels client/investor-ready.
- No known design or technical debt is intentionally left in the prompt-built version.
- Build and typecheck pass.

## Master Prompt

Use this if you want one stacked prompt instead of six separate prompts.

```txt
You are a senior product designer, frontend engineer, creative director, and pragmatic architect.

Build Cactus Club V2 from scratch at apps/cactus-club-v2.

Product:
Cactus Club is a premium Austin nightlife and social discovery app. It helps socially active Austin users find what to do today, tonight, this weekend, and soon. It is about vibes, confidence, and momentum, not event-calendar browsing.

The app should feel like a friendly best-friend AI:
- warm
- helpful
- premium
- Apple-like
- glassy where tasteful
- calm
- modern
- culturally Austin-native

Use Airbnb for warmth, Walmart for obvious practical actions, Yelp for local/actionable discovery, Spotify for confident recommendations, and Apple for simplicity.

Avoid:
- finance dashboard
- CRUD app
- generic Tailwind template
- Eventbrite clone
- giant equal grids
- filter-heavy database UX
- random gradients
- over-animation

Tech:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- lucide-react
- lottie-react
- Supabase production persistence
- local JSON seed/cache fallback
- Google Sheets CSV import script
- submission and moderation workflows
- localStorage for personal saved state
- auth-ready anonymous browsing with protected review actions

Architecture:
Create a feature-oriented app with:
- app routes: /today, /explore, /places, /places/[venueId], /plan
- components/app-shell
- components/cards
- components/discovery
- components/explore
- components/places
- components/plan
- components/ui
- lib/data
- lib/domain
- lib/storage
- lib/theme
- lib/utils
- scripts
- public/data

Data:
Create scripts/import-events.mjs to fetch published Google Sheets CSV tabs for events, evergreen_events, and evergreen_venues. Normalize and enrich into public/data/events.json, venues.json, evergreen-events.json, evergreen-venues.json, and import-report.json. Runtime reads local JSON only.

Add a repository/data-source abstraction so UI never talks directly to Supabase or local JSON. Supabase is the production adapter. Local JSON is the fallback adapter for static preview/offline development. Include submission and moderation APIs in the repository from the beginning.

Submission/review:
Build submit flows for events, venues, evergreen events, and evergreen venues. Submissions save to Supabase as pending records. Build a protected review surface to approve, reject, archive, and audit submissions. Approved submissions must become canonical browseable records.

Domain:
Implement framework-independent helpers for:
- time filtering
- date ranges
- soonest sorting
- area inference
- area display labels
- vibe tagging
- invisible scoring
- recommendations
- weather matching
- distance calculations

Theme:
Build variable-driven design tokens. Default to auto theme. Auto should use light mode during the day and dark mode at night. Let the user override auto/dark/light in localStorage. Keep colors, fonts, shadows, radii, and glass surfaces easy to change.

App shell:
Build sticky glass top nav and mobile bottom nav with four tabs only:
- Today
- Explore
- Places
- Plan

Use Lottie-style animated nav icons and category icons. Add Plan badge animation when saving.

State:
Use localStorage for:
- savedEvents
- savedVenues
- hiddenEvents
- preferredVibes
- preferredAreas
- userLocation
- themeMode

Saved events persist and prune when expired. Saved venues remain.

Today:
Build the main narrative discovery page:
- time-aware intro
- weather widget with today-only weather-matched events
- Pick a lane category grid/row
- What's the move signature recommender returning exactly 3 picks
- Make your plan timeline for Today, Tomorrow, Weekend, Next week
- More lanes carousel rows
- Evergreen discovery refreshable idea card
- Don't miss out top 3 popular events today

Explore:
Build a one-line mobile browse bar with search, date, vibe, area, and clear/results. Add a usable date picker supporting single-day and range selection, no past dates, hover range preview, selected state, and URL persistence. Vibe dropdown uses category Lottie icons. Area filter works correctly and displays Burbs as Suburbs. Results sort soonest to latest and progressively render all relevant results.

Places:
Build a non-directory Places experience using carousel rows:
- Popular hang outs
- Browse by neighborhood
- Browse by kind of night
- Patio Weather
- Live Music Institutions
- Music-first rooms
- Comedy-adjacent places
- Nearby if location is enabled

Venue cards show image, vibe, area, upcoming count/evergreen ideas, save, map/site action, and link to venue detail.

Plan:
Build a saved itinerary experience:
- "Your upcoming life"
- modes: Timeline, Neighborhood, Places
- area dropdown
- sort by Soonest, Popular, Neighborhood
- event cards with X remove and neighborhood tags
- venue cards with X remove
- empty state: "No plans yet. Let's fix that."

Venue pages:
Every venue has a URL and refreshes correctly. Include hero image, vibe, area, save, map/site links, upcoming events, evergreen ideas, and Back to Places. Event cards open global event drawer.

Event details:
Clicking an event opens a bottom sheet on mobile and side drawer on tablet/desktop. It includes all event information and outbound links. Remove separate Details buttons because the whole card is clickable.

Design polish:
Perform a full senior product design review and fix the top problems. Make the app feel friendly, premium, Apple-like, glassy, warm, and calm. Improve spacing, hierarchy, typography, cards, buttons, inputs, empty states, loading states, focus states, hover states, and animation quality.

Performance:
Use module-level data caching, memoized selectors, progressive result rendering, lazy rendering of lower homepage sections, Next Image, image fallbacks, and minimal re-renders.

Verification:
Run:
- npm run import:data
- npm run typecheck
- npm run build

Then restart the dev server and summarize the architecture, product decisions, and verification results.
```

## Build Quality Rules

- Keep the domain layer independent from React.
- Keep data loading behind a repository.
- Keep theme decisions variable-driven.
- Keep components small enough to reason about.
- Never duplicate area/vibe/scoring rules in UI components.
- Never expose raw score numbers in the UI.
- Avoid visible algorithm language.
- Use Supabase for production runtime.
- Keep local JSON as seed/cache fallback, not the architecture.
- Build submission and review workflows in the main scope.
- Make mobile primary.
- Use routes, not tab-only state, so refresh preserves page.
- Keep every major UI state accessible by keyboard.
- Keep animation subtle and fast.
- Keep copy short, human, and helpful.

## Final QA Checklist

Run this before considering V2 done:

- App opens to Today.
- Only four primary tabs exist.
- All pages have URLs and survive refresh.
- Today has no mobile overflow.
- Today reads as a narrative, not a feed.
- Weather section degrades gracefully.
- Weather recommendations only use today events.
- Pick a lane links to Explore with URL params.
- What's the move returns exactly three events.
- Explore date picker selects one day and ranges.
- Explore blocks past date selection.
- Explore area filter works.
- Suburbs means out-of-town venues.
- Explore results sort soonest to latest unless nearby mode is selected.
- Explore shows all relevant results progressively.
- Event cards are clickable and do not show Details buttons.
- Event drawer opens on mobile and desktop.
- Submit event, venue, evergreen event, and evergreen venue flows work.
- Submitted records enter pending moderation.
- Review queue can approve/reject/archive submissions.
- Approved submissions appear in browse surfaces.
- Saved events persist after reload.
- Expired saved events are pruned.
- Saved venues persist.
- Plan badge animates on save.
- Plan modes work.
- Places carousels work.
- Venue pages show events for the selected venue.
- Venue page back link works.
- Fallback images work.
- Theme auto/dark/light works.
- Typecheck passes.
- Build passes.

## Why This V2 Plan Avoids The Current App's Debt

The current implementation reached a strong product state through repeated tactical changes. That created avoidable complexity:

- too much app behavior in one large file
- UI and domain logic close together
- repeated area/vibe decisions
- design decisions embedded in one-off class strings
- data source assumptions coupled to local JSON
- submission, moderation, and persistence features added after layout choices had already hardened

V2 fixes that by:

- defining domain rules before UI
- isolating data sources behind a repository
- using feature-based components
- centralizing design tokens and theme behavior
- making routes first-class from the beginning
- building the core jobs-to-be-done in the right order
- making Supabase, submissions, and moderation part of the initial architecture
- including polish and QA as a required final prompt, not an afterthought
