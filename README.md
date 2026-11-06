# FMI Airport Weather

![Screen capture](./assets/screencap.png)

A React Native mobile application displaying live weather observations for Oulu and Turku airports, utilizing the Finnish Meteorological Institute (FMI) WFS 2.0.0 open data API.

## Features
* Live parsing of FMI `timevaluepair` XML data.
* Dynamic UI adapting to live metrics (temperature, wind, air pressure, rain).
* Map integration displaying airport locations using OpenStreetMap and Leaflet (100% free, no API keys required).
* Pull-to-refresh functionality with next-update estimations.

## Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.
* **Expo Go** app installed on your physical iOS or Android device (for local development).
* Both your mobile device and your host computer must be on the same Wi-Fi network.

## 1. Local Development (Expo Go)

This project runs entirely inside a Dockerized Node environment. You do not need Node.js installed on your host machine.

1. Clone the repository and navigate into the folder.
2. Find your computer's local Wi-Fi IP address (e.g., `192.168.1.50`).
3. Export your IP address as an environment variable before starting Docker:
   ```bash
   export MY_WLAN_IP=192.AAA.BB.CCC
   docker compose up
   ```

Once the Metro bundler starts, it will display a QR code in your terminal.

Open the Expo Go app on your phone and scan the QR code to load the app.

Edit src/app/index.tsx on your host machine. The Docker volume will detect the changes and instantly Fast Refresh (Hot-Reload) the app on your phone.

## 2. Building a Standalone Android APK
To build a standalone .apk that runs independently of Expo Go, you will use Expo Application Services (EAS).

### 2.1 Open a shell inside the running container:

  ```bash
   docker compose exec -it expo-app bash
   ```

### 2.2 Install the EAS CLI and Authenticate:
   If you use a standard Expo account with a password, log in interactively:
   ```bash
   npm install -g eas-cli
   eas login
   ```
*If you use SSO (GitHub/Google) or CI/CD, authenticate via token instead:*
   ```bash
   export EXPO_TOKEN="your_personal_access_token_here"
   eas whoami
   ```

### 2.3 Initialize the project with your Expo account (this will inject a new projectId into your app.json):
This will inject a new `projectId` into your `app.json`:
```bash
eas build:configure
```

### 2.4 Trigger the cloud build. (Note: Because of Docker/Git file ownership mismatches, we bypass Git packaging using EAS_NO_VCS=1):
Because of Docker/Git file ownership mismatches, bypass Git packaging using `EAS_NO_VCS=1`:
```bash
EAS_NO_VCS=1 eas build -p android --profile preview
```
Follow the terminal prompts to generate a new Android Keystore (if needed).

### 2.5 Install APK to your device
When the build finishes (~5-10+ minutes depending on the usage load), EAS will provide a link to download the APK. Download it to your host machine and install it via ADB over USB:
```bash
adb install path/to/your-app.apk
```
*(Alternatively, you can scan the provided QR code directly with your Android device).*
