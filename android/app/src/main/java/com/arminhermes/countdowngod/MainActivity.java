package com.arminhermes.countdowngod;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // AppUpdater lives in the app module, so `cap sync` never lists it
        // in capacitor.plugins.json — register it explicitly, before the
        // bridge is created in super.onCreate().
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
