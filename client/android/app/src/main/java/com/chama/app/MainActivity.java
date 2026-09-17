package com.chama.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureSessionStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
