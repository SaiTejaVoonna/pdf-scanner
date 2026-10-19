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

## Web app on GitHub Pages
The `Web CI` workflow always tests and builds `web/`, and tries to deploy to GitHub Pages on every push to
`claude/amazing-babbage-qr2tmb`. Until Pages is switched on that deploy step cannot work (it is allowed to fail
without failing the run). One setting from the owner turns it on:

1. Repository **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
2. Push any change to the branch, or open **Actions -> Web CI -> Re-run all jobs**.
3. The site appears at `https://<user>.github.io/pdf-scanner/` (for this repo:
   `https://saitejavoonna.github.io/pdf-scanner/`). Note the `/pdf-scanner/` at the end; the bare
   `<user>.github.io` address is a different (user) site and will show a 404.

The build uses relative paths, so it works under that sub-path. Camera access needs HTTPS, which Pages provides.
