package no.trondheimdc.innsjekk;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;

/**
 * Downloads from the WebView. A WebView ignores download links on its own, so «Oppdater»
 * on /last-ned did nothing. APKs are fetched with the WebView's session cookies (the APK
 * route sits behind door login) and handed to Android's installer; the first time,
 * Android asks to allow installs from TDC Innsjekk. Other downloads open in the browser.
 */
final class AppUpdater {

    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final String UPDATE_FILE = "tdc-innsjekk-update.apk";

    private final Activity activity;
    private long downloadId = -1;

    private final BroadcastReceiver downloadDone = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id == -1 || id != downloadId) return;
            downloadId = -1;
            if (succeeded(id)) install();
            else toast("Klarte ikke å laste ned oppdateringen. Prøv igjen.");
        }
    };

    AppUpdater(Activity activity) {
        this.activity = activity;
    }

    void attach(WebView webView) {
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            if (APK_MIME.equals(mimeType) || url.contains("/apk")) download(url, userAgent);
            else activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        });
        ContextCompat.registerReceiver(
            activity,
            downloadDone,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED
        );
    }

    void detach() {
        try {
            activity.unregisterReceiver(downloadDone);
        } catch (IllegalArgumentException ignored) {
            // Never registered.
        }
    }

    private File updateFile() {
        return new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), UPDATE_FILE);
    }

    private void download(String url, String userAgent) {
        if (downloadId != -1) {
            toast("Oppdateringen lastes ned allerede.");
            return;
        }
        File file = updateFile();
        file.delete();
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
            .setTitle("TDC Innsjekk")
            .setDescription("Laster ned oppdatering")
            .setMimeType(APK_MIME)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationUri(Uri.fromFile(file));
        String cookies = CookieManager.getInstance().getCookie(url);
        if (cookies != null) request.addRequestHeader("Cookie", cookies);
        request.addRequestHeader("User-Agent", userAgent);
        DownloadManager manager = activity.getSystemService(DownloadManager.class);
        downloadId = manager.enqueue(request);
        toast("Laster ned oppdateringen…");
    }

    private boolean succeeded(long id) {
        DownloadManager manager = activity.getSystemService(DownloadManager.class);
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return false;
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            return status == DownloadManager.STATUS_SUCCESSFUL && updateFile().length() > 0;
        }
    }

    private void install() {
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", updateFile());
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, APK_MIME)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }

    private void toast(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
    }
}
