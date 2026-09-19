// Release notes shown in the app (⋯ menu → version row).
//
// Written for non-technical readers: plain language, minimal detail.
// Ordered oldest → newest so the story reads chronologically from the beginning.
// A fix or change is listed only once — the most recent instance.

export interface ReleaseNote {
  version: string
  date: string
  notes: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: 'v1.0',
    date: 'August 2026',
    notes: [
      'The family dashboard is born: one shared calendar, task list, grocery list, and notes for the whole household.',
      'Google Calendar and Google Tasks sync, so everyone\u2019s events and to-dos show up together.',
      'Invite family members with a simple code, and sign in with Google.',
      'Keyword color rules let events color themselves automatically.',
      'Display settings for the kitchen screen: text size, brightness, keep the screen awake, and full-screen mode.',
      'Installs like an app on phones and tablets, and updates itself automatically.',
    ],
  },
  {
    version: 'v1.1.1',
    date: 'Aug 31, 2026',
    notes: [
      'Bigger, easier-to-read events in the 1-week view.',
    ],
  },
  {
    version: 'v1.1.2',
    date: 'Sep 1, 2026',
    notes: [
      'Smoother, continuous scrolling between weeks in the 1-week view.',
    ],
  },
  {
    version: 'v1.1.3',
    date: 'Sep 1, 2026',
    notes: [
      'A cleaner, easier-to-scan 1-week view layout.',
    ],
  },
  {
    version: 'v1.1.4',
    date: 'Sep 2, 2026',
    notes: [
      'Weeks in the 1-week view now run Sunday to Saturday and snap neatly into place.',
    ],
  },
  {
    version: 'v1.1.5',
    date: 'Sep 19, 2026',
    notes: [
      'Swipe left or right in the 1-week view to move between weeks.',
      'Fresh calendar look: calmer events, a tidier header, and today is easier to spot.',
      'The \u22EF menu now opens properly.',
      'New dinner board: plan the week\u2019s meals and send the grocery list to Shipt or Amazon Fresh.',
      'Simpler event editing, including moving events between calendars.',
      'New in-app support chat \u2014 and release notes, which you\u2019re reading now.',
    ],
  },
]
