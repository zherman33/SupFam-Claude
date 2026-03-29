# Sup Fam — CLAUDE.md

## What Is This App

Sup Fam is a family household dashboard — a shared, always-on ambient display that consolidates calendars, tasks, grocery lists, and notes into a single warm, beautiful interface.

**The one-liner:** "The iPad on the counter that runs the house."

It is not a productivity app. It is not a SaaS dashboard. It is ambient furniture.

---

## Target User

Dual-parent households with young children. Busy professionals in the Apple ecosystem who are overwhelmed by fragmented tools (text threads, whiteboards, fridge calendars, grocery apps, reminders, shared notes). They want one shared, real-time family hub.

**Usage contexts:**
- iPad mounted/docked in kitchen as always-on ambient display (primary)
- Quick glance before school/work
- Bedtime prep routine
- Sunday planning ritual
- iPhone/web for on-the-go access to the same data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Routing | Wouter |
| Data fetching | TanStack React Query |
| State management | React Context or Zustand (keep it simple) |
| Backend / Auth / DB | Supabase (Auth, Postgres, Realtime, RLS, Edge Functions) |
| Auth provider | Supabase Auth with Google OAuth |
| Deployment | Vercel (frontend only — no separate backend server) |
| Package manager | pnpm |
| Version control | GitHub + GitHub Desktop (GUI only) |
| Build tool | Claude Code |

**Key architecture decision:** There is NO separate backend server. The frontend talks directly to Supabase. Auth is Supabase Auth (not custom session auth). Calendar API calls that need server-side secrets use Supabase Edge Functions.

---

## Design System

### Typography
| Use | Font | Source |
|-----|------|--------|
| Personality, labels, handwritten accents | **Caveat** | Google Fonts |
| Dates, headlines, feature names | **Instrument Serif** | Google Fonts |
| Body copy, UI text, form fields | **DM Sans** | Google Fonts |

Never use: Inter, Roboto, system-ui, or any font not in this list.

### Color Palette
- **Base**: Warm cream (`#FAF7F2` range) — never pure white, never `#FFFFFF`
- **Cards**: White (`#FFFFFF`) on warm cream backgrounds for subtle lift
- **Primary accent**: Terracotta / clay (`#C4714F` range)
- **Supporting tones**: Warm sand, muted sage
- **Text**: Dark warm brown — never pure black
- **No dark mode** — the app is always light, always warm

### Family Member Colors
- Zac: Green
- Partner: Blue
- Family/shared: Terracotta
- Child: Purple

### Layout
- **Primary target**: iPad Pro 11-inch, landscape orientation
- **iPad layout**: Three-panel — left (today/tasks), center (calendar), right (grocery/notes)
- **iPhone layout**: Single column with bottom tab bar
- **Web**: Responsive, maps to iPad or iPhone layout based on viewport
- **Interaction model**: Ambient/glanceable first, interactive second
- **Tap targets**: Minimum 44×44pt
- **Density**: Low-to-medium. Breathing room is a feature.
- **No**: Hamburger menus, hidden navigation, enterprise UI patterns

### UI Copy Tone
- Warm, casual, family-first. Like a note left on the fridge.
- Use: "What's on today," "Your week," "Don't forget," "Add"
- Avoid: "Manage," "Configure," "Dashboard," "Workspace"
- Emoji: Sparse, purposeful — never decorative noise
- Errors: Never alarming. "Hmm, that didn't work — try again?" not "Error 422"

---

## Database Schema (Supabase)

All tables live in Supabase Postgres. All use RLS — users can only access data belonging to their family.

### families
- `id` uuid PK default gen_random_uuid()
- `name` text not null
- `invite_code` text unique — for partner onboarding
- `created_at` timestamptz default now()

### family_members
- `id` uuid PK default gen_random_uuid()
- `family_id` uuid FK → families not null
- `user_id` uuid FK → auth.users not null
- `display_name` text not null
- `role` text not null ('admin' | 'member')
- `avatar_color` text — hex color for calendar color-coding
- `joined_at` timestamptz default now()

### connected_calendars
- `id` uuid PK default gen_random_uuid()
- `family_member_id` uuid FK → family_members not null
- `provider` text not null ('google' | 'outlook' | 'apple')
- `access_token` text not null
- `refresh_token` text
- `token_expires_at` timestamptz
- `calendar_id` text not null
- `calendar_name` text
- `color` text
- `is_visible` boolean default true
- `last_synced_at` timestamptz
- `created_at` timestamptz default now()

### calendar_events
- `id` uuid PK default gen_random_uuid()
- `family_id` uuid FK → families not null
- `source_calendar_id` uuid FK → connected_calendars nullable
- `external_event_id` text nullable — for dedup on re-sync
- `title` text not null
- `description` text nullable
- `location` text nullable
- `start_at` timestamptz not null
- `end_at` timestamptz not null
- `all_day` boolean default false
- `color` text
- `created_by` uuid FK → family_members nullable
- `created_at` timestamptz default now()

### tasks
- `id` uuid PK default gen_random_uuid()
- `family_id` uuid FK → families not null
- `assigned_to` uuid FK → family_members nullable
- `title` text not null
- `notes` text nullable
- `due_date` date nullable
- `is_complete` boolean default false
- `is_recurring` boolean default false
- `recurrence_rule` text nullable
- `created_by` uuid FK → family_members not null
- `created_at` timestamptz default now()

