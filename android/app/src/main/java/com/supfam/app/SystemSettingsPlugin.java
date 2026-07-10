package com.supfam.app;

import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemSettings")
public class SystemSettingsPlugin extends Plugin {

    @PluginMethod
    public void setImmersiveMode(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        MainActivity.isImmersiveModeEnabled = enabled;
        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.applyImmersiveMode();
        }
        call.resolve();
    }

    @PluginMethod
    public void setKeepScreenOn(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            if (enabled) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        Double val = call.getDouble("brightness");
        if (val == null) {
            call.reject("Brightness value is required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.screenBrightness = val.floatValue();
            window.setAttributes(layoutParams);
            call.resolve();
        });
    }

    @PluginMethod
    public void openSystemSettings(PluginCall call) {
        String type = call.getString("type", "general");
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent;
                if ("display".equals(type)) {
                    intent = new Intent(android.provider.Settings.ACTION_DISPLAY_SETTINGS);
                } else {
                    intent = new Intent(android.provider.Settings.ACTION_SETTINGS);
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(intent);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Could not open system settings: " + ex.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void getSettingsState(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            
            boolean isKeepScreenOn = (layoutParams.flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0;
            float brightness = layoutParams.screenBrightness; // -1 means system default or custom float

            JSObject ret = new JSObject();
            ret.put("keepScreenOn", isKeepScreenOn);
            ret.put("brightness", brightness);
            ret.put("immersiveMode", MainActivity.isImmersiveModeEnabled);
            call.resolve(ret);
        });
    }
}
