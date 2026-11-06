/**
 * WordPress から受け取る文字列の扱いと、検証エラーの文章化
 *
 * 導入事例のスキーマ（cases.ts）から使う小さな部品だけを置いている。
 */
import { z } from 'astro/zod';

/**
 * 必須の文字列。画面に出す形（decodeWpText で実体参照を戻し、タグを除いた後）で空かどうかを判定する。
 * 空白だけ・`<b></b>` のようなタグだけ・`&nbsp;` だけの値は、変換すると空になるので止める。
 */
export const requiredText = (label: string) =>
  z
    .string()
    .trim()
    .refine(value => decodeWpText(value) !== '', `${label}が空です`);

/**
 * スラッグ。このサンプルでは詳細ページの URL の決まりとして、半角英小文字・数字・ハイフンに限る。
 * （日本語のスラッグもエンコードすれば URL にできるが、URL を読みやすく保つためにこの決まりにしている）
 */
export const slugText = z.string().regex(/^[a-z0-9-]+$/, 'スラッグは半角英小文字・数字・ハイフンのみにしてください');

/** WordPress の REST API が返す日時の形（サイトの時刻、タイムゾーンなし） */
const WP_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

/** 実在する日時か（2026-02-30 や 25 時などを弾く） */
function isRealDateTime(value: string): boolean {
  const match = WP_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

/**
 * 日時（公開日・更新日）。「YYYY-MM-DDTHH:MM:SS」の形で、実在する日時だけを許可する。
 * 並べ替えは文字列の比較で行うので、形がそろっていることもここで保証する。
 */
export const wpDateText = (label: string) =>
  z.string().refine(isRealDateTime, `${label}は「YYYY-MM-DDTHH:MM:SS」の形の実在する日時にしてください`);

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
