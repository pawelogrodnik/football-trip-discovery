# Fixtures Sync

Repository-to-repository mirror: committed `fixtures/**` from
`pawelogrodnik/redesigned-broccoli@main` is copied into `app/fixtures`,
preserving relative paths. Stale destination files (removed from the backend
source) are deleted; nothing outside `app/fixtures` is ever touched.

No backend HTTP API is involved. The old `FIXTURES_SYNC_API_URL` /
`FIXTURES_SYNC_API_KEY` configuration is obsolete and has been removed.

## Running locally

Check out the backend repository next to (or inside) this one, then:

```bash
node scripts/fixtures-sync/index.js \
  --source ../redesigned-broccoli/fixtures \
  --source-repo pawelogrodnik/redesigned-broccoli \
  --source-ref main \
  --source-sha "$(git -C ../redesigned-broccoli rev-parse HEAD)"
```

Options:

| Flag                 | Description                                       | Default                             |
| -------------------- | ------------------------------------------------- | ----------------------------------- |
| `--source`           | Backend `fixtures` directory (required).          | —                                   |
| `--dest`             | Destination directory.                            | `app/fixtures`                      |
| `--source-repo`      | Recorded in `.source.json`.                       | `pawelogrodnik/redesigned-broccoli` |
| `--source-ref`       | Recorded in `.source.json`.                       | `main`                              |
| `--source-sha`       | Exact backend commit, recorded in `.source.json`. | _empty_                             |
| `--min-source-files` | Fail closed below this source file count.         | `50`                                |
| `--dry-run`          | Validate and report without writing.              | —                                   |

## Safeguards (fail closed)

- Missing/empty source aborts before anything is written.
- Every source `.json` must parse, otherwise the sync aborts with no writes.
- A source with >50% fewer files than the current snapshot aborts.
- Writes and deletions are confined to the destination fixture directory.
- `app/fixtures/.source.json` records `{ repository, ref, commit, syncedAt }`.
  Re-running with the same backend SHA leaves it (and unchanged fixtures)
  untouched, so no-op syncs produce no commit.

## Scheduler

`.github/workflows/fixtures-sync.yml` checks out both repositories (the
backend checkout needs a fine-grained PAT in the `BACKEND_REPO_TOKEN` secret
with **Contents: Read** on `pawelogrodnik/redesigned-broccoli`), mirrors the
tree, runs `npx jest scripts/fixtures-sync`, and commits `app/fixtures/**`
only when something changed.

## Tests

```bash
npx jest scripts/fixtures-sync
```
