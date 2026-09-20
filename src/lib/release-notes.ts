// Release notes shown in the app (⋯ menu → version row).
//
// Written for non-technical readers: plain language, minimal detail.
// Ordered newest → oldest so the latest changes are on top.
// A fix or change is listed only once — the most recent instance.

export interface ReleaseNote {
  version: string
  date: string
  notes: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: 'v1.1.7',
    date: 'Sep 19, 2026',
    notes: [
      'Swiping between weeks in the 1-week view now follows your finger — quick flicks hop a week too.',
      'A slimmer Week / 3 Weeks / Month switcher that fits neatly on phones.',
    ],
  },
  {
    version: 'v1.1.6',
    date: 'Sep 19, 2026',
    notes: [
      'A “Today” badge now marks the current day in every calendar view.',
      'Bigger Week / 3 Weeks / Month buttons — easier to tap the right one.',
      'More calendar on your screen: less empty space at the top on tablets and wall displays.',
      'Fixed: the setup screens no longer flash by when reopening the app.',
    ],
  },
  {
    version: 'v1.1.5',
    date: 'Sep 19, 2026',
    notes: [
      'A fresher calendar: calmer events, a tidier header, and today stands out more.',
      'The ⋯ menu in the corner now opens properly.',
      'New dinner board: plan the week’s meals, then send the grocery list to Shipt or Amazon Fresh.',
      'Simpler event editing — including moving an event to a different calendar.',
      'New in-app support chat. And release notes, which you’re reading now.',
    ],
  },
  {
    version: 'v1.1.4',
    date: 'Sep 2, 2026',
    notes: [
      'The 1-week view now runs Sunday to Saturday and snaps neatly into place.',
    ],
  },
  {
    version: 'v1.1.3',
    date: 'Sep 1, 2026',
    notes: [
      'A cleaner, easier-to-scan 1-week layout.',
    ],
  },
  {
    version: 'v1.1.2',
    date: 'Sep 1, 2026',
    notes: [
      'Smoother scrolling between weeks in the 1-week view.',
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
    version: 'v1.0',
    date: 'August 2026',
    notes: [
      'Sup Fam is here: one shared calendar, task list, grocery list, and notes for the whole household.',
      'Google Calendar and Google Tasks sync, so everyone’s events and to-dos appear together.',
      'Invite the family with a simple code; sign in with Google.',
      'Events can color themselves automatically with keyword rules.',
      'Kitchen-screen settings: text size, brightness, keep-awake, and full-screen mode.',
      'Installs like an app on phones and tablets — and updates itself.',
    ],
  },
]
