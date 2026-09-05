const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { mirrorFixtures } = require('../index');

async function makeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
}

async function listAll(dir) {
  const out = [];
  async function walk(abs, rel) {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const ent of entries) {
      const absChild = path.join(abs, ent.name);
      const relChild = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(absChild, relChild);
      } else {
        out.push(relChild);
      }
    }
  }
  await walk(dir, '');
  return out.sort();
}

describe('fixtures-sync mirror', () => {
  let tmp;
  let source;
  let dest;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fixtures-sync-'));
    source = path.join(tmp, 'backend', 'fixtures');
    dest = path.join(tmp, 'frontend', 'app', 'fixtures');
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  const opts = () => ({
    sourceDir: source,
    destDir: dest,
    repoRoot: tmp,
    allowExternalDest: true,
    sourceRepo: 'pawelogrodnik/redesigned-broccoli',
    sourceRef: 'main',
    sourceSha: 'abc123',
  });

  test('recursive mirror preserves subdirectories and copies new files', async () => {
    await makeTree(source, {
      'LOCAL/POLAND/PL-MA/a.json': '{"matches":[]}',
      'LOCAL/EU/b.json': '{"x":1}',
    });
    const summary = await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    expect(summary.added).toBe(2);
    expect(summary.finalFiles).toBe(2);
    expect(await listAll(dest)).toEqual([
      '.source.json',
      'LOCAL/EU/b.json',
      'LOCAL/POLAND/PL-MA/a.json',
    ]);
  });

  test('updated file replaced, stale destination file removed', async () => {
    await makeTree(source, { 'a.json': '{"v":2}' });
    await makeTree(dest, {
      'a.json': '{"v":1}',
      'stale.json': '{"old":true}',
    });
    const summary = await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    expect(summary.updated).toBe(1);
    expect(summary.removed).toBe(1);
    expect(JSON.parse(await fs.readFile(path.join(dest, 'a.json'), 'utf8'))).toEqual({ v: 2 });
    await expect(fs.stat(path.join(dest, 'stale.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('invalid JSON aborts before any write', async () => {
    await makeTree(source, {
      'ok.json': '{"ok":true}',
      'bad.json': '{not json',
    });
    await expect(mirrorFixtures({ ...opts(), minSourceFiles: 1 })).rejects.toThrow(/Invalid JSON/);
    await expect(fs.stat(dest)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('empty source aborts (fail closed)', async () => {
    await fs.mkdir(source, { recursive: true });
    await makeTree(dest, { 'keep.json': '{}' });
    await expect(mirrorFixtures({ ...opts(), minSourceFiles: 1 })).rejects.toThrow(/empty/);
    expect(await listAll(dest)).toEqual(['keep.json']);
  });

  test('catastrophic drop guard refuses to wipe snapshot', async () => {
    await makeTree(source, { 'only.json': '{}' });
    await makeTree(dest, {
      'f1.json': '{}',
      'f2.json': '{}',
      'f3.json': '{}',
      'f4.json': '{}',
    });
    await expect(mirrorFixtures({ ...opts(), minSourceFiles: 1 })).rejects.toThrow(/drop/);
  });

  test('missing source directory aborts', async () => {
    await expect(
      mirrorFixtures({ ...opts(), sourceDir: path.join(tmp, 'nope'), minSourceFiles: 1 })
    ).rejects.toThrow(/does not exist/);
  });

  test('destination safety: refuses paths outside the repo', async () => {
    await makeTree(source, { 'a.json': '{}' });
    await expect(
      mirrorFixtures({
        sourceDir: source,
        destDir: '/tmp/elsewhere-fixtures',
        repoRoot: tmp,
        minSourceFiles: 1,
      })
    ).rejects.toThrow(/app\/fixtures/);
  });

  test('files outside app/fixtures are untouched', async () => {
    await makeTree(source, { 'a.json': '{}' });
    const outside = path.join(tmp, 'other.txt');
    await fs.writeFile(outside, 'do not touch', 'utf8');
    await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    expect(await fs.readFile(outside, 'utf8')).toBe('do not touch');
    expect(await listAll(dest)).toEqual(['.source.json', 'a.json']);
  });

  test('source metadata contains backend SHA; same SHA re-run is a no-op', async () => {
    await makeTree(source, { 'a.json': '{"v":1}' });
    const first = await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    expect(first.metaChanged).toBe(true);
    const meta = JSON.parse(await fs.readFile(path.join(dest, '.source.json'), 'utf8'));
    expect(meta.repository).toBe('pawelogrodnik/redesigned-broccoli');
    expect(meta.ref).toBe('main');
    expect(meta.commit).toBe('abc123');
    expect(typeof meta.syncedAt).toBe('string');

    const before = await fs.stat(path.join(dest, '.source.json'));
    await new Promise((r) => setTimeout(r, 10));
    const second = await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.removed).toBe(0);
    expect(second.metaChanged).toBe(false);
    const after = await fs.stat(path.join(dest, '.source.json'));
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  test('new SHA updates metadata', async () => {
    await makeTree(source, { 'a.json': '{}' });
    await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    const second = await mirrorFixtures({ ...opts(), minSourceFiles: 1, sourceSha: 'def456' });
    expect(second.metaChanged).toBe(true);
    const meta = JSON.parse(await fs.readFile(path.join(dest, '.source.json'), 'utf8'));
    expect(meta.commit).toBe('def456');
  });

  test('case-only rename replaces stale file instead of deleting it', async () => {
    await makeTree(source, { 'fixtures_POLISH_X.json': '{"v":2}' });
    await makeTree(dest, { 'fixtures_Polish_X.json': '{"v":1}' });
    const summary = await mirrorFixtures({ ...opts(), minSourceFiles: 1 });
    expect(summary.removed).toBe(1);
    expect(summary.added).toBe(1);
    const names = await fs.readdir(dest);
    expect(names).toContain('fixtures_POLISH_X.json');
    expect(
      JSON.parse(await fs.readFile(path.join(dest, 'fixtures_POLISH_X.json'), 'utf8'))
    ).toEqual({ v: 2 });
  });
});

describe('fixtures-sync destination confinement', () => {
  const { main, parseArgs } = require('../index');
  let tmp;
  let source;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fixtures-confine-'));
    source = path.join(tmp, 'backend', 'fixtures');
    await makeTree(source, { 'a.json': '{"v":1}', 'sub/b.json': '{"v":2}' });
    // Sentinel files that must never be touched by a rejected sync.
    await makeTree(tmp, {
      'package.json': '{"name":"sentinel"}',
      'scripts/keep.json': '{"keep":true}',
      'app/data.json': '{"keep":true}',
    });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  const baseOpts = () => ({
    sourceDir: source,
    repoRoot: tmp,
    sourceSha: 'abc123',
    minSourceFiles: 1,
  });

  async function expectRejected(destDir) {
    await expect(mirrorFixtures({ ...baseOpts(), destDir })).rejects.toThrow();
    // Nothing modified: sentinels intact, no new files.
    expect(await fs.readFile(path.join(tmp, 'package.json'), 'utf8')).toBe('{"name":"sentinel"}');
    expect(await fs.readFile(path.join(tmp, 'scripts', 'keep.json'), 'utf8')).toBe('{"keep":true}');
    expect(await fs.readFile(path.join(tmp, 'app', 'data.json'), 'utf8')).toBe('{"keep":true}');
    expect(await listAll(tmp)).toEqual(
      [
        'app/data.json',
        'backend/fixtures/a.json',
        'backend/fixtures/sub/b.json',
        'package.json',
        'scripts/keep.json',
      ].sort()
    );
  }

  test('A. repo root rejected', async () => {
    await expectRejected(tmp);
  });

  test('B. sibling repo directory rejected', async () => {
    await expectRejected(path.join(tmp, 'scripts'));
  });

  test('C. parent of fixtures rejected', async () => {
    await expectRejected(path.join(tmp, 'app'));
  });

  test('D. canonical app/fixtures accepted', async () => {
    const summary = await mirrorFixtures({
      ...baseOpts(),
      destDir: path.join(tmp, 'app', 'fixtures'),
    });
    expect(summary.added).toBe(2);
    expect(summary.finalFiles).toBe(2);
  });

  test('E. traversal equivalent rejected', async () => {
    await expectRejected(path.join(tmp, 'app', 'fixtures', '..'));
  });

  test('F. test-only temp destination works with explicit override', async () => {
    const tempDest = path.join(tmp, 'custom-dest');
    const summary = await mirrorFixtures({
      ...baseOpts(),
      destDir: tempDest,
      allowExternalDest: true,
    });
    expect(summary.added).toBe(2);
    expect(await listAll(tempDest)).toEqual(['.source.json', 'a.json', 'sub/b.json']);
  });

  test('temp destination without override is rejected', async () => {
    await expect(
      mirrorFixtures({ ...baseOpts(), destDir: path.join(tmp, 'custom-dest') })
    ).rejects.toThrow();
  });

  test('G. missing source SHA rejected by CLI before any write', async () => {
    await expect(main(['--source', source, '--min-source-files', '1'])).rejects.toThrow(
      /source-sha/i
    );
    expect(await listAll(tmp)).toEqual(
      [
        'app/data.json',
        'backend/fixtures/a.json',
        'backend/fixtures/sub/b.json',
        'package.json',
        'scripts/keep.json',
      ].sort()
    );
  });

  test('CLI rejects --dest and --allow-external-dest flags', async () => {
    expect(() => parseArgs(['--source', source, '--dest', '.'])).toThrow(/--dest/);
    expect(() => parseArgs(['--source', source, '--allow-external-dest'])).toThrow(/test-only/);
  });
});
