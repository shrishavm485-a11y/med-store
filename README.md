# MedVault

A private, personal medicine reference notebook. Plain HTML, CSS and JavaScript. No backend, no accounts, no analytics, no API keys.

**Reference only.** MedVault stores text you type or import. It does not contain medical data, verify facts, recommend medicines or calculate doses. Always check the official package leaflet and ask a doctor or pharmacist.

## Files
```
medvault/
  index.html     page structure
  style.css      neumorphic + wabi-sabi + brutalist theme, dark mode, print styles
  script.js      all app logic (add/edit/delete, search, backup, categories)
  manifest.json  optional "Add to Home screen" metadata
  icon.svg       app icon
  README.md      this file
```

## Deploy on GitHub Pages (free)
1. Sign in at github.com (create a free account if needed).
2. Click **+** (top right) > **New repository**. Name it `medvault`, choose **Public**, click **Create repository**.
3. On the new repo page click **uploading an existing file**. Drag in `index.html`, `style.css`, `script.js`, `manifest.json`, `icon.svg` and `README.md` (the files themselves, not a folder containing them).
4. Click **Commit changes**.
5. Open **Settings > Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
6. Wait 1 to 2 minutes and refresh. The address appears at the top: `https://YOUR-USERNAME.github.io/medvault/`.
7. On your Android phone open that address in Chrome. For quick access, tap the **⋮** menu > **Add to Home screen**.

All paths are relative, so the site works in the `/medvault/` sub-folder, and refreshing is safe because there is no server-side routing.

## Update the site
Edit a file on GitHub (open it, click the pencil icon, change, **Commit changes**) or upload the new file over the old one. Wait a minute, then reload. If you still see the old version, hard-refresh or clear the site's cache.
(Updating code does not touch saved medicines; they live in your browser.)

## Back up and restore
- **Backup > Export JSON backup** downloads `medvault-backup-DATE.json`. Keep a copy in cloud storage or email it to yourself.
- **Backup > Restore** reads a JSON file and shows a preview (new, already saved, invalid). **Merge** adds only new entries; **Replace all** asks for a second confirmation.
- Corrupted or invalid files show an error and change nothing.

## Important: where your data lives
Data is stored in your browser's localStorage for this exact site address. It does **not** sync between phone and computer or between browsers. Clearing site data, uninstalling the browser, private browsing or using a different address makes it unavailable. Export backups regularly (the app reminds you after 30 days).

## Offline use
Not implemented. There is no service worker, so the page needs a connection to load the first time. (Offline caching and local storage are different things: local storage keeps your data, caching keeps the app files.) `manifest.json` only provides a name and icon for Add to Home screen.

## Limits worth knowing
- localStorage holds roughly 5 MB; the app warns if saving fails.
- Source links are only clickable for `http(s)` addresses.
- Your text is always rendered as text, never as HTML.

## Test checklist
- [ ] Add a medicine with only a name; add another with every field.
- [ ] Adding the same name again shows the duplicate warning.
- [ ] Refresh the page: both entries are still there.
- [ ] Search by name, partial name, generic, brand, ingredient and a word from notes; matches highlight; Clear resets.
- [ ] Category chips, Favorites only and the sort menu work.
- [ ] Open a medicine: sections expand/collapse; line breaks and `- ` bullets display correctly; paste 5,000 words and check wrapping.
- [ ] Edit, favorite, copy, share (on phone), print preview (no buttons or nav).
- [ ] Delete shows confirmation, then Undo restores it.
- [ ] Export, erase all data, import with Merge: everything returns. Import a non-JSON file: clear error.
- [ ] Source `javascript:alert(1)` is shown as plain text, not a link.
- [ ] Dark mode toggle; phone width has no sideways scrolling; Android back button returns to the previous screen.
