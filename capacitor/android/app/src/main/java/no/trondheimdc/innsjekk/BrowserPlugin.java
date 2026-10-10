package no.trondheimdc.innsjekk;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens a page in the phone's browser. A plain link to innsjekk.trondheimdc.no would come
 * straight back into the app (App Links), so the browser is picked by package.
 */
@CapacitorPlugin(name = "Browser")
public class BrowserPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("url mangler");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE);
        String browser = defaultBrowser();
        if (browser != null) intent.setPackage(browser);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("Fant ingen nettleser", error);
        }
    }

    /** The app that opens ordinary web links; null when the user has not picked one. */
    private String defaultBrowser() {
        PackageManager packages = getContext().getPackageManager();
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"))
            .addCategory(Intent.CATEGORY_BROWSABLE);
        ResolveInfo info = packages.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        if (info != null && info.activityInfo != null && !"android".equals(info.activityInfo.packageName)) {
            return info.activityInfo.packageName;
        }
        // No default yet (the system chooser would answer): prefer Chrome.
        try {
            packages.getPackageInfo("com.android.chrome", 0);
            return "com.android.chrome";
        } catch (PackageManager.NameNotFoundException error) {
            return null;
        }
    }
}
