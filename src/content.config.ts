/**
 * コンテンツコレクションの定義（Astro Content Layer）
 *
 * ビルドの最初に 1 回だけ導入事例を読み込み、検証・整形してから保存する。
 * ページからは getCollection('cases') で読む。ページ側は取得元を意識しない。
 *
 * このサンプルでは、WordPress の REST API の代わりにローカルの JSON（架空の応答）を読む。
 * 環境変数 CASES_FILE でファイルを差し替えられる（不正なデータでビルドが止まることの確認用）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { parseCases } from './cms/cases';

const DEFAULT_FILE = 'data/wp-cases.json';

function casesLoader(): Loader {
  return {
    name: 'cases-json-loader',
    load: async ({ store, logger, parseData, generateDigest }) => {
      const file = path.resolve(process.cwd(), process.env.CASES_FILE?.trim() || DEFAULT_FILE);
      const body: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
      //  1 件でも不正なら、ここでエラーになりビルドが止まる
      const records = parseCases(body);
      logger.info(`導入事例を ${records.length} 件読み込みました（${path.relative(process.cwd(), file)}）`);

      store.clear();
      for (const record of records) {
        const data = await parseData({ id: record.slug, data: { ...record } });
        store.set({ id: record.slug, data, digest: generateDigest(data) });
      }
    },
  };
}

const cases = defineCollection({
  loader: casesLoader(),
  //  検証は parseCases で済んでいる。ここは getCollection() の戻り値に型を付けるための宣言
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    date: z.string(),
    modified: z.string(),
    company: z.string(),
    companySize: z.string(),
    person: z.string(),
    industry: z.object({ slug: z.string(), name: z.string() }).nullable(),
    voiceTitle: z.string(),
    voiceText: z.string(),
    challenge: z.string(),
    solution: z.string(),
    result: z.string(),
    metrics: z.array(z.object({ label: z.string(), value: z.string() })),
    showOnTop: z.boolean(),
    image: z.object({ url: z.string(), width: z.number(), height: z.number(), alt: z.string() }),
  }),
});

export const collections = { cases };
