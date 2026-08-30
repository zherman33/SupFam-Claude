# Active Linear Tasks — Sup Fam

*Last synced: 6/3/2026, 6:50:57 PM*

### [Z33-41] Family chat workflow - iMessage style with assistant capability
- **Status**: `Backlog`
- **Assignee**: Unassigned [Low]
- **Description**:
  ```
  ## Vision
  
  Supfam should function like iMessage for families - a natural, real-time IM experience where you can talk to family members or have someone as an "assistant" to coordinate.
  
  ## Problem
  
  Current roadmap has no real-time chat functionality. Families need:
  
  * Natural IM-style conversations (like iMessage)
  * Ability to tag/mention family members
  * One person (or AI assistant) can coordinate tasks/events
  * Real-time updates visible to all
  
  ## Acceptance Criteria
  
  - [ ] Real-time chat interface with family members
  - [ ] Thread/conversation support
  - [ ] Ability to attach tasks/events from chat
  - [ ] "Assistant mode" - one person responds to questions about family schedule
  - [ ] Push notifications for family messages
  - [ ] Works seamlessly on iPad ambient display
  ```

### [Z33-40] Birthday/holiday placement: move to bottom of day column, not bottom of tile
- **Status**: `In Progress`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Problem
  
  Birthdays and holidays pinned to the bottom of individual day tiles looks disorganized, especially when multiple birthdays/holidays stack. The tile-level grouping creates visual clutter.
  
  ## Proposed change
  
  Move birthdays and holidays to the bottom of the full day *column* (below all personal events across the visible range), rather than the bottom of each individual tile.
  
  This keeps them de-emphasized without fragmenting them across tiles.
  
  ## Open question
  
  This may need a design test — the exact behavior in 3-week view (where columns are narrow) versus month view needs validation. Consider:
  
  * 3-week view: birthdays/holidays in a subtle row at the very bottom of the column
  * Month view: test without sidebar first to assess space
  
  ## Acceptance criteria
  
  * Birthdays and holidays are no longer at the bottom of individual day tiles
  * They appear at the bottom of the day column, below all personal events
  * Visual result looks more organized than current tile-bottom placement
  ```

### [Z33-37] Auth session validation: harden for Vercel serverless deployment
- **Status**: `Backlog`
- **Assignee**: Unassigned [Urgent]
- **Description**:
  ```
  ## Overview
  
  Audit and harden the custom session-based auth, and ensure it is properly adapted for Vercel's serverless deployment model. The current Express 5 session auth was built for a persistent server and needs validation in the Vercel environment.
  
  ## Known issues
  
  * Express session middleware requires sticky sessions or a shared session store (e.g. Redis, Postgres) to work across serverless function invocations
  * Session cookies may not persist correctly between API calls in serverless context
  
  ## Scope
  
  * Audit current session configuration against Vercel serverless constraints
  * Implement a shared session store (Postgres-backed via `connect-pg-simple` or equivalent)
  * Validate auth works end-to-end: login → session → protected API routes → logout
  * Ensure session expiry and refresh are handled correctly
  * Test on Vercel preview deployment before merging to main
  
  ## Acceptance criteria
  
  * Login persists correctly across page refreshes on Vercel
  * Protected API routes reject unauthenticated requests correctly
  * Session survives multiple serverless cold starts
  * No regressions to existing household data access
  ```

### [Z33-36] Google Calendar write-back: create events from Sup Fam
- **Status**: `Backlog`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Overview
  
  Allow users to create calendar events from within Sup Fam that write back to their connected Google Calendar. Currently events can only be read from Google Calendar — creation is missing.
  
  ## Scope
  
  * "Add Event" flow from the calendar view creates an event in Google Calendar via the Google Calendar API
  * Event appears immediately in Sup Fam (optimistic update or fast refetch)
  * Supports: title, date, start/end time, all-day toggle
  * Event is attributed to the creating family member's connected calendar
  
  ## Technical notes
  
  * Requires Google Calendar API write scope (`https://www.googleapis.com/auth/calendar.events`)
  * Users who connected with read-only scope must re-authenticate — handle this gracefully with a prompt
  * Use stored `provider_token` for API auth; refresh if expired
  
  ## Acceptance criteria
  
  * Creating an event in Sup Fam creates it in Google Calendar
  * Event appears in Sup Fam calendar within one refresh cycle
  * Re-auth prompt shown if write scope is missing
  * Error state handled gracefully if API call fails
  ```

### [Z33-35] Home Projects: module with lifecycle stages, budget field, and task linking
- **Status**: `Backlog`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Overview
  
  Add a Home Projects module to Sup Fam for tracking household improvement and maintenance projects shared across the family. Projects are distinct from tasks — they have a lifecycle, a budget, and can contain multiple associated tasks.
  
  ## Data model (new table: `home_projects`)
  
  | Field | Type | Notes |
  | -- | -- | -- |
  | id | uuid | PK |
  | household_id | uuid | FK → households |
  | title | text | Required |
  | description | text | Optional |
  | stage | enum | See lifecycle stages below |
  | budget_estimate | numeric | Optional, dollar amount |
  | created_by | uuid | FK → users |
  | created_at | timestamp |  |
  | updated_at | timestamp |  |
  
  ## Lifecycle stages (enum)
  
  * `idea` — just a thought, not committed
  * `planning` — actively being scoped
  * `active` — in progress
  * `on_hold` — paused
  * `done` — completed
  
  ## Surfacing rules
  
  * Only `active` projects surface their associated tasks in the main household task list
  * All other stages are visible in the Home Projects view only
  
  ## UI
  
  * New "Projects" section in the dashboard (collapsed by default in ambient mode)
  * Project cards show: title, stage badge, budget estimate if set, task count
  * Tapping a project card opens a detail view with description, stage controls, and linked tasks
  * Creating a task from within a project auto-links it to that project
  
  ## Acceptance criteria
  
  * Can create, edit, and delete home projects
  * Can set and change lifecycle stage
  * Active project tasks appear in the main task list
  * Budget estimate field is optional and displays as currency
  * Schema migration is clean with no breaking changes to existing tasks table
  ```

