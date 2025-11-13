const fs = require('node:fs/promises');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixturesRoot = path.join(
  repoRoot,
  process.env.FIXTURES_SYNC_TARGET_DIR || path.join('app', 'fixtures')
);

const API_BASE = process.env.FIXTURES_SYNC_API_URL || 'http://localhost:4000';
const API_KEY = process.env.FIXTURES_SYNC_API_KEY || '';

function ensureFixturesRootSafety(resolvedPath) {
  if (!resolvedPath.startsWith(fixturesRoot)) {
    throw new Error(`Refusing to write outside fixtures directory: ${resolvedPath}`);
  }
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function serializeValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return `${JSON.stringify(JSON.parse(value), null, 2)}\n`;
      } catch {
        // fall through to writing the raw string
      }
    }
    return ensureTrailingNewline(value);
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeIfChanged(targetPath, content) {
  try {
    const current = await fs.readFile(targetPath, 'utf8');
    if (current === content) {
      return false;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
  return true;
}

function normalizeResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Fixtures API did not return an object payload');
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'files') &&
    payload.files &&
    typeof payload.files === 'object' &&
    !Array.isArray(payload.files)
  ) {
    return payload.files;
  }

  return payload;
}

function resolveFixturePath(relativePath) {
  const sanitized = relativePath.replace(/^[/\\]+/, '');
  const resolved = path.join(fixturesRoot, sanitized);
  ensureFixturesRootSafety(resolved);
  return resolved;
}

async function fetchFixturesPayload() {
  const response = await fetch(`${API_BASE}/api/fixtures`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fixtures API failed (${response.status}): ${response.statusText}\n${body}`);
  }
  return normalizeResponse(await response.json());
}

async function main() {
  console.log(`[fixtures-sync] Fetching data from ${API_BASE}`);
  const payload = await fetchFixturesPayload();
  const entries = Object.entries(payload);

  if (entries.length === 0) {
    console.log('[fixtures-sync] No fixtures returned; nothing to do.');
    return;
  }

  const touched = [];
  for (const [relativePath, value] of entries) {
    const targetPath = resolveFixturePath(relativePath);
    const serialized = serializeValue(value);
    const changed = await writeIfChanged(targetPath, serialized);
    if (changed) {
      touched.push(path.relative(repoRoot, targetPath));
      console.log(`[fixtures-sync] Updated ${path.relative(repoRoot, targetPath)}`);
    }
  }

  if (touched.length === 0) {
    console.log('[fixtures-sync] All fixture files already up to date.');
  } else {
    console.log(
      `[fixtures-sync] Updated ${touched.length} file(s).\n` +
        touched.map((file) => `  - ${file}`).join('\n')
    );
  }
}

main().catch((error) => {
  console.error('[fixtures-sync] Sync failed:', error);
  process.exitCode = 1;
});
