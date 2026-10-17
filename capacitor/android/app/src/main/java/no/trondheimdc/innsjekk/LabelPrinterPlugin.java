package no.trondheimdc.innsjekk;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Raw Bluetooth Classic (SPP / RFCOMM) pipe to a Brother QL. The web app builds the
 * raster job and parses status frames (`@thermal-label/brother-ql-*`); this only moves
 * bytes. A socket connect to a device that is not bonded makes Android show the
 * pairing dialog, so reconnects must pass pair=false unless staff asked to connect.
 */
@CapacitorPlugin(
    name = "LabelPrinter",
    permissions = { @Permission(alias = LabelPrinterPlugin.BLUETOOTH, strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class LabelPrinterPlugin extends Plugin {

    static final String BLUETOOTH = "bluetooth";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    /** Connects and writes in order; reads get their own thread. */
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private BluetoothSocket socket;
    private OutputStream output;
    private String connectedAddress;
    private boolean watchingRadio;

    private final BroadcastReceiver radio = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {
                int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
                if (state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF) {
                    closeSocket(true);
                }
                if (state == BluetoothAdapter.STATE_ON || state == BluetoothAdapter.STATE_OFF) {
                    JSObject event = new JSObject();
                    event.put("enabled", state == BluetoothAdapter.STATE_ON);
                    notifyListeners("bluetooth", event);
                }
                return;
            }
            if (BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(action)) {
                int bond = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR);
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                JSObject event = new JSObject();
                event.put("address", device == null ? null : device.getAddress());
                event.put(
                    "state",
                    bond == BluetoothDevice.BOND_BONDING
                        ? "bonding"
                        : bond == BluetoothDevice.BOND_BONDED ? "bonded" : "none"
                );
                notifyListeners("bond", event);
            }
        }
    };

    @Override
    public void load() {
        watchRadio();
    }

    /** Phone Bluetooth on/off, and the system pairing dialog, so the page can follow along. */
    private void watchRadio() {
        if (watchingRadio) return;
        watchingRadio = true;
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
        filter.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(radio, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(radio, filter);
        }
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    /** Android 12+ needs "nearby devices"; older versions get Bluetooth at install. */
    private boolean hasPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState(BLUETOOTH) == PermissionState.GRANTED;
    }

    /** False when it had to ask; the call then continues in `permissionResult`. */
    private boolean ensurePermission(PluginCall call) {
        if (hasPermission()) return true;
        requestPermissionForAlias(BLUETOOTH, call, "permissionResult");
        return false;
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        if (!hasPermission()) {
            call.reject("Bluetooth permission denied", "permission_denied");
            return;
        }
        switch (call.getMethodName()) {
            case "connect" -> connect(call);
            case "pairedPrinters" -> pairedPrinters(call);
            case "enableBluetooth" -> enableBluetooth(call);
            case "isBonded" -> isBonded(call);
            default -> call.resolve();
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        JSObject result = new JSObject();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        result.put("permission", hasPermission());
        result.put("connected", isConnected());
        result.put("address", isConnected() ? connectedAddress : null);
        call.resolve(result);
    }

    @PluginMethod
    public void enableBluetooth(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("No Bluetooth on this device", "bluetooth_unavailable");
            return;
        }
        if (adapter.isEnabled()) {
            call.resolve(enabledResult(true));
            return;
        }
        if (!ensurePermission(call)) return;
        startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "enableResult");
    }

    @ActivityCallback
    private void enableResult(PluginCall call, ActivityResult result) {
        BluetoothAdapter adapter = adapter();
        call.resolve(enabledResult(adapter != null && adapter.isEnabled()));
    }

    private JSObject enabledResult(boolean enabled) {
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        return result;
    }

    /** Bonded Brother QL printers, for reconnecting without a sticker. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void pairedPrinters(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("No Bluetooth on this device", "bluetooth_unavailable");
            return;
        }
        if (!ensurePermission(call)) return;
        JSArray printers = new JSArray();
        for (BluetoothDevice device : adapter.getBondedDevices()) {
            String name = device.getName();
            if (name == null || !name.startsWith("QL-")) continue;
            JSObject entry = new JSObject();
            entry.put("name", name);
            entry.put("address", device.getAddress());
            printers.put(entry);
        }
        JSObject result = new JSObject();
        result.put("printers", printers);
        call.resolve(result);
    }

    /** True when this phone has already paired with the address. Does not start pairing. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void isBonded(PluginCall call) {
        String address = call.getString("address", "").trim().toUpperCase();
        if (!BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Not a Bluetooth address: " + address, "invalid_address");
            return;
        }
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("No Bluetooth on this device", "bluetooth_unavailable");
            return;
        }
        if (!ensurePermission(call)) return;
        JSObject result = new JSObject();
        result.put("bonded", adapter.getRemoteDevice(address).getBondState() == BluetoothDevice.BOND_BONDED);
        call.resolve(result);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address", "").trim().toUpperCase();
        boolean pair = Boolean.TRUE.equals(call.getBoolean("pair", true));
        if (!BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Not a Bluetooth address: " + address, "invalid_address");
            return;
        }
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("No Bluetooth on this device", "bluetooth_unavailable");
            return;
        }
        if (!ensurePermission(call)) return;
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is off", "bluetooth_off");
            return;
        }

        io.execute(() -> {
            if (isConnected() && address.equals(connectedAddress)) {
                call.resolve(deviceResult(adapter.getRemoteDevice(address)));
                return;
            }
            closeSocket(false);
            // No cancelDiscovery(): the app never scans, and on Android 12+ it needs
            // BLUETOOTH_SCAN — without it, it throws and takes the app down.
            BluetoothDevice device = adapter.getRemoteDevice(address);
            // createRfcommSocket().connect() on an unbonded device opens the system
            // pairing dialog. Silent reconnect must not do that.
            if (!pair && device.getBondState() != BluetoothDevice.BOND_BONDED) {
                call.reject("Not paired", "not_paired");
                return;
            }
            try {
                BluetoothSocket next = openSocket(device);
                socket = next;
                output = next.getOutputStream();
                connectedAddress = address;
                startReader(next);
                call.resolve(deviceResult(device));
            } catch (IOException error) {
                call.reject("Could not connect: " + error.getMessage(), "connect_failed");
            } catch (RuntimeException error) {
                // SecurityException and friends: an error for the page, not a crash.
                call.reject("Could not connect: " + error, "connect_failed");
            }
        });
    }

    /** Standard SPP UUID first; some Brother firmware only answers on channel 1. */
    @SuppressLint("MissingPermission")
    private BluetoothSocket openSocket(BluetoothDevice device) throws IOException {
        BluetoothSocket first = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            first.connect();
            return first;
        } catch (IOException error) {
            closeQuietly(first);
            try {
                Method method = device.getClass().getMethod("createRfcommSocket", int.class);
                BluetoothSocket fallback = (BluetoothSocket) method.invoke(device, 1);
                fallback.connect();
                return fallback;
            } catch (IOException fallbackError) {
                throw fallbackError;
            } catch (ReflectiveOperationException reflectionError) {
                throw error;
            }
        }
    }

    @SuppressLint("MissingPermission")
    private JSObject deviceResult(BluetoothDevice device) {
        JSObject result = new JSObject();
        result.put("address", device.getAddress());
        result.put("name", hasPermission() ? device.getName() : null);
        return result;
    }

    private void startReader(BluetoothSocket owner) {
        Thread reader = new Thread(() -> {
            byte[] buffer = new byte[256];
            try {
                InputStream input = owner.getInputStream();
                while (true) {
                    int count = input.read(buffer);
                    if (count < 0) break;
                    if (count == 0) continue;
                    JSObject event = new JSObject();
                    event.put("data", Base64.encodeToString(buffer, 0, count, Base64.NO_WRAP));
                    notifyListeners("data", event);
                }
            } catch (IOException ignored) {
                // Socket closed or link dropped.
            }
            synchronized (LabelPrinterPlugin.this) {
                if (socket != owner) return;
            }
            closeSocket(true);
        }, "label-printer-reader");
        reader.setDaemon(true);
        reader.start();
    }

    @PluginMethod
    public void write(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing data", "invalid_data");
            return;
        }
        byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
        io.execute(() -> {
            OutputStream out = output;
            if (out == null || !isConnected()) {
                call.reject("Not connected", "not_connected");
                return;
            }
            try {
                out.write(bytes);
                out.flush();
                call.resolve();
            } catch (IOException | RuntimeException error) {
                closeSocket(true);
                call.reject("Write failed: " + error.getMessage(), "write_failed");
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        io.execute(() -> {
            closeSocket(false);
            call.resolve();
        });
    }

    private boolean isConnected() {
        BluetoothSocket current = socket;
        return current != null && current.isConnected();
    }

    private void closeSocket(boolean notify) {
        BluetoothSocket current;
        synchronized (this) {
            current = socket;
            socket = null;
            output = null;
            connectedAddress = null;
        }
        if (current == null) return;
        closeQuietly(current);
        if (notify) notifyListeners("disconnected", new JSObject());
    }

    private static void closeQuietly(BluetoothSocket target) {
        try {
            target.close();
        } catch (IOException ignored) {
            // Already closed.
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (watchingRadio) {
            try {
                getContext().unregisterReceiver(radio);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered.
            }
            watchingRadio = false;
        }
        closeSocket(false);
        io.shutdownNow();
    }
}
