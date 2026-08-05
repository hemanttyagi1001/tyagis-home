# CI/CD setup

The pipeline in `.github/workflows/eas-build.yml` connects GitHub to EAS and,
from there, to the Play Store.

```
PR opened      ->  verify (install, config, bundle)  ->  preview APK
merge to main  ->  verify                            ->  production AAB  ->  Play Store (internal, draft)
manual run     ->  choose profile, choose whether to submit
```

Builds run on EAS servers; the GitHub runner only orchestrates. `verify` runs
first so a syntax error or bad import fails in ~2 minutes instead of consuming
an EAS build slot.

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

Google's API cannot create a release for an app with no prior upload. Before the
automated submit will work:

```bash
npx eas-cli build --platform android --profile production
```

Download the resulting `.aab` and upload it once by hand in the Play Console
under **Testing → Internal testing**. Every later push to `main` submits
automatically.

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

**Actions → EAS Build & Submit → Run workflow** → profile `preview`, submit off.

That produces an installable APK and exercises everything except submission.
