# Completed Linear Tasks — Sup Fam

*Last synced: 6/3/2026, 6:52:00 PM*

### [Z33-6] Linear
- **Status**: `Done`
- **Completed**: 4/19/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  * Really clean
  * straight forward mobile experience
  ```

### [Z33-5] Product Research
- **Status**: `Done`
- **Completed**: 4/19/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  - [ ] linear
  - [ ] clickup
  - [ ] notion
  - [ ] asana
  - [ ] monday
  ```

### [Z33-39] Calendar readability: font size, event text layout, today circle sizing
- **Status**: `Done`
- **Completed**: 4/10/2026
- **Assignee**: Zac Herman
- **Description**:
  ```
  ## Problem
  
  Live iPad feedback (April 9, 2026) — the calendar event display has multiple compounding issues making it hard to read:
  
  1. **Font too large overall** — only \~10 characters visible per event in each day cell
  2. **Chaotic font sizing** — time text is a different size from event name text, creating visual noise
  3. **Two lines used incorrectly** — the two-line height is being used with time on its own line; the intent was two lines of event *content*, not time + title
  4. **Today circle too large** — the filled circle around today's date number is oversized and heavy
  
  ## Required fixes
  
  ### Event text rendering
  
  * Each event gets 2 lines of text maximum
  * Both lines are event content (title wraps across both lines)
  * Time is NOT rendered on a separate line — incorporate time inline at the start of line 1 (e.g. "10a Project sync") or drop it entirely if it causes truncation
  * Reduce font size so that significantly more than 10 characters fit per line
  * Unify font size — event name and any time text must use the same size
  
  ### Today indicator
  
  * Reduce the circle size around today's date number
  * Change from filled circle to unfilled/outline circle — feels lighter and more natural
  * Should feel like a hand-drawn ring, not a solid badge
  
  ## Acceptance criteria
  
  * Event titles show more than 10 characters per line at normal reading distance
  * No mixed font sizes within event rows
  * Two lines of content visible per event, with time inline not on its own line
  * Today circle is noticeably smaller and unfilled
  * Calendar is readable from \~2m on iPad Pro
  ```

### [Z33-38] Bug: bottom taskbar and left sidebar showing simultaneously
- **Status**: `Done`
- **Completed**: 4/10/2026
- **Assignee**: Zac Herman
- **Description**:
  ```
  ## Problem
  
  After shipping the left sidebar ([Z33-33](https://linear.app/z33hermangmailcom/issue/Z33-33/rebuild-task-panel-as-left-sidebar-with-today-unscheduled-scheduled)), both the bottom taskbar and the left sidebar are visible simultaneously. They should be mutually exclusive — only one task UI should show at a time.
  
  ## Expected behavior
  
  * When the left sidebar is expanded: bottom taskbar is hidden
  * When the left sidebar is collapsed: bottom taskbar is visible as the ambient/minimized state
  * There should never be a state where both are visible at the same time
  
  ## Fix
  
  Audit the sidebar expand/collapse state logic and gate the bottom taskbar's visibility on the sidebar being collapsed. A single boolean `sidebarExpanded` should control both.
  
  ## Acceptance criteria
  
  * Expanding the sidebar hides the bottom taskbar
  * Collapsing the sidebar shows the bottom taskbar
  * No state where both are visible simultaneously
  ```

### [Z33-22] iPad layout breaks in Settings panel
- **Status**: `Done`
- **Completed**: 4/9/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  The Settings panel layout breaks on iPad, which is the primary target device.
  ```

### [Z33-26] Redesign the ambient iPad display UI
- **Status**: `Done`
- **Completed**: 4/4/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  Overhaul the main ambient display layout for iPad landscape with a stronger glanceable hierarchy, warm aesthetic, and full use of the Caveat, Instrument Serif, and DM Sans type system.
  ```

### [Z33-19] Event titles become unreadable on crowded days
- **Status**: `Done`
- **Completed**: 4/4/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  When multiple events land in the same day slot, text overflows or collides and becomes unreadable.
  ```

### [Z33-30] Support multiple calendars per household member
- **Status**: `Done`
- **Completed**: 4/4/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  Allow each user in a household to connect multiple calendars, such as personal and work calendars, and aggregate and deduplicate events across them.
  ```

