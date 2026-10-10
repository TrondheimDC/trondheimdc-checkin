package no.trondheimdc.innsjekk;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class MainActivity extends BridgeActivity {

    private static final String CRASH_FILE = "last-crash.txt";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LabelPrinterPlugin.class);
        super.onCreate(savedInstanceState);
        recordCrashes();
        openLink(getIntent());
        showLastCrash();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openLink(intent);
    }

    /**
     * App Link (sticker QR, link in another app): open that page in the WebView. Capacitor only
     * records the URL; on its own it would show the start page. The path moves onto this build's
     * server, so a preview build opens production links on the preview.
     */
    private void openLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri link = intent.getData();
        if (link == null || !"https".equals(link.getScheme())) return;
        Uri target = Uri.parse(bridge.getServerUrl())
            .buildUpon()
            .encodedPath(link.getEncodedPath())
            .encodedQuery(link.getEncodedQuery())
            .build();
        bridge.getWebView().loadUrl(target.toString());
    }

    /** Spike aid: keep the stack trace of a crash so the next start can show it. */
    private void recordCrashes() {
        File file = new File(getFilesDir(), CRASH_FILE);
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try (PrintWriter out = new PrintWriter(new FileWriter(file))) {
                out.println("Thread: " + thread.getName());
                error.printStackTrace(out);
            } catch (Exception ignored) {
                // Nothing more to do while crashing.
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    private void showLastCrash() {
        File file = new File(getFilesDir(), CRASH_FILE);
        if (!file.exists()) return;
        String trace;
        try {
            trace = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
        } catch (Exception error) {
            trace = error.toString();
        }
        file.delete();
        new AlertDialog.Builder(this)
            .setTitle("Appen krasjet sist")
            .setMessage(trace.length() > 3000 ? trace.substring(0, 3000) : trace)
            .setPositiveButton("OK", null)
            .show();
    }
}
