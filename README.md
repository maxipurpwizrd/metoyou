# MeToYou

MeToYou is a native Expo application using Expo Router.

## Requirements

- Node.js 24 LTS
- npm
- Expo Go for general JavaScript/UI preview
- An EAS account and the EAS CLI for Android development builds

## Local setup

1. Copy `.env.example` to `.env` and set the Supabase URL and public client key.
2. Install dependencies with `npm install`.
3. Start the Expo development server with `npm start`.
4. Scan the terminal QR code with Expo Go on Android or iOS.

Run `npm run typecheck` to type-check the project.

## Native audio and video calls

Native calling uses WebRTC and requires a custom development build; it does not run in Expo Go. Rebuild and reinstall the development app after adding or changing native call dependencies or permissions.

1. Build and install the Android development app with `npm run build:development:android` (or create an iOS development build with `eas build --profile development --platform ios`).
2. Start Metro with `npm start` and open the installed MeToYou development build.
3. Sign in on two devices/accounts, open each other's chat, and use the phone or video button to test outgoing, incoming, accept, decline, mute, speaker, camera, and hang-up controls.

Incoming call signaling is active while MeToYou is running. System call UI and reliable incoming-call delivery while the app is backgrounded or terminated (CallKit/ConnectionService and push notifications) are not included yet. Call setup currently uses the same public STUN server as the web client and does not add a TURN relay.

## Android Device Files testing

Expo Go does not declare the Android audio-library permission required to scan the device's media library. Automatic MP3 listing therefore requires an installed Android development build; it cannot be enabled by changing Expo Go's permissions.

The development build scans the Android audio library when **Device Files** opens and lists MP3 files. iOS uses the system file picker because iOS does not provide apps a general media-library scan for audio files.

1. Install and sign in to EAS CLI: `npm install --global eas-cli`, then `eas login`.
2. Configure the EAS project once: `eas build:configure`.
3. Build an Android development APK: `npm run build:development:android`.
4. Install the generated APK on the Android device.
5. Start Metro with `npm start` and open the installed MeToYou development build.
6. Open Tracks, open the full-screen list, and select **Device Files**. Grant audio access when prompted.

The Expo Media Library config declares audio, photo, and video permissions because the app also saves Flicks and Clips to the device library.