### [Z33-25] Design household invite and onboarding flow
- **Status**: `Done`
- **Completed**: 4/4/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  Create a dedicated onboarding experience for the second parent joining the household. This is a critical adoption moment and should feel warm and frictionless.
  ```

### [Z33-20] Add Google Calendar integration
- **Status**: `Done`
- **Completed**: 4/4/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  Implement OAuth-based Google Calendar connection so each family member can connect a personal Google Calendar and have events appear in the shared display color-coded by person.
  
  Notes:
  
  * Capture `provider_token` on the `SIGNED_IN` event and persist it in the database
  * Users need to sign out and back in after OAuth scope changes
  * Add a `connected_calendars` table to support the integration
  ```

### [Z33-31] Fix RLS infinite recursion — family setup broken
- **Status**: `Done`
- **Completed**: 4/3/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  ## Problem
  
  Family creation was failing with `"Hmm, that didn't work — try again?"` after successfully completing Google OAuth.
  
  Root cause from Supabase Postgres logs:
  
  ```
  infinite recursion detected in policy for relation "family_members"
  ```
  
  The original `family_members` SELECT policy used a subquery that referenced `family_members` itself:
  
  ```sql
  -- BROKEN: causes infinite recursion
  family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  ```
  
  This looped infinitely every time any RLS-checked query touched the table.
  
  ## Fix Applied
  
  Created a `SECURITY DEFINER` function `public.get_my_family_id()` that bypasses RLS to safely retrieve the current user's family ID:
  
  ```sql
  CREATE OR REPLACE FUNCTION public.get_my_family_id()
  RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = public
  AS $$ SELECT family_id FROM public.family_members WHERE user_id = auth.uid() LIMIT 1; $$;
  ```
  
  Then replaced ALL recursive subquery policies across all 7 tables to use `family_id = public.get_my_family_id()` instead.
  
  Also cleaned up \~10 duplicate legacy policies left over from the Sprint 1 migration.
  
  ## Migrations Applied
  
  * `fix_rls_infinite_recursion`
  * `drop_legacy_recursive_policies`
  * `drop_legacy_connected_calendars_policies`
  
  ## Result
  
  All 7 tables now have exactly 4 clean non-recursive policies (SELECT/INSERT/UPDATE/DELETE). Family creation should work end-to-end.
  ```

### [Z33-21] Build family account system with invite codes
- **Status**: `Done`
- **Completed**: 3/29/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  Allow a household to create a shared family account. One parent creates the family, generates an invite code, and the second parent joins via that code so all members share the same household data.
  ```

### [Z33-23] Tasks are non-interactive
- **Status**: `Done`
- **Completed**: 3/29/2026
- **Assignee**: Unassigned
- **Description**:
  ```
  Task items cannot be checked off or interacted with. This may be a holdover from the earlier Supabase RLS-based auth approach and needs an audit against the current custom session auth stack.
  ```

### [Z33-1] Get familiar with Linear
- **Status**: `Done`
- **Completed**: 12/9/2025
- **Assignee**: Unassigned
- **Description**:
  ```
  Welcome to Linear! 
  
  Watch an introductory video and access a list of resources below.
  
  [LinearH264Version.mp4](https://uploads.linear.app/fe63b3e2-bf87-46c0-8784-cd7d639287c8/923e2801-e5f2-4055-9b27-1541f27e3365/44ab081a-253a-4ccf-8d3d-2547ac09b986)
  
  ### **Choose your setup guide** based on your company stage:
  
  * [Small teams](https://linear.app/docs/how-to-use-linear-small-teams)
    For early-stage startups and projects
  * [Startups & mid-size companies](https://linear.app/docs/how-to-use-linear-startups-mid-size-companies)
    For growing teams with cross-functional needs
  * [Large & scaling companies](https://linear.app/docs/how-to-use-linear-large-scaling-companies)
    For enterprise and high-growth teams with complex workflows
  
  ### **Need help getting started?**
  
  * [Join our Slack community](https://linear.app/join-slack)
    Connect with other Linear users and get tips
  * [Join a live ](https://lu.ma/welcome-to-linear?utm_source=docs)[onboarding](https://lu.ma/welcome-to-linear?utm_source=onboarding)[ ](https://lu.ma/welcome-to-linear?utm_source=docs)[session](https://lu.ma/welcome-to-linear?utm_source=onboarding)
    Learn the essentials and see demos of core workflows
  
  ---
  
  If you have any questions hit `?` in the bottom left > Contact us.
  
  ![contactlinear (1).gif](https://uploads.linear.app/fe63b3e2-bf87-46c0-8784-cd7d639287c8/bc9bbf62-4192-411f-88f6-c89c9150503e/4df0346e-803b-4f58-8527-4aeb30d88411)
  ```

