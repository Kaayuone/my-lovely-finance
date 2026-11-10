package my.lovely.finance;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // A plugin of this project rather than of npm: registered before the bridge is built
        registerPlugin(CapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
