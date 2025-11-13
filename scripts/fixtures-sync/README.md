# Fixtures Sync

Utility script that downloads fixture JSON blobs from your private API and mirrors
them into `app/fixtures`. Keys from the API response are treated as paths inside
that directory (for example `EU/fixtures_UCL.json` becomes
`app/fixtures/EU/fixtures_UCL.json`).

## Running locally

```bash
FIXTURES_SYNC_API_URL=http://localhost:4000/api/fixtures \
FIXTURES_SYNC_API_KEY=dev-key \
npm run sync:fixtures
```

Environment variables:

| Name | Description | Default |
| --- | --- | --- |
| `FIXTURES_SYNC_API_URL` | Full URL of the backend endpoint that returns a record of fixture files. | `http://localhost:4000/api/fixtures` |
| `FIXTURES_SYNC_API_KEY` | Optional key forwarded as `x-api-key`. | _empty_ |
| `FIXTURES_SYNC_TARGET_DIR` | Where to write the files relative to repo root. | `app/fixtures` |

The endpoint must return an object where each key represents a path (relative to
`app/fixtures`) and the value is any JSON-serialisable payload for that file.
If the response wraps those keys in a top-level `files` property, the script
will use that instead.

## Scheduler

See `.github/workflows/fixtures-sync.yml` for an example GitHub Actions cron job
that runs the script weekly, commits any changes under `app/fixtures`, and
pushes them back to the repository.
