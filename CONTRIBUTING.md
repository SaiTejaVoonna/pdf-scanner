# Contributing

## Getting started
1. Install JDK 17+ and Android Studio (or the Android SDK with Platform 35 and Build-Tools 35).
2. Open the project in Android Studio, or create `local.properties` with `sdk.dir=/path/to/Android/sdk`
   (this file is git-ignored; never commit it).
3. `./gradlew testDebugUnitTest lintDebug assembleDebug` should pass before you push. CI runs the same.

## Guidelines
- Put code in the package that matches its responsibility (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)). Keep `domain/`,
  and the pure parts of `imaging/` and `pdf/`, free of Android classes so they stay JVM-testable.
- Add or update tests with behaviour changes (`app/src/test/`). Robolectric is available for Room, bitmaps
  and Compose.
- User-facing text belongs in `res/values/strings.xml`; keep controls labelled for TalkBack.
- Do not add the `INTERNET` permission or any network, analytics or upload code: the app is offline by design.
- Never commit scans, PDFs, photos, keystores, credentials or `local.properties`.
- Dependency versions live in `gradle/libs.versions.toml`. The Room schema in `app/schemas/` is tracked;
  commit schema changes together with a migration.

## Releases
Only the repository owner tags releases (`vX.Y.Z`, matching `versionName`). Signing keys and secrets are
owner-managed and must never be added to the repository.
