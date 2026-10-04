import type { SettingsGroup } from './settings-panel'

/**
 * Cross-component events for settings deep links and the support dialog.
 * The Dashboard owns the settings panel's open state and listens for
 * `supfam:open-settings`; the SupportWidget listens for `supfam:open-support`.
 */

/** Open the Settings panel, optionally on a specific group. */
export function openSettings(group?: SettingsGroup) {
  window.dispatchEvent(new CustomEvent('supfam:open-settings', { detail: { group } }))
}

/** Open the support dialog (floating widget or Settings → About). */
export function openSupportDialog() {
  window.dispatchEvent(new CustomEvent('supfam:open-support'))
}