### [Z33-34] Voice assistant: tap-to-activate for grocery and task capture
- **Status**: `Backlog`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Overview
  
  Add a voice assistant to Sup Fam for quick, hands-free household capture. The primary use case is standing in the kitchen — hands full — and being able to add a grocery item or task without touching the screen.
  
  ## Activation model
  
  * Tap-to-activate (no always-on wake word in v1 — too much complexity, privacy concern)
  * A single mic button in the dashboard UI triggers the listening state
  * Visual feedback: pulsing indicator while listening, confirmation flash when item is captured
  
  ## Scope for v1
  
  * Voice-to-task: "Add buy milk to groceries" → creates grocery item
  * Voice-to-task: "Add clean the garage to tasks" → creates task assigned to speaker's profile
  * Uses Web Speech API (browser-native, no third-party API required for v1)
  * Fallback: if speech not recognized, show text input pre-filled with best guess
  
  ## Out of scope for v1
  
  * Wake word / always-on listening
  * Calendar event creation via voice
  * Natural language date parsing ("add dinner reservation for next Friday")
  * Multi-step voice flows
  
  ## Design requirements
  
  * Mic button uses warm terracotta accent, positioned accessibly on iPad landscape layout
  * Listening state is visually obvious from across the room
  * Confirmation is brief and non-intrusive
  
  ## Acceptance criteria
  
  * Tapping mic button activates listening on iPad
  * Spoken grocery items are added to grocery list
  * Spoken tasks are added to task list
  * Works reliably on iPad Safari (primary target browser)
  ```

### [Z33-33] Rebuild task panel as left sidebar with Today / Unscheduled / Scheduled tiers
- **Status**: `In Progress`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Overview
  
  Rebuild the task panel as a left sidebar with a three-tier layout. The bottom task bar becomes the minimized/ambient state — it stays but is no longer the primary expanded view.
  
  ## Sidebar layout (top to bottom)
  
  1. **TODAY'S EVENTS** — compact list of today's calendar events, same data source as calendar
  2. **UNSCHEDULED TASKS** — tasks with no due date; float to top for immediate attention
  3. **SCHEDULED TASKS** — tasks with a due date, sorted ascending
  
  When a task gets a due date assigned, it moves from section 2 → section 3 automatically.
  
  ## Design requirements
  
  * Fixed-width left column (\~280–320px), iPad landscape
  * DM Sans for task text, Instrument Serif for section labels
  * High-contrast task text (near-black) — must be readable from a distance
  * Warm cream / terracotta palette throughout
  * Bottom task bar stays as collapsed/ambient state
  
  ## Acceptance criteria
  
  * Sidebar shows three distinct sections with correct content in each
  * Assigning a due date to a task moves it to Scheduled section
  * Today's Events section reflects current day's calendar
  * Bottom bar still present as minimized view
  * UI-only change — no data model changes required
  ```

