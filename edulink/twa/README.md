# Android Packaging (Trusted Web Activity)

Use this folder to package EduLink as an Android app (APK/AAB) for Play Store distribution.

## Prerequisites

- Deployed app URL over HTTPS (for example: `https://your-domain.com`)
- PWA already working (`/manifest.webmanifest`, service worker, installable checks)
- Node.js 18+
- Android Studio (SDK + Build Tools)
- Java 17 (or let Bubblewrap install JDK)

## 1) Build APK/AAB

From repo root:

```powershell
./twa/build-twa.ps1 -ManifestUrl "https://your-domain.com/manifest.webmanifest" -ApplicationId "com.edulinkwriters.twa"
```

Outputs are generated under:

- `twa/android/app/build/outputs/apk/`
- `twa/android/app/build/outputs/bundle/`

Use the `.aab` file for Play Console uploads.

## 2) Configure Digital Asset Links

This project serves `/.well-known/assetlinks.json` from env vars.

Set these environment variables on your production host:

- `TWA_PACKAGE_NAME` = your Android package id (example: `com.edulinkwriters.twa`)
- `TWA_SHA256_CERT_FINGERPRINTS` = comma-separated signing cert fingerprints

Example:

```env
TWA_PACKAGE_NAME=com.edulinkwriters.twa
TWA_SHA256_CERT_FINGERPRINTS=12:34:...,AB:CD:...
```

## 3) Publish to Play Store

- Create app in Play Console
- Upload `app-release.aab`
- Complete store listing + content declarations
- Roll out internal testing, then production

## Notes

- If Bubblewrap prompts for missing SDK/JDK, allow installation.
- Re-run build script whenever your PWA manifest/theme/start URL changes.
