# Build & release

Two separate things, on two separate machines:

```
develop   ->  npx expo start          ->  Expo Go on your phone      (no build)
verify    ->  GitHub Actions          ->  install, config, bundle    (~2 min)
release   ->  npm run build:aab       ->  signed .aab on this PC     (~8 min)
          ->  Play Console upload     ->  Internal testing
```

Expo Go is the whole development loop. Nothing is built to release it except on
your own machine, with your own keystore. There is no EAS build, no cloud queue,
and no service-account key in CI.

## Local development

```bash
npm install
npx expo start
```

Scan the QR with Expo Go, or enter `exp://<your-lan-ip>:8081` manually. Add
`--tunnel` if the phone and computer are not on the same network.

Expo Go runs your JS inside its own container, so app lifecycle behaviour
(backgrounding, process death, the background-fetch task) is **not** identical
to a standalone build. Anything lifecycle-sensitive has to be checked against a
real build — install the release APK once and test against that:

```bash
npm run build:apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Prerequisites for building

These only matter on the machine that produces releases.

| Requirement | Notes |
|---|---|
| JDK 17+ | `java -version`. Confirmed working on Temurin/Microsoft JDK 21. |
| Android SDK | `ANDROID_HOME` must be set. Installed with Android Studio. |
| NDK | Pulled in by the SDK; the build compiles native code for 4 ABIs. |
| Release keystore | `tyagis-home-release.jks` — see below. |

## Signing

Release signing is wired up by the `./plugins/withReleaseSigning` config plugin.
`expo prebuild` regenerates `android/app/build.gradle` from a template that signs
release builds with the **debug** key, which the Play Store rejects at upload
time. The plugin re-adds a `release` signing config on every prebuild so the fix
cannot be forgotten.

Credentials are read at build time from `android/keystore.properties`:

```properties
storeFile=D:/Data/google secrets/keystores/tyagis-home-release.jks
storePassword=...
keyAlias=tyagis-home
keyPassword=...
```

> **`android/keystore.properties` is not generated, and `android/` is gitignored.**
> It exists only on this machine. `npx expo prebuild --clean` deletes the whole
> `android/` directory, this file with it — back it up before ever passing
> `--clean`, or the build silently produces an unsigned artifact. The plugin
> treats a missing file as "no release config", so there is no error to warn you.

The keystore itself is **not in this repo and must never be**. Losing it means
losing the ability to update the app on Play — Google will not accept a
different signing key for an existing listing. Keep an offline backup of both
the `.jks` and its passwords.

Current signing certificate:

```
CN=Hemant Kumar Tyagi, OU=Personal, O=Tyagis Home, L=Unknown, ST=Unknown, C=IN
SHA256: F1:6B:2E:EC:E9:3C:24:1B:B1:8D:C4:45:A8:8C:7C:2A:82:FD:03:37:8F:C3:B9:6A:18:9D:02:4E:10:42:A1:E1
```

## Building a release

```bash
npm run build:aab
```

That runs `expo prebuild --platform android` (syncing `app.json` into the native
project and reapplying the config plugins) and then `gradlew bundleRelease`.
Roughly 8 minutes cold, since it compiles native code for `armeabi-v7a`,
`arm64-v8a`, `x86` and `x86_64`.

Output:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Verify it before uploading — the failure this catches is a debug-signed bundle,
which Play rejects only after the upload finishes:

```bash
jarsigner -verify -certs -verbose:summary \
  android/app/build/outputs/bundle/release/app-release.aab
```

Expect `jar verified.` and the `CN=Hemant Kumar Tyagi` owner above. `CN=Android
Debug` means the signing config did not apply — check that
`android/keystore.properties` still exists.

## Version handling

Both values live in `app.json` and are read straight into the native project by
prebuild. Nothing increments them for you.

| Field | Where | Bump when |
|---|---|---|
| `version` | `expo.version` | The user-facing version changes. |
| `versionCode` | `expo.android.versionCode` | **Every** upload to Play. |

Play rejects a `versionCode` it has already seen, so bump it before each release
build. Gaps are fine; going backwards is not.

> Historical note: this project previously built on EAS with
> `appVersionSource: "remote"`, which kept the counter on Expo's servers and
> ignored `app.json` entirely. Codes 3–7 were issued that way. Local builds
> resume from **8**, safely clear of anything EAS handed out.

## Uploading to the Play Store

Manual, from the Play Console — there is no automated submission and no
service-account key anywhere in this repo.

1. **Play Console → Tyagi's Home → Testing → Internal testing**
2. **Create new release**
3. Upload `android/app/build/outputs/bundle/release/app-release.aab`
4. Fill in the release notes, then **Save** → **Review release**
5. Roll out to the internal track

Promote internal → closed → production from the same screen once you are happy.

Store listing copy and graphics are in [store-listing.md](store-listing.md) and
`store/`.

## Release checklist

1. `git pull` and confirm CI is green on `main`.
2. Bump `expo.android.versionCode` in `app.json` (and `expo.version` if the
   user-facing version changed).
3. `npm run build:aab`
4. `jarsigner -verify` the output, checking the certificate owner.
5. Upload to Internal testing, roll out, verify the install on a real device.
6. Commit the version bump.
