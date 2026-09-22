# CHAMAZ360 Frontend

React + TypeScript + Vite frontend for the Chama App, now packaged with Capacitor for Android.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- TanStack Query
- Zustand
- Axios
- Tailwind CSS
- Capacitor

## Development

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173.

## Web Production Build

```bash
npm run build
npm run preview
```

## Android Packaging with Capacitor

### Installed packages

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`

### Config

- Capacitor config: [client/capacitor.config.ts](./capacitor.config.ts)
- Android project: [client/android](./android)
- Web output directory: `dist`
- Android release signing properties: [client/android/keystore.properties](./android/keystore.properties)
- Signing template: [client/android/keystore.properties.example](./android/keystore.properties.example)

### Scripts

- `npm run mobile:assets` - generate Android launcher and splash assets from `public/logo.png`
- `npm run mobile:build` - generate assets, build the web app, and sync Capacitor
- `npm run mobile:sync` - generate assets, build, and sync Android only
- `npm run mobile:add:android` - add the Android platform again if needed
- `npm run mobile:open:android` - open the Android project in Android Studio
- `npm run mobile:release` - generate assets, embed the production HTTPS API, sync, and assemble a signed release APK

### Backend URL for Android

The packaged Android app cannot use browser localhost. Use one of these:

- `VITE_ANDROID_API_URL=http://10.0.2.2:3000/api/v1` for the Android emulator
- `VITE_ANDROID_API_URL=http://192.168.100.22:3000/api/v1` for a physical phone on the same Wi-Fi network
- `VITE_API_URL=https://chamaz360.co.ke/api/v1` and `VITE_ANDROID_API_URL=https://chamaz360.co.ke/api/v1` for production builds

If `VITE_ANDROID_API_URL` is not set, the app falls back to `VITE_API_URL`, then to `http://10.0.2.2:3000/api/v1`.

For physical phone APK builds, use the Android mode so Vite reads `.env.android`:

```bash
npm run mobile:build:android
```

### Native notes

- The app uses `HashRouter`, which works well inside Capacitor.
- Release builds disable cleartext traffic. The `lanTest` build type permits it for controlled local-network testing.
- The release build uses the ignored `client/android/chamaz360-production.jks` keystore and reads credentials from the ignored `client/android/keystore.properties` file.

### Typical Android workflow

1. Start the backend.
2. Set `VITE_ANDROID_API_URL` for your environment, or use [client/.env.android](./.env.android) for the LAN IP.
3. Run `npm run mobile:build:android` for a physical phone, or `npm run mobile:build` for production-style output.
4. Open Android Studio with `npm run mobile:open:android`.
5. Build or run the APK from Android Studio.

### Physical phone requirements

- Computer and phone must be on the same Wi-Fi network.
- Backend must listen on `0.0.0.0` or another LAN-accessible host.
- Firewall must allow inbound traffic on port `3000`.
- Install the APK built with the Android mode so it uses `VITE_ANDROID_API_URL`.

### Release workflow

1. Confirm that `client/android/keystore.properties` points to the original release keystore used to sign the installed app.
2. Run `npm run mobile:release`.
3. Find the signed APK under `client/android/app/build/outputs/apk/release/`.

The release script always embeds `https://chamaz360.co.ke/api/v1`. Development builds made with `build:android` or `mobile:build:android` may continue to use `.env.android` for emulator or LAN APIs.

### Android auto-update

The installed APK checks the backend `/health` response on startup for release metadata:

- `ANDROID_LATEST_VERSION`
- `ANDROID_MIN_SUPPORTED_VERSION`
- `ANDROID_UPDATE_URL`
- `ANDROID_FORCE_UPDATE`

When the installed app version is older than the published release, it shows an update prompt. If the backend marks the installed version as below the minimum supported version, the prompt becomes blocking and the user must update before continuing.

Use the APK download URL that you host on your server or file storage. Android still requires the user to confirm the install of the new APK.

## Environment Variables

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_ANDROID_API_URL=http://10.0.2.2:3000/api/v1
VITE_APP_VERSION=1.0.0
```

## Notes

- The auth refresh flow now uses hash-based navigation so it behaves correctly in both web and Android builds.
- The Android project is generated under `client/android/` and can be synced whenever the web bundle changes.
- Android launcher/splash assets are generated from the existing web logo and stored under the Capacitor resource folders.