### [Z33-32] Calendar event display: row height, font size, birthday/holiday ordering
- **Status**: `In Progress`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Problem
  
  Live iPad feedback session (April 9, 2026) identified three related calendar display issues:
  
  1. Personal event text is too small to read from across the room
  2. Birthdays and holidays are visually mixed with personal events — they should be visually separated and de-emphasized
  3. Today's date indicator does not stand out enough on the display
  
  ## Changes required
  
  ### Event row height + font
  
  * Personal calendar events: render at 2x row height with proportionally larger font
  * Birthdays and holidays: stay single-line, small font (no change)
  
  ### Day cell ordering
  
  * Personal events: rendered at TOP of day cell
  * Birthdays and holidays: rendered at BOTTOM of day cell, always below personal events
  * Sort is render-time only — no data model changes
  
  ### Today indicator
  
  * Today's date column/cell needs significantly stronger visual treatment
  * Use terracotta/warm cream palette — pill, bold date number, or colored background
  * Must read clearly at a glance from across the room
  * Apply to both 3-week view (primary) and 1-week view
  
  ## Acceptance criteria
  
  * Personal events are readable from \~2m distance on iPad Pro
  * Birthdays and holidays render below personal events in each day cell
  * Today is immediately identifiable without a label
  ```

### [Z33-29] Build the Sup Fam marketing site
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Create the public-facing landing page with a warm cream background, Caveat accents, casual copy tone, and hero positioning around the idea of the iPad on the counter.
  ```

### [Z33-28] Create a handwriting accent font
- **Status**: `Backlog`
- **Assignee**: Unassigned [Low]
- **Description**:
  ```
  Commission or create a custom font based on a family member's handwriting to use as the personality accent font in the product and marketing site.
  ```

### [Z33-27] Add real-time multi-user sync
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  When two family members are using the product at the same time, changes should reflect without a manual refresh. Options include PostgreSQL LISTEN/NOTIFY or a polling strategy, and the added complexity should be validated early.
  ```

### [Z33-24] Add Microsoft Outlook calendar integration
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Implement calendar integration for Outlook and Exchange users through Microsoft Graph API, parallel to the Google Calendar integration path.
  ```

### [Z33-18] 3-week calendar view doesn't center on current week
- **Status**: `In Progress`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  On load, the 3-week calendar view does not scroll or snap to the current week.
  ```

### [Z33-17] Add family-aware calendar colors and filters
- **Status**: `Backlog`
- **Assignee**: Unassigned [High]
- **Description**:
  ```
  ## Goal
  
  Make shared family schedules readable at a glance by clearly attributing events to the right family member.
  
  ## Scope
  
  * color-code event blocks by owning family member
  * use member avatarColor for Google-sourced events and family-created events when possible
  * add colored left borders on event blocks
  * add member filter chips in the calendar header using the existing filter pill pattern
  * add a member color legend so attribution is obvious
  
  ## Acceptance criteria
  
  * family events and Google events display a member-aware color treatment
  * calendar can filter to All or a specific family member
  * color legend is visible and matches event presentation
  * fallback behavior uses the event's own color when no member match is available
  
  ## Notes
  
  Avoid frontend-only hacks if data is missing. If needed, add a cleaner owner field so Google and local events can be filtered consistently.
  ```

### [Z33-16] Calendar auto-refresh: deleted events persisting, new events not appearing
- **Status**: `In Progress`
- **Assignee**: Unassigned [Urgent]
- **Description**:
  ```
  ## Problem
  
  Two related refresh bugs identified during live iPad testing (April 9, 2026):
  
  1. Deleted Google Calendar events continue to appear after deletion
  
  ## Fix
  
  * Set refetchInterval to 60 seconds on calendar events query via TanSt`ack React Query`
  * Add tap-to-refresh on the month/week header — tapping triggers an immediate refetch and shows a small inline spinner to the right of the month label during the active refresh
  * No permanent refresh button — spinner is transient only
  
  ## Acceptance criteria
  
  * Deleted events disappear within 60 seconds without manual reload
  * New events appear within 60 seconds without manual reload
  * Tapping the header triggers immediate refetch with visible spinner
  * Spinner disappears when refetch completes
  ```

### [Z33-15] Apple Reminders: Support task due datetimes and migration
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Repo analysis found that Sup Fam task `dueDate` is currently date-only, while Apple Reminders can support due date plus time.
  
  This issue decides and implements the task time model needed for reliable two-way sync.
  
  Scope:
  
  * Decide long-term product behavior for date-only vs timed tasks
  * Add due datetime support to the schema, or explicitly define lossy sync behavior if not
  * Define backward compatibility and migration behavior for existing tasks
  * Update API contracts and generated client types
  * Update create/edit task UI behavior for date-only vs timed tasks
  * Define how imported Apple reminders with times are represented in Sup Fam
  
  Recommendation:
  
  * Move toward datetime support now to avoid a permanently lossy Apple sync model later.
  ```

