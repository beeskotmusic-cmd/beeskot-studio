package com.beeskot.studio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LecteurPlugin.class);   // le petit lecteur d'Android (LecteurService)
        super.onCreate(savedInstanceState);
    }
}
