import { registerPlugin, Capacitor } from '@capacitor/core';

export interface SystemSettingsPlugin {
  setImmersiveMode(options: { enabled: boolean }): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
  setBrightness(options: { brightness: number }): Promise<void>;
  openSystemSettings(options?: { type?: 'general' | 'display' }): Promise<void>;
  getSettingsState(): Promise<{ keepScreenOn: boolean; brightness: number; immersiveMode: boolean }>;
}

const NativeSystemSettings = registerPlugin<SystemSettingsPlugin>('SystemSettings');

let wakeLockSentinel: any = null;

// Re-request wake lock if tab visibility changes and it was active
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && !Capacitor.isNativePlatform()) {
      const wasEnabled = localStorage.getItem('supfam_keep_screen_on') === 'true';
      if (wasEnabled) {
        try {
          if ('wakeLock' in navigator) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            console.log('[Web Fallback] Re-acquired Screen Wake Lock');
          }
        } catch (err) {
          console.warn('[Web Fallback] Re-acquiring Wake Lock failed:', err);
        }
      }
    }
  });
}

export const SystemSettings = {
  async setImmersiveMode(enabled: boolean): Promise<void> {
    localStorage.setItem('supfam_immersive_mode', String(enabled));
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeSystemSettings.setImmersiveMode({ enabled });
      } catch (err) {
        console.error('Failed to set immersive mode:', err);
      }
    } else {
      console.log(`[Web Fallback] setImmersiveMode: ${enabled}`);
      try {
        if (enabled) {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            console.log('[Web Fallback] Fullscreen mode activated');
          }
        } else {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
            console.log('[Web Fallback] Fullscreen mode deactivated');
          }
        }
      } catch (err) {
        console.warn('[Web Fallback] HTML5 Fullscreen request failed (requires user interaction gesture):', err);
      }
    }
  },

  async setKeepScreenOn(enabled: boolean): Promise<void> {
    localStorage.setItem('supfam_keep_screen_on', String(enabled));
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeSystemSettings.setKeepScreenOn({ enabled });
      } catch (err) {
        console.error('Failed to set keep screen on:', err);
      }
    } else {
      console.log(`[Web Fallback] setKeepScreenOn: ${enabled}`);
      if (enabled) {
        try {
          if ('wakeLock' in navigator) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            console.log('[Web Fallback] Screen Wake Lock active');
          } else {
            console.warn('[Web Fallback] Wake Lock not supported in this browser');
          }
        } catch (err) {
          console.error('[Web Fallback] Wake Lock failed:', err);
        }
      } else {
        if (wakeLockSentinel) {
          try {
            await wakeLockSentinel.release();
            wakeLockSentinel = null;
            console.log('[Web Fallback] Screen Wake Lock released');
          } catch (err) {
            console.error('[Web Fallback] Wake Lock release failed:', err);
          }
        }
      }
    }
  },

  async setBrightness(brightness: number): Promise<void> {
    localStorage.setItem('supfam_screen_brightness', String(brightness));
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeSystemSettings.setBrightness({ brightness });
      } catch (err) {
        console.error('Failed to set brightness:', err);
      }
    } else {
      console.log(`[Web Fallback] setBrightness: ${brightness}`);
      // Simulate brightness overlay inside the browser
      const overlayId = 'web-brightness-overlay';
      let overlay = document.getElementById(overlayId);
      
      if (brightness >= 0 && brightness < 1.0) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = overlayId;
          overlay.style.position = 'fixed';
          overlay.style.inset = '0';
          overlay.style.backgroundColor = 'black';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '99999';
          document.body.appendChild(overlay);
        }
        // Map brightness 1.0 -> opacity 0%, brightness 0.0 -> opacity 80% (so the screen isn't completely black)
        const opacity = (1.0 - brightness) * 0.8;
        overlay.style.opacity = String(opacity);
      } else {
        if (overlay) {
          overlay.remove();
        }
      }
    }
  },

  async openSystemSettings(type: 'general' | 'display' = 'general'): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeSystemSettings.openSystemSettings({ type });
      } catch (err) {
        console.error('Failed to open system settings:', err);
      }
    } else {
      console.log(`[Web Fallback] openSystemSettings: ${type}`);
      alert(`Opening system settings is not supported on Web. (Requested: ${type} settings)`);
    }
  },

  async getSettingsState(): Promise<{ keepScreenOn: boolean; brightness: number; immersiveMode: boolean }> {
    const keepScreenOnStr = localStorage.getItem('supfam_keep_screen_on');
    const brightnessStr = localStorage.getItem('supfam_screen_brightness');
    const immersiveModeStr = localStorage.getItem('supfam_immersive_mode');

    if (keepScreenOnStr !== null || brightnessStr !== null || immersiveModeStr !== null) {
      return {
        keepScreenOn: keepScreenOnStr === 'true',
        brightness: brightnessStr ? Number(brightnessStr) : -1.0,
        immersiveMode: immersiveModeStr === 'true'
      };
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const nativeState = await NativeSystemSettings.getSettingsState();
        return {
          keepScreenOn: nativeState.keepScreenOn,
          brightness: nativeState.brightness,
          immersiveMode: nativeState.immersiveMode
        };
      } catch (err) {
        console.error('Failed to get native settings state:', err);
      }
    }

    return {
      keepScreenOn: false,
      brightness: -1.0,
      immersiveMode: false
    };
  }
};
