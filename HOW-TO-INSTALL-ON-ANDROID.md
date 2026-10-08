# ZxT on your Android phone — step by step

The app is a set of plain web files. To install it on your phone, you put the files
on a free website address (GitHub Pages) **once**. After that, the app lives on your
phone and works with no internet at all. Your trades are never uploaded anywhere —
they stay on your phone.

## Part 1 — Put the files online (about 10 minutes, one time)

1. On your computer, go to https://github.com and click **Sign up** (free account).
2. Click the **+** at the top right → **New repository**.
3. Name it `zxt`, choose **Public**, click **Create repository**.
   (Public is required for free hosting. It only contains the app's code — never your trades.)
4. On the next page click **uploading an existing file**.
5. Unzip `zxt-offline-app.zip` on your computer. Open the folder, select **everything inside it**
   (the `css`, `js`, `icons` folders plus `index.html`, `sw.js`, `manifest.webmanifest`)
   and drag it all into the GitHub page. Wait for the upload to finish.
6. Click **Commit changes**.
7. Go to **Settings** (top of the repo) → **Pages** (left menu).
8. Under "Branch" choose **main** and **/ (root)**, then click **Save**.
9. Wait 1–2 minutes and refresh. A link appears:
   `https://YOUR-USERNAME.github.io/zxt/` — that's your app's address.

## Part 2 — Install it on your phone

1. Open **Chrome** on your phone and go to your link.
2. Tap the **⋮** menu (top right) → **Install app** (or **Add to Home screen**).
3. Tap **Install**. The ZxT icon now appears on your home screen.
4. Open it once while you have internet (so it can save itself). After that it works in airplane mode.

## Using it
- **+ button** (bottom right): log a trade for today.
- **Tap any day** on the calendar: see, edit, delete or add trades for that day.
- Swipe the calendar left/right to change month.
- On the phone's number keypad there's no minus key — use the **±** button next to the P&L box.

## Protect your data (important)
Everything is stored on the phone only. Tap **⚙** (top right) → **Export backup** every
week or so and send the file to yourself (Google Drive, email, WhatsApp).
To restore on a new phone: install the app, then **⚙ → Import backup**.
Don't "Clear data" for Chrome/ZxT in Android settings unless you have a backup.

## Updating the app later
If you change any file, also change `VERSION = 'zxt-v1'` in `sw.js` to `zxt-v2` (then v3…),
re-upload, and open the app once with internet — it will refresh itself.

## Want a real .apk file instead?
Once your link works, go to https://www.pwabuilder.com, paste the link, and choose
**Android** — it produces an .apk you can install directly.
