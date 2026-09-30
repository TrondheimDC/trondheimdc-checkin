# Printing from PC / Mac / Linux (USB)

Phones print through Smooth Print over Bluetooth. Desktops print straight from **Chrome or Edge** to the QL-820NWBc over its **USB-B cable**, using WebUSB. There is no Smooth Print, no Bluetooth and no print dialog: the page draws the badge and sends it to the printer.

Staff get the same steps in the app at `/oppsett` on a desktop. The wizard reads the OS from the browser and only shows the driver step that machine needs: USB cable → driver (Windows: Zadig, Linux: udev; skipped on Mac) → pick the printer → test print.

## What you need

| | |
|---|---|
| Browser | [Chrome](https://www.google.com/chrome/) or [Edge](https://www.microsoft.com/edge). Firefox and Safari have no WebUSB and cannot print. |
| Connection | USB-A → USB-B cable to the printer. Bluetooth from a PC/Mac browser is not possible. |
| Page | HTTPS, or `localhost`. WebUSB is blocked on plain http. |
| Labels | DK-11208 (38 × 90 mm). Other rolls are refused with a message. |

Only one tab can use the printer at a time. Close other check-in tabs.

## Per operating system

### macOS: works out of the box

No driver, no setup. Connect the cable, open the app in Chrome or Edge, press **Koble til printer** and pick *QL-820NWB* in the list Chrome shows.


### Windows: install the WinUSB driver once per PC

Windows attaches its own printer driver to the QL, and Chrome is not allowed to talk to a device that has one. So **each PC that prints needs the printer switched to the generic WinUSB driver**, once:

1. Plug in the printer over USB and switch it on.
2. Download [Zadig 2.9](https://github.com/pbatard/libwdi/releases/download/v1.5.1/zadig-2.9.exe) (the same link the driver step in `/oppsett` uses) and run it. It needs administrator rights and no install. Zadig installs the generic **WinUSB** driver; there is nothing to download from Brother.
3. *Options → List All Devices*, then pick **QL-820NWB** in the dropdown.
4. Pick **WinUSB** as the target driver and press **Replace Driver**.
5. Reload the app. The printer does not need to be unplugged.

Things to know:

- After the swap the Brother Windows driver no longer sees the printer over USB on that PC. That is fine: check-in only prints through the browser.
- Do this on every PC that will print. Phones and Macs are not affected.
- If it stops working after moving the cable to a different USB port, run Zadig again for that port.

### Linux: allow your user to open the device

Two things can block it: permissions on the USB device, and the kernel's `usblp` module, which grabs USB printers.

1. Save this line as `/etc/udev/rules.d/60-brother-ql.rules`:

   ```
   SUBSYSTEM=="usb", ATTR{idVendor}=="04f9", ATTR{idProduct}=="209d", MODE="0660", TAG+="uaccess"
   ```

2. Reload the rules and replug the printer:

   ```bash
   sudo udevadm control --reload
   ```

3. If Chrome says the printer is in use or the interface cannot be claimed, unload `usblp`:

   ```bash
   sudo modprobe -r usblp
   ```

   To make that permanent, add `blacklist usblp` to a file in `/etc/modprobe.d/`.

`04f9:209d` is the QL-820NWB / NWBc. `uaccess` gives whoever is logged in on the machine access, so no `sudo` and no group setup.

## First connection

1. Open the app in Chrome or Edge. On a desktop, `/oppsett` shows the USB wizard.
2. **Koble til printer** opens Chrome's device picker. Pick *QL-820NWB*.
3. Print the test badge.

Chrome remembers the permission per site. After that the app reconnects silently on every page load, and again when the cable is replugged. The picker only shows again if the permission was cleared or the printer was swapped.

If a door login belongs to a specific printer, the app compares that printer's serial with the USB one and warns when they differ. It only warns; it never blocks printing.

## Troubleshooting

| Message / symptom | Fix |
|---|---|
| No printer in Chrome's picker | Check the cable and power. On Windows, do the Zadig step. On Linux, add the udev rule. |
| «Nettleseren fikk ikke tilgang til printeren.» | Windows: Zadig. Linux: the udev rule. |
| «Printeren er i bruk i en annen fane eller et annet program.» | Close other check-in tabs. On Linux also `modprobe -r usblp`. |
| «Feil etiketter i printeren. Bruk DK-11208 (38 × 90 mm).» | Load a DK-11208 roll. Continuous rolls and other sizes are refused. |
| «Lokket på printeren er åpent…» / «tom for etiketter» | Close the lid / load a roll. The attendee is **not** checked in when this is caught before printing. |
| «Printeren svarer ikke.» | Editor Lite light is on, or the printer is off or asleep. Hold the Editor Lite button until the light goes out. |
| Button says «Bruk Chrome eller Edge» | The browser has no WebUSB (Firefox, Safari), or the page is not HTTPS. |
| Everything worked, then stopped | Replug the cable; the app reconnects on its own. Only one tab can hold the printer. |

## What has and has not been verified

Verified in a headless browser against a fake USB printer: the byte stream (row width, compression, cut), the check-in ordering, the refusal of wrong media and printer errors, and that sticker QR codes decode to the exact setup URL.

**Not yet verified on a real QL-820NWBc:** that the print lands centred on the label (head margins 12 / 295 pins), badge orientation against the phone badge, that the font matches, what `serialNumber` the printer reports (the mismatch warning could give a false alarm), and the Linux steps above. Connecting on Mac and on Windows (with Zadig) has been checked. Print a single badge on real labels before the doors open, and please write down what you find in [docs/MVP-verification.md](MVP-verification.md).

Background on the protocol, the library and why Bluetooth is out: the *Desktop printing (WebUSB)* section in [RESEARCH.md](../RESEARCH.md).
