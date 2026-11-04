/**
 * WordPress から受け取る文字列の扱いと、検証エラーの文章化
 *
 * 導入事例のスキーマ（cases.ts）から使う小さな部品だけを置いている。
 */
import { z } from 'astro/zod';

/** 空白だけの文字列も「空」として扱う必須項目 */
export const requiredText = (label: string) => z.string().trim().min(1, `${label}が空です`);

/** URL に使える識別子（スラッグ）。日本語スラッグはページの URL や HTML の id にできないので弾く */
export const slugText = z.string().regex(/^[a-z0-9-]+$/, 'スラッグは半角英数字とハイフンのみにしてください');

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

/**
 * WordPress が返す文字列の HTML 実体参照を文字に戻し、タグを取り除く。
 * WordPress はタイトルの「&」を「&#038;」のように変換して返す。Astro は出力時に自動でエスケープするので、
 * ここで戻しておかないと画面に「&amp;#038;」と二重に出てしまう。
 * タグは除去してから文字列として扱う（HTML として埋め込むことはしない）。
 */
export function decodeWpText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\r\n?/g, '\n')
    .trim();
}

/** zod のエラーを「どの項目が、なぜ」が分かる文章にする */
export function formatIssues(label: string, error: z.ZodError): string {
  const lines = error.issues.map(issue => `  - ${issue.path.join('.') || '(全体)'}: ${issue.message}`);
  return `${label}\n${lines.join('\n')}`;
}

/** 1 件を検証する。不正なら、ラベルと項目名の入ったエラーで止める */
export function parseOrThrow<T extends z.ZodType>(schema: T, raw: unknown, label: string): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(formatIssues(label, parsed.error));
  return parsed.data;
}

/** raw がオブジェクトなら、その slug（無ければ id）をエラー文用に取り出す */
export function describeItem(raw: unknown): string {
  if (typeof raw !== 'object' || !raw) return '(不明)';
  const item = raw as { slug?: unknown; id?: unknown };
  return String(item.slug || item.id || '(不明)');
}
