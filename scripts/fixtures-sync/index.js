/**
 * Repository-to-repository fixture mirror.
 *
 * Source of truth: committed `fixtures/**` in
 * `pawelogrodnik/redesigned-broccoli@main`, checked out locally (e.g. by the
 * GitHub Action as a second checkout). This script copies that tree into
 * `app/fixtures` with true mirror semantics (stale destination files are
 * removed) and records the backend revision in `app/fixtures/.source.json`.
 *
 * No HTTP/network logic: the backend repository owns fixture generation,
 * the frontend only mirrors committed output.
 *
 * Production destination is hard-confined to app/fixtures: the CLI accepts
 * no destination argument, and --source-sha is mandatory.
 *
 * Usage:
 *   node scripts/fixtures-sync/index.js \
 *     --source .backend-fixtures-source/fixtures \
 *     --source-repo pawelogrodnik/redesigned-broccoli \
 *     --source-ref main \
 *     --source-sha <backend-sha>
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_DEST_DIR = path.join(REPO_ROOT, 'app', 'fixtures');
const DEFAULT_SOURCE_REPO = 'pawelogrodnik/redesigned-broccoli';
const DEFAULT_SOURCE_REF = 'main';
const SOURCE_META_NAME = '.source.json';
// Fail closed: refuse sources that look catastrophically incomplete.
const DEFAULT_MIN_SOURCE_FILES = 50;

function parseArgs(argv) {
  const opts = {
    source: null,
    sourceRepo: process.env.FIXTURES_SOURCE_REPO || DEFAULT_SOURCE_REPO,
    sourceRef: process.env.FIXTURES_SOURCE_REF || DEFAULT_SOURCE_REF,
    sourceSha: process.env.FIXTURES_SOURCE_SHA || null,
    minSourceFiles: DEFAULT_MIN_SOURCE_FILES,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--source') {
      opts.source = next();
    } else if (a.startsWith('--source=')) {
      opts.source = a.slice('--source='.length);
    } else if (a === '--dest' || a.startsWith('--dest=')) {
      throw new Error(
        'The --dest flag is no longer supported: the destination is fixed to app/fixtures.'
      );
    } else if (a === '--allow-external-dest') {
      throw new Error('The --allow-external-dest flag is test-only and not available via the CLI.');
    } else if (a === '--source-repo') {
      opts.sourceRepo = next();
    } else if (a.startsWith('--source-repo=')) {
      opts.sourceRepo = a.slice('--source-repo='.length);
    } else if (a === '--source-ref') {
      opts.sourceRef = next();
    } else if (a.startsWith('--source-ref=')) {
      opts.sourceRef = a.slice('--source-ref='.length);
    } else if (a === '--source-sha') {
      opts.sourceSha = next();
    } else if (a.startsWith('--source-sha=')) {
      opts.sourceSha = a.slice('--source-sha='.length);
    } else if (a === '--min-source-files') {
      opts.minSourceFiles = Number(next());
    } else if (a.startsWith('--min-source-files=')) {
      opts.minSourceFiles = Number(a.slice('--min-source-files='.length));
    } else if (a === '--dry-run') {
      opts.dryRun = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    }
  }
  return opts;
}

function usage() {
  return [
    'Usage: node scripts/fixtures-sync/index.js --source <dir>',
    '       --source-sha <backend-sha> [--source-repo <owner/repo>] [--source-ref <ref>]',
    '       [--min-source-files N] [--dry-run]',
    '',
    'Destination is fixed to app/fixtures and cannot be changed via the CLI.',
  ].join('\n');
}

/**
 * Safety: production destination is hard-confined to <repoRoot>/app/fixtures.
 * Only direct unit-test callers may pass { allowExternalDest: true } with an
 * explicit temp destination; the CLI never does.
 */