### [Z33-14] Apple Reminders: Define sync triggers and background refresh
- **Status**: `Backlog`
- **Assignee**: Unassigned [Low]
- **Description**:
  ```
  Define and implement when sync runs.
  
  Subtasks:
  
  * Sync on app open
  * Sync on pull-to-refresh
  * Sync after create/edit/complete actions
  * Add safe background refresh pattern where supported
  ```

### [Z33-13] Apple Reminders: Sync edits both ways
- **Status**: `Backlog`
- **Assignee**: Unassigned [Low]
- **Description**:
  ```
  Implement two-way edit sync for title, notes, and due date.
  
  Subtasks:
  
  * Apple → Sup Fam edit sync
  * Sup Fam → Apple edit sync
  * Last-modified-wins conflict rule
  * Basic conflict logging for debugging
  ```

### [Z33-12] Apple Reminders: Model sync metadata and external IDs
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Create data model to support syncing with Apple Reminders.
  
  Repo-grounded additions:
  
  * Current Sup Fam tasks are family-scoped and `dueDate` is currently date-only.
  * There is no provider-agnostic sync metadata layer yet.
  * This issue should establish the sync model needed for Apple now and future providers later.
  
  Scope:
  
  * Add external_id field or dedicated external object mapping
  * Add provider field (e.g. apple_reminders, future google_tasks)
  * Add source field (supfam | imported)
  * Add visibility field (family | personal)
  * Add last_modified_at
  * Add last_synced_at
  * Add last_updated_by (prevent loops)
  * Add sync_status
  * Define delete/archive/tombstone strategy
  * Define whether metadata lives directly on tasks or in a dedicated sync table
  
  Notes:
  
  * Treat Apple Reminders as a per-user native bridge, not a family-wide account connection.
  * Design this to avoid painting the product into an Apple-only corner.
  ```

### [Z33-11] Apple Reminders: Sync task completion both ways
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Implement two-way completion sync between Apple Reminders and Sup Fam tasks.
  
  Subtasks:
  
  * Sup Fam → Apple completion sync
  * Apple → Sup Fam completion sync
  * Prevent sync loops using last_updated_by or similar flag
  ```

