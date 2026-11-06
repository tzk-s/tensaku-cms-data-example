/**
 * 導入事例 — WordPress REST API の形を検証し、画面で使う形（CaseRecord）にそろえる
 *
 * 【流れ】（呼び出し元は src/content.config.ts）
 *   1. 受け取る … WordPress の /wp-json/wp/v2/cases の応答（このサンプルではローカルの JSON）
 *   2. 検証する … 必須項目・型を zod で確認する。1 件でも不正ならエラーを投げ、ビルドを止める
 *   3. 整形する … HTML 実体参照（&#038; など）を文字に戻し、画面で使う形にそろえる
 *   4. 並べる   … 公開日の新しい順。スラッグが重複していたら止める
 *
 * 【ビルドを止める理由】
 *   一部の事例が欠けたまま公開されるより、ビルドを失敗させて気付けるほうが安全なため。
 *   ビルドが失敗したときに前回の公開内容が残るかどうかは配信環境の仕組みによる（このサンプルには含まない）。
 */
import { z } from 'astro/zod';
import { decodeWpText, describeItem, parseOrThrow, requiredText, slugText, wpDateText } from './text';

const metricSchema = z.object({
  label: requiredText('数値の項目名'),
  value: requiredText('数値の値'),
});

/** 業種は未設定（null）でもよい */
const industrySchema = z.object({ slug: requiredText('業種スラッグ'), name: requiredText('業種名') }).nullable();

/** WordPress REST API の 1 件分。案件固有の項目は tensaku フィールドにまとめて返す */
export const wpCaseSchema = z.object({
  id: z.number().int(),
  slug: slugText,
  title: z.object({ rendered: requiredText('見出し') }),
  date: wpDateText('公開日'),
  modified: wpDateText('更新日'),
  tensaku: z.object({
    company: requiredText('企業名'),
    companySize: z.string(),
    person: requiredText('お話を伺った方'),
    voiceTitle: requiredText('トップの見出し'),
    voiceText: requiredText('トップの本文'),
    challenge: requiredText('導入前の課題'),
    solution: requiredText('導入・活用の方法'),
    result: requiredText('導入後の効果'),
    showOnTop: z.boolean(),
    industry: industrySchema,
    metrics: z.array(metricSchema).max(3),
    image: z.object(
      {
        url: z.url(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        alt: requiredText('画像の代替テキスト'),
      },
      { error: 'アイキャッチ画像が設定されていません' }
    ),
  }),
});

export type WpCase = z.infer<typeof wpCaseSchema>;

/** 画面で使う 1 件分。WordPress の入れ子（title.rendered・tensaku.*）を平らにし、文字列は実体参照を戻した状態 */
export interface CaseRecord {
  slug: string;
  title: string;
  date: string;
  modified: string;
  company: string;
  companySize: string;
  person: string;
  industry: { slug: string; name: string } | null;
  voiceTitle: string;
  voiceText: string;
  challenge: string;
  solution: string;
  result: string;
  metrics: { label: string; value: string }[];
  showOnTop: boolean;
  image: { url: string; width: number; height: number; alt: string };
}

/** WordPress の 1 件を検証して CaseRecord にする */
export function normalizeWpCase(raw: unknown): CaseRecord {
  const data = parseOrThrow(
    wpCaseSchema,
    raw,
    `導入事例「${describeItem(raw)}」の内容が不正です。WordPress の編集画面で入力を確認してください。`
  );
  const { tensaku: t, ...post } = data;
  return {
    slug: post.slug,
    title: decodeWpText(post.title.rendered),
    date: post.date,
    modified: post.modified,
    company: decodeWpText(t.company),
    companySize: decodeWpText(t.companySize),
    person: decodeWpText(t.person),
    industry: t.industry ? { slug: t.industry.slug, name: decodeWpText(t.industry.name) } : null,
    voiceTitle: decodeWpText(t.voiceTitle),
    voiceText: decodeWpText(t.voiceText),
    challenge: decodeWpText(t.challenge),
    solution: decodeWpText(t.solution),
    result: decodeWpText(t.result),
    metrics: t.metrics.map(m => ({ label: decodeWpText(m.label), value: decodeWpText(m.value) })),
    showOnTop: t.showOnTop,
    image: { ...t.image, alt: decodeWpText(t.image.alt) },
  };
}

/** 新しい順に並べ、スラッグの重複を検出する（重複すると詳細ページの URL がぶつかる）。日時は同じ形にそろえてあるので文字列で比べられる */
export function sortAndCheck(records: CaseRecord[]): CaseRecord[] {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.slug)) throw new Error(`導入事例のスラッグ「${record.slug}」が重複しています。`);
    seen.add(record.slug);
  }
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

/** REST API の応答（配列）全体を検証し、CaseRecord を新しい順で返す */
export function parseCases(body: unknown): CaseRecord[] {
  if (!Array.isArray(body)) throw new Error('導入事例の応答が配列ではありません。WordPress の REST API の応答か確認してください。');
  return sortAndCheck(body.map(normalizeWpCase));
}
