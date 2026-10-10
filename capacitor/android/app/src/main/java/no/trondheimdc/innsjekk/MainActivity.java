package no.trondheimdc.innsjekk;

import android.app.AlertDialog;
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
        showLastCrash();
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