### [Z33-10] Apple Reminders: Create reminders from Sup Fam tasks
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Enable creating an Apple Reminder when a Sup Fam task is created.
  
  Subtasks:
  
  * Add "Sync to Apple Reminders" toggle
  * Create reminder via EventKit
  * Store external_id
  * Assign to selected list
  ```

### [Z33-9] Apple Reminders: Import reminders into Sup Fam
- **Status**: `Backlog`
- **Assignee**: Unassigned [Medium]
- **Description**:
  ```
  Import reminders from Apple into Sup Fam.
  
  Subtasks:
  
  * Fetch reminders from selected lists
  * Map fields (title, notes, due date, completed)
  * Store external_id
  * Tag source as apple
  ```

### [Z33-8] Apple Reminders: Select reminder lists
- **Status**: `Backlog`
- **Assignee**: Unassigned [Low]
- **Description**:
  ```
  Allow users to select which Apple Reminder lists to sync.
  
  Subtasks:
  
  * Fetch available reminder lists
  * Multi-select list picker UI
  * Save selected lists
  * Set default list for Sup Fam tasks
  ```

### [Z33-7] Apple Reminders: Connect account with EventKit
- **Status**: `Backlog`
- **Assignee**: Unassigned [Low]
- **Description**:
  ```
  Implement native iOS permission flow for accessing Apple Reminders using EventKit.
  
  Subtasks:
  
  * Request reminders permission (read/write)
  * Handle permission denied state
  * Persist connection state per user
  * Add reconnect / disconnect logic
  ```

### [Z33-4] Import your data
- **Status**: `Todo`
- **Assignee**: Unassigned
- **Description**:
  ```
  Sync data between Linear and your other tools.
  
  ![import-your-data.png](https://uploads.linear.app/fe63b3e2-bf87-46c0-8784-cd7d639287c8/80d7e050-dd1f-4d4f-8257-b29c16087017/65c16454-30f3-4f4a-8f25-c2428d64ff57)
  
  Whether you're exploring Linear, running a pilot, or ready for full migration, we’ve got you covered. 
  
  ### **Exploring Linear:**
  
  * [**Pitch Linear**](https://linear.app/switch/pitch-guide)
    Build your business case and get organizational buy-in
  * [**Run a pilot**](https://linear.app/switch/pilot-guide)
    Test Linear with a small team before rolling out company-wide
  
  ### **Ready to migrate:**
  
  * [**Migration guide**](https://linear.app/switch/migration-guide) 
    Step-by-step process for importing data and rolling out Linear
  
  ---
  
  If you have any questions hit `?` in the bottom left > Contact us.
  
  ![contactlinear (1).gif](https://uploads.linear.app/fe63b3e2-bf87-46c0-8784-cd7d639287c8/191f6985-8562-4f62-9482-a094b69c4756/0e4ff63b-3da2-4699-912b-04afb68511e8)
  ```

### [Z33-3] Connect your tools
- **Status**: `Todo`
- **Assignee**: Unassigned
- **Description**:
  ```
  Integrations turn Linear into your source of truth around product development. Keep data in sync, and eliminate manual updates between tools.
  
  ![connect-your-tools.png](https://uploads.linear.app/fe63b3e2-bf87-46c0-8784-cd7d639287c8/c2eae035-37e2-4754-adcb-b8305431aa1f/c92d70c7-e6d0-4fa2-a0fd-78f6e780993a)
  
  ### **Key integrations**
  
  * [**Slack**](https://linear.app/settings/integrations/slack)
    Create issues from Slack messages and sync threads
  * [**GitHub**](https://linear.app/settings/integrations/github)** / **[**GitLab**](https://linear.app/settings/integrations/gitlab)
    Automate your pull request, commit workflows, and keep issues synced both ways
  * [**Agents**](https://linear.app/integrations/agents)
    Deploy AI agents that work alongside you as teammates
  
  ### **Browse all integrations**
  
  Discover 150+ available connections in our [integration directory](https://linear.app/integrations) – from bug creation via support tools (Intercom, Zendesk), to issues created from design explorations (Figma).
  
  ### **Linear API**
  
  If you need something more custom, you can build directly on the Linear API (built on GraphQL). [See our Dev Docs to learn more](https://linear.app/developers).
  ```

### [Z33-2] Set up your teams
- **Status**: `Todo`
- **Assignee**: Unassigned
- **Description**:
  ```
  This workspace is a container for your organization’s work. 
  
  * [Learn more about Workspaces](https://linear.app/docs/workspaces)
    How to configure settings and workflows 
  
  Teams are how you organize people and work in Linear.
  
  * [Learn about Teams](https://linear.app/docs/teams)
    How to structure teams and configure workflows
  
  Teams are made of members with defined roles (Admin, Member, Guest).
  
  * [Learn more about Members](https://linear.app/docs/invite-members)
    Add your team and assign roles
  
  ---
  
  Ready to add your team? Invite via CSV or a unique link in [settings](http://linear.app/settings/members).
  ```

