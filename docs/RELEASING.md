# Releasing

- **Every push** to `claude/amazing-babbage-qr2tmb` (or any branch) runs CI. On that branch it also refreshes the
  rolling pre-release **`latest-debug`**, which holds `pdf-scanner-debug.apk`. That is the stable download link.
- **Versioned beta/stable release:** the owner bumps `versionName` in `app/build.gradle.kts` (for example
  `1.0.0-beta.2`), then pushes a matching tag: `git tag v1.0.0-beta.2 && git push origin v1.0.0-beta.2`. The
  workflow checks the tag matches `versionName`, waits for tests and lint, and publishes a GitHub pre-release
  with the debug APK.
- APKs are **debug-signed** and meant for testing. The workflow uses no secrets. For Play Store distribution
  the owner must create an upload key, store it as repository secrets, and add a signed `bundleRelease` job.
  Never commit keystores or credentials.
