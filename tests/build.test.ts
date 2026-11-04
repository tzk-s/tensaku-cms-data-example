/**
 * ビルドの確認：不正なデータを読ませると astro build が失敗し、ページを書き出さないこと
 * 実際に astro build を起動するため、ほかのテストより時間がかかる。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const outDir = mkdtempSync(path.join(tmpdir(), 'cases-build-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('astro build', () => {
  it('不正なデータではビルドが失敗し、理由をログに出す', () => {
    const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', outDir], {
      env: { ...process.env, CASES_FILE: 'tests/fixtures/invalid-cases.json' },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/「broken-case」[\s\S]*企業名が空です/);
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(false);
  }, 120_000);
});
