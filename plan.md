# Event Form and Sync Fixes

Based on the research, the issues with deleting and updating events stem from three core problems:

1. **Stale Calendar ID & Member ID State:** In `event-form.tsx`, `selectedMemberId` is initialized using `useState` before `calendars` has loaded from Supabase. If the user edits or deletes an event belonging to another family member, it incorrectly uses the logged-in user's `family_member_id` instead of the event owner's ID. This causes the Google Calendar API call in the backend to fail (404/403) because it uses the wrong Google token.
2. **Local State Not Updated Proactively:** The frontend issues the `delete` command to the edge function but doesn't delete the event from the local Supabase `calendar_events` table. Unless the backend explicitly performs this deletion (which it appears it doesn't do reliably based on the bug report), the event remains visible until the next full calendar sync.
3. **Changing Calendars on Edit:** The calendar dropdown is enabled during edit mode, allowing users to accidentally switch calendars. Google Calendar's update API doesn't support moving events across calendars this way, which causes updates to fail.

## Proposed Changes

### `src/features/calendar/event-form.tsx`
- Refactor `selectedMemberId` to use `useMemo` so it always accurately reflects the `family_member_id` of the currently selected calendar, even when `calendars` load asynchronously.
- Disable the calendar dropdown when editing an existing event (`disabled={isEdit}`).

### `src/features/calendar/use-write-event.ts`
- **`useDeleteEvent`**: Proactively delete the event from the local `calendar_events` table using Supabase so it immediately disappears from the UI. Additionally, invoke `sync-calendars` asynchronously in the background.
- **`useUpdateEvent`** and **`useCreateEvent`**: Invoke `sync-calendars` in the background after the mutation succeeds to ensure Google Calendar state is fully synced down (especially for attendees and auto-accepts).