### grocery_items
- `id` uuid PK default gen_random_uuid()
- `family_id` uuid FK → families not null
- `title` text not null
- `category` text nullable — produce, dairy, pantry, etc.
- `is_checked` boolean default false
- `added_by` uuid FK → family_members nullable
- `created_at` timestamptz default now()

### notes
- `id` uuid PK default gen_random_uuid()
- `family_id` uuid FK → families not null
- `title` text nullable
- `content` text
- `created_by` uuid FK → family_members nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

---

## Auth Architecture

### Supabase Auth with Google OAuth
- Users sign up/in via "Continue with Google" using `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Request calendar scopes during sign-in: `https://www.googleapis.com/auth/calendar.readonly`
- On the `SIGNED_IN` auth event, capture `session.provider_token` and `session.provider_refresh_token` immediately — these are only available at that moment and Supabase does not persist them
- Upsert tokens into `connected_calendars` table
- Users must sign out and back in after scope changes for new permissions to take effect

### Family Account Flow
1. First user signs up → creates a family → gets an invite code
2. Partner uses invite code to join the same family
3. Each family member connects their own calendar accounts
4. All family data is scoped to `family_id` via RLS

### RLS Policy Pattern
Every table with `family_id`:
```sql
CREATE POLICY "Users can access their family data"
ON table_name FOR ALL
USING (
  family_id IN (
    SELECT family_id FROM family_members WHERE user_id = auth.uid()
  )
);
```

---

## Google Calendar Integration

### Setup Requirements (done manually, not by Claude Code)
1. Google Cloud project with OAuth 2.0 credentials
2. Google Calendar API enabled in the project
3. OAuth consent screen configured with calendar scopes
4. Supabase Auth → Providers → Google configured with client ID/secret and calendar scopes
5. Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

### How It Works
1. User signs in with Google → token captured on SIGNED_IN event → stored in `connected_calendars`
2. Frontend (or Edge Function) uses the stored access token to call Google Calendar API REST endpoints
3. Endpoint: `GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
4. Token refresh: if access token expired and refresh token exists, exchange at `https://oauth2.googleapis.com/token`
5. Events synced into `calendar_events` table or displayed directly from API response

### Sync Strategy
- Fetch on calendar view mount
- Manual "Sync Now" in settings
- Periodic refresh every 5-10 minutes while app is open
- Use `external_event_id` for dedup on re-sync

**Do NOT use npm packages for Google Calendar.** Use the REST API directly with fetch.

---

## Core Modules & Build Priority

### Phase 1 — The True MVP (build these first)
1. **Supabase setup** — tables, RLS policies, auth config
2. **Auth flow** — Google sign-in, family creation, invite code join
3. **iPad layout shell** — three-panel layout
4. **Calendar view** — week view centered on current week, color-coded per member
5. **Today panel** — today's events + tasks due today

### Phase 2 — Core Features
6. **Tasks** — CRUD, assign to family member, complete, recurring
7. **Grocery list** — add, check off, clear checked
8. **Notes** — simple shared family notes
9. **Google Calendar integration** — OAuth token capture + event sync

### Phase 3 — Polish & Expand
10. **iPhone/responsive layout** — single column with tab bar
11. **Settings & family management** — member list, calendar visibility toggles
12. **Partner onboarding flow** — invite code experience, first-run for second parent
13. **Outlook calendar integration** — Microsoft Graph API
14. **Ambient display mode** — dimming, wake behavior
15. **Animations, empty states, onboarding polish**

**Resist scope creep.** Calendar + Today panel alone = a shippable v0.1.

---

## Coding Conventions

- TypeScript strict mode
- Functional React components with hooks
- Use shadcn/ui components — don't reinvent buttons, dialogs, inputs
- TanStack React Query for all Supabase data fetching (queries + mutations)
- Supabase client initialized once in a shared module, imported everywhere
- File structure: feature-based folders (`src/features/calendar/`, `src/features/tasks/`, etc.)
- Shared components in `src/components/ui/` (shadcn) and `src/components/shared/`
- Environment variables prefixed with `VITE_` for client-side access
- No `any` types — use proper interfaces
- Prefer `date-fns` for date manipulation

---

## Environment Variables

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

These go in `.env.local` for development and in Vercel's environment variables for production.

---

## Deployment

- **Vercel** auto-deploys from `main` branch on GitHub
- Frontend only — no server to deploy
- Supabase Edge Functions deploy via Supabase CLI (if/when needed for token refresh)
- After pushing changes via GitHub Desktop, Vercel rebuilds automatically

---

## What Sup Fam Is NOT

- Not a heavy family management SaaS
- Not a complex productivity system
- Not a CRM for parents
- Not a messaging app
- Not a monthly subscription overload tool

**It IS:** The iPad on the counter that runs the house.

---

## Important Constraints

- **No terminal for git.** All version control via GitHub Desktop. Never instruct the user to run git commands.
- **No separate backend server.** Everything goes through Supabase.
- **No dark mode.** The app is always warm cream.
- **iPad landscape is the primary design target.** Don't optimize for mobile first.
- **Supabase Auth only.** No custom session auth, no JWT middleware, no Express.
