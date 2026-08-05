# CI/CD setup

The pipeline in `.github/workflows/eas-build.yml` connects GitHub to EAS and,
from there, to the Play Store.

```
local dev      ->  npx expo start  ->  Expo Go on your phone
PR opened      ->  verify (install, config, bundle)   ~2 min, no EAS build
merge to main  ->  verify  ->  production AAB  ->  Play Store (internal, draft)
manual run     ->  choose profile, choose whether to submit
```

Day-to-day testing happens locally against Expo Go, so pull requests do not
spend an EAS build slot — they only prove the code installs, configures and
bundles. Merging to `main` is what produces a release.

Builds run on EAS servers; the GitHub runner only orchestrates.

## Local development

```bash
npm install
npx expo start
```

Scan the QR with Expo Go, or enter `exp://<your-lan-ip>:8081` manually. Add
`--tunnel` if the phone and computer are not on the same network.

Note that Expo Go runs your JS inside its own container, so app lifecycle
behaviour (backgrounding, process death) is not identical to a standalone
build. For anything lifecycle-sensitive, build a development client once:

```bash
npx eas-cli build --platform android --profile development
```

That app also hot-reloads from `npx expo start --dev-client`, but with real
standalone lifecycle.

## Required secrets

Both live under **Settings → Secrets and variables → Actions**.

### 1. `EXPO_TOKEN`

Lets CI authenticate to EAS without an interactive login.

1. Go to https://expo.dev/settings/access-tokens
2. **Create token**, name it something like `github-actions`
3. Copy the value (shown once) and add it as the secret `EXPO_TOKEN`

### 2. `GOOGLE_SERVICE_ACCOUNT_KEY`

Lets EAS upload builds to the Play Store. This requires the app to already
exist in the Play Console, and one manual first upload — Google rejects API
submissions for an app that has never had a release.

1. **Play Console → Setup → API access → Choose a project / create new**
2. **Create service account** — this opens Google Cloud Console
3. In Cloud Console: **Create service account**, then under its **Keys** tab
   choose **Add key → Create new key → JSON**. The file downloads once.
4. Back in Play Console → **API access → Grant access** for that account.
   Give it the **Release apps to testing tracks** permission at minimum.
5. Paste the entire contents of the JSON file as the secret
   `GOOGLE_SERVICE_ACCOUNT_KEY`.

The workflow writes this to `google-service-account.json` at runtime and deletes
it immediately afterwards. That filename is gitignored — never commit it.

## First release must be manual

Google's API cannot create a release for an app with no prior upload, so
automatic submission is gated behind a repository variable and starts **off**.

1. Merge to `main` (or run the workflow manually with the `production` profile).
   The AAB builds on EAS; submission is skipped.
2. Download the `.aab` from the build page.
3. Play Console → **Testing → Internal testing** → upload it once by hand.
4. Turn on automatic submission:

   ```bash
   gh variable set PLAY_SUBMIT_ENABLED --body true
   ```

Every later merge to `main` then builds and submits without intervention.

To pause automatic submission at any point, set the variable to `false` — the
build still runs, only the submit step is skipped.

## Version handling

`eas.json` sets `appVersionSource: remote` and `autoIncrement: true` on the
production profile, so EAS manages `versionCode` and bumps it per build. You do
not need to edit it manually; Play rejects duplicate version codes.

The user-facing `version` in `app.json` is still manual — bump it when you want
the displayed version to change.

## Releases land as drafts

`eas.json` sets `releaseStatus: draft`, so a submitted build appears in the Play
Console but is not pushed to testers until you review and roll it out. Change it
to `completed` if you would rather releases go live automatically.

## Testing the pipeline

Trigger a manual run without touching the code:

**Actions → Verify & Release → Run workflow** → profile `preview`, submit off.

That produces an installable APK and exercises everything except submission.
