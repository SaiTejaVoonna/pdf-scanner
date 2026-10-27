# Source

Copied from https://github.com/uditgoenka/autoresearch (MIT, see LICENSE), commit 050e30dc4ba0974b03f2873111b9901ec3211390,
version 2.2.2: `.claude/skills/autoresearch` and `.claude/commands/autoresearch*`.

Not installed: the repo's hooks (`.claude/hooks/autoresearch`). They block reading `dist/`, `build/`, `.git/` and `*.log`,
which this project's checks need (built service worker, training logs). Installed by copying reviewed files, not with
`npx skills add`, so no unreviewed package code runs.