function assertDestSafety(destDir, { repoRoot, allowExternalDest }) {
  const resolved = path.resolve(destDir);
  if (allowExternalDest) {
    return resolved;
  }
  const canonical = path.join(path.resolve(repoRoot), 'app', 'fixtures');
  if (resolved !== canonical) {
    throw new Error(
      `Refusing sync outside app/fixtures (got: ${resolved}, expected: ${canonical})`
    );
  }
  return resolved;
}

/** Recursively collect .json fixture files (posix-style relative paths, sorted). */
async function collectJsonFiles(dir) {
  const out = [];
  async function walk(abs, rel) {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) {
        continue;
      } // skip hidden (incl. .source.json)
      const absChild = path.join(abs, ent.name);
      const relChild = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(absChild, relChild);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) {
        out.push(relChild);
      }
    }
  }
  await walk(dir, '');
  return out.sort();
}

async function readExistingMeta(destDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(destDir, SOURCE_META_NAME), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

/**
 * Mirror sourceDir/fixtures tree into destDir.
 * Validates everything BEFORE writing anything (fail closed).
 * Returns a summary object.
 */
async function mirrorFixtures({
  sourceDir,
  destDir,
  repoRoot = REPO_ROOT,
  sourceRepo = DEFAULT_SOURCE_REPO,
  sourceRef = DEFAULT_SOURCE_REF,
  sourceSha = null,
  minSourceFiles = DEFAULT_MIN_SOURCE_FILES,
  dryRun = false,
  allowExternalDest = false,
} = {}) {
  if (!sourceDir) {
    throw new Error('Missing required --source <backend fixtures directory>');
  }
  const sourceAbs = path.resolve(sourceDir);
  const destAbs = assertDestSafety(destDir, { repoRoot, allowExternalDest });

  let stat;
  try {
    stat = await fs.stat(sourceAbs);
  } catch {
    throw new Error(`Backend fixture source does not exist: ${sourceAbs}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Backend fixture source is not a directory: ${sourceAbs}`);
  }

  const sourceFiles = await collectJsonFiles(sourceAbs);
  if (sourceFiles.length === 0) {
    throw new Error(
      `Backend fixture source is empty (no .json files): ${sourceAbs}. Refusing destructive sync.`
    );
  }
  if (sourceFiles.length < minSourceFiles) {
    throw new Error(
      `Backend fixture source has only ${sourceFiles.length} file(s) (minimum ${minSourceFiles}). Refusing sync.`
    );
  }

  // Catastrophic-drop guard: never wipe most of an existing snapshot.
  let destFiles = [];
  try {
    destFiles = await collectJsonFiles(destAbs);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (destFiles.length > 0 && sourceFiles.length < destFiles.length * 0.5) {
    throw new Error(
      `Source has ${sourceFiles.length} file(s) vs ${destFiles.length} in destination (drop >50%). Refusing sync.`
    );
  }

  // Validate: every source .json must parse. No writes happen before this passes.
  const contents = new Map();
  for (const rel of sourceFiles) {
    const raw = await fs.readFile(path.join(sourceAbs, rel), 'utf8');
    try {
      JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in source fixture, aborting sync: ${rel}`);
    }
    contents.set(rel, raw.endsWith('\n') ? raw : `${raw}\n`);
  }
  if (!sourceSha || !String(sourceSha).trim()) {
    throw new Error('Missing required --source-sha <backend commit>; refusing sync.');
  }

  const sourceSet = new Set(sourceFiles);
  const destSet = new Set(destFiles);
  let added = 0;
  let updated = 0;
  let removed = 0;
  const unchanged = { count: 0 };

  if (!dryRun) {
    // Map for case-insensitive filesystems (e.g. macOS): a source file that
    // differs from a destination file only by letter case must be replaced,
    // otherwise the write lands on the stale-cased file and the stale name
    // is then deleted as orphan.
    const destByLower = new Map(destFiles.map((rel) => [rel.toLowerCase(), rel]));
    const handledDest = new Set();
    for (const rel of sourceFiles) {
      const target = path.join(destAbs, rel);
      const next = contents.get(rel);
      let current = null;
      try {
        current = await fs.readFile(target, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      if (current === null) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, next, 'utf8');
        added++;
        continue;
      }
      const onDisk = destByLower.get(rel.toLowerCase());
      if (onDisk && onDisk !== rel) {
        // Case-only rename: remove stale-cased file, then write new.
        await fs.unlink(path.join(destAbs, onDisk));
        handledDest.add(onDisk);
        removed++;
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, next, 'utf8');
        added++;
        continue;
      }
      if (current !== next) {
        await fs.writeFile(target, next, 'utf8');
        updated++;
      } else {
        unchanged.count++;
      }
    }

    // True mirror: remove destination fixtures absent from the source.
    for (const rel of destFiles) {
      if (!sourceSet.has(rel) && !handledDest.has(rel)) {
        try {
          await fs.unlink(path.join(destAbs, rel));
          removed++;
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
          // Already removed by the case-only rename path above.
        }
      }
    }
  } else {
    for (const rel of sourceFiles) {
      if (!destSet.has(rel)) {
        added++;
      } else {
        unchanged.count++;
      }
    }
    for (const rel of destFiles) {
      if (!sourceSet.has(rel)) {
        removed++;
      }
    }
  }

  // Source metadata: avoid needless churn — same SHA => leave file untouched.
  let metaChanged = false;
  const existingMeta = await readExistingMeta(destAbs);
  if (sourceSha && existingMeta && existingMeta.commit === sourceSha) {
    metaChanged = false;
  } else if (sourceSha) {
    const meta = {
      repository: sourceRepo,
      ref: sourceRef,
      commit: sourceSha,
      syncedAt: new Date().toISOString(),
    };
    if (!dryRun) {
      await fs.mkdir(destAbs, { recursive: true });
      await fs.writeFile(
        path.join(destAbs, SOURCE_META_NAME),
        `${JSON.stringify(meta, null, 2)}\n`,
        'utf8'
      );
    }
    metaChanged = true;
  }

  const summary = {
    repository: sourceRepo,
    ref: sourceRef,
    commit: sourceSha,
    sourceFiles: sourceFiles.length,
    added,
    updated,
    removed,
    unchanged: dryRun ? undefined : unchanged.count,
    finalFiles: sourceFiles.length,
    metaChanged,
    dryRun,
  };
  return summary;
}

function printSummary(summary) {
  // eslint-disable-next-line no-console
  console.log(
    [
      '[fixtures-sync] Summary:',
      `  backend: ${summary.repository}@${summary.ref} ${summary.commit || '(unknown sha)'}`,
      `  source fixture files: ${summary.sourceFiles}`,
      `  added: ${summary.added}  updated: ${summary.updated}  removed: ${summary.removed}  unchanged: ${summary.unchanged ?? 'n/a'}`,
      `  final fixture files: ${summary.finalFiles}  metadata: ${summary.metaChanged ? 'updated' : 'unchanged'}`,
    ].join('\n')
  );
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help || !opts.source) {
    // eslint-disable-next-line no-console
    console.log(usage());
    if (!opts.source && !opts.help) {
      throw new Error('Missing required --source <backend fixtures directory>');
    }
    return { help: true };
  }
  if (!opts.sourceSha || !String(opts.sourceSha).trim()) {
    throw new Error('Missing required --source-sha <backend commit>; refusing sync.');
  }
  // Production CLI: destination is always the canonical app/fixtures tree.
  const summary = await mirrorFixtures({
    sourceDir: opts.source,
    destDir: DEFAULT_DEST_DIR,
    repoRoot: REPO_ROOT,
    sourceRepo: opts.sourceRepo,
    sourceRef: opts.sourceRef,
    sourceSha: opts.sourceSha,
    minSourceFiles: opts.minSourceFiles,
    dryRun: opts.dryRun,
  });
  printSummary(summary);
  return summary;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error('[fixtures-sync] Sync failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { mirrorFixtures, collectJsonFiles, parseArgs, main, DEFAULT_DEST_DIR };
