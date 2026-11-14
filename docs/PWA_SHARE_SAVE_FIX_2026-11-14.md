# Browser and PWA share-card saving

The previous browser path rendered the card asynchronously, then clicked a detached data-URL download link. Safari and Home Screen web apps can lose the original user activation during rendering, and that download path did not provide a native Save Image action.

Browser cards now render to a PNG File while the share sheet opens. The Save or Share tap invokes file sharing immediately. Browsers without file sharing receive a real PNG download link. A visible image, download link and open-image link remain available under Other ways to save the image, including after a sharing failure. Closing or changing a card defers object URL cleanup so it cannot interrupt a download that has just started. Native Capacitor sharing retains its existing filesystem/share path.

## Verification

- Seven focused Node tests passed, covering PNG preparation, synchronous file-share invocation, blocked sharing versus cancellation, object URL lifetime and existing Sun/rising reading variants.
- Production web build passed.
- Chrome: downloaded and inspected a valid 1080 by 1080 cream PNG. Checked the blocked-sharing fallback and mobile layout.
- iPhone 17 Pro simulator, iOS 27.0: used the actual ShareSheet with a synthetic chart card in Safari, then installed the same harness as a standalone Home Screen web app. In both contexts, Save or Share opened the system PNG share sheet and Save Image saved the card. Photos displayed both saved cards.
- The temporary local harness and its manifest were removed before committing. No accounts, live chart calls, backend records or emails were used. A physical iPhone was not tested.

On iPhone, fully close and reopen the PWA to load the update, open a share card, then choose Save or Share and Save Image. If file sharing is unavailable, expand Other ways to save the image.
