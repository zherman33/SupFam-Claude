// Release notes shown in the app (Settings → About → What's new).
//
// Written for non-technical readers: plain language, minimal detail.
// Ordered newest → oldest so the latest changes are on top.
// A fix or change is listed only once — the most recent instance.
//
// ONE VERSION PER DAY RULE:
// Exactly one version ships per calendar date. If several updates land
// on the same day, they all roll up under that day's single version.
// The panel groups entries by date, so even past multi-version days
// render as one release card.

export interface ReleaseNote {
  version: string
  date: string
  /** One-line summary shown on the collapsed release card. */
  headline: string
  /** Details revealed when the card is tapped open. Keep each one short. */
  notes: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: 'v1.2.2',
    date: 'Oct 8, 2026',
    headline: 'New: a kitchen kiosk view for the big screen.',
    notes: [
      'Opening the app with ?view=kiosk now shows a big-type kitchen board — today\u2019s agenda, tonight\u2019s dinner, groceries, and tasks — made for an always-on display like the Echo Show.',
    ],
  },
  {
    version: 'v1.2.1',
    date: 'Oct 6, 2026',
    headline: 'Calendar cleanup: no more double events.',
    notes: [
      'Events that showed up twice — like the same appointment appearing two times — now appear just once.',
      'Cancelled events clear out properly instead of hanging around on the calendar.',
      'Multi-day all-day events (like a trip) now stretch across the week as one banner in the 1-week view, matching the other views.',
      'Deleting an event removes it for the whole family, quietly — no more confusing “declined” emails.',
    ],
  },
  {
    version: 'v1.2.0',
    date: 'Oct 4, 2026',
    headline: 'Settings got a full spring-clean.',
    notes: [
      'Settings is now one tidy home: You, Family, Calendars, Appearance, This display, Dinner AI, Billing, About — plus a spot saved for Notifications.',
      'The two calendar managers are now one: show/hide, recolor, and home-screen shortcuts all live together under Calendars.',
      'Plain words everywhere: “Color rules” instead of “Keyword Rules”, “Show on home” instead of “Quick toggle”, and “This display” for the iPad-only settings.',
      'New under Family: see your members, manage the invite code, and edit your own profile name and avatar color under You.',
      '“What’s new” got a real door: Settings → About → What’s new — no more tapping the version number.',
      'The ⋯ menu is navigation only now: your boards up top, Help & support and Settings under More.',
      'The payment nudge now jumps straight to Settings → Billing.',
    ],
  },
  {
    version: 'v1.1.9',
    date: 'Oct 1, 2026',
    headline: 'Talk dinner through with the new dinner board.',
    notes: [
      'The dinner board got a big upgrade: tap any day and talk dinner through out loud — it opens with 3 ideas from your family’s own history.',
      '“Plan the week” talks through the whole week in one conversation and puts dinners on the board for you.',
      'Rate dinners with a thumbs up or down, and tell it how your family eats — recommendations get smarter over time.',
      'New Dinner AI setting: use Sup Fam’s cloud AI or point it at your own home AI server. Per device, your call.',
      'Adding an event is simpler: one date with start and end times by default — multi-day is a tap away when you need it.',
      'Opening an event now dims the whole screen properly.',
      'Deleting an event is reliable, with a clear message if something goes wrong.',
      'The calendar scrolls more smoothly, especially in the 3 Weeks and Month views.',
      'This What’s new screen got simpler too: one card per day — tap any release for details.',
      'The “today” marker got a fresh look: one clean spotlight on the current day in every calendar view.',
    ],
  },
  {
    version: 'v1.1.7',
    date: 'Sep 19, 2026',
    headline: 'Dinner board, support chat, and a smoother week view.',
    notes: [
      'New dinner board: plan the week’s meals, then send the grocery list to Shipt or Amazon Fresh.',
      'New in-app support chat.',
      'Swiping between weeks now follows your finger — quick flicks hop a week too.',
      'A “Today” badge marks the current day in every calendar view.',
      'A fresher calendar: calmer events, a tidier header, more room on tablets — and bigger view buttons.',
      'Simpler event editing — including moving an event to a different calendar.',
    ],
  },
  {
    version: 'v1.1.4',
    date: 'Sep 2, 2026',
    headline: 'Week view snaps into place.',
    notes: [
      'The 1-week view now runs Sunday to Saturday and snaps neatly into place.',
    ],
  },
  {
    version: 'v1.1.3',
    date: 'Sep 1, 2026',
    headline: 'A cleaner, smoother 1-week view.',
    notes: [
      'A cleaner, easier-to-scan 1-week layout.',
      'Smoother scrolling between weeks.',
    ],
  },
  {
    version: 'v1.1.1',
    date: 'Aug 31, 2026',
    headline: 'Bigger, easier-to-read events.',
    notes: [
      'Bigger, easier-to-read events in the 1-week view.',
    ],
  },
  {
    version: 'v1.0',
    date: 'August 2026',
    headline: 'Sup Fam is here.',
    notes: [
      'One shared calendar, task list, grocery list, and notes for the whole household.',
      'Google Calendar and Google Tasks sync, so everyone’s events and to-dos appear together.',
      'Invite the family with a simple code; sign in with Google.',
      'Events can color themselves automatically with keyword rules.',
      'Installs like an app on phones and tablets — and updates itself.',
    ],
  },
]
