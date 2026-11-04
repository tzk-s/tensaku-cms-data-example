/**
 * 導入事例を画面に出すときの小さな整形
 *
 * 取得と検証はビルドの最初に済んでいる（src/content.config.ts）ので、ここでは文字列の形だけを扱う。
 */

/** 空行で区切られた本文を段落の配列にする（WordPress の入力欄は「空行で段落を分ける」と案内する想定） */
export const toParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

/** 2026-09-24T10:00:00 → 2026.09.24（表示用）。時差でずれないよう文字列のまま切り出す */
export const formatDate = (iso: string): string => iso.slice(0, 10).replaceAll('-', '.');

/** 2026-09-24T10:00:00 → 2026-09-24（<time datetime> 用） */
export const toDateAttr = (iso: string): string => iso.slice(0, 10);

/** 詳細ページのパス */
export const casePath = (slug: string): string => `/cases/${slug}/`;
