/**
 * 表示用の整形のテスト（src/cms/display.ts）
 */
import { describe, expect, it } from 'vitest';
import { casePath, formatDate, toDateAttr, toParagraphs } from '../src/cms/display';

describe('toParagraphs', () => {
  it('空行で段落に分け、空の段落は除く', () => {
    expect(toParagraphs('1つ目\n続き\n\n2つ目\n \n\n\n3つ目\n')).toEqual(['1つ目\n続き', '2つ目', '3つ目']);
  });
});

describe('日付', () => {
  it('表示用と datetime 用に、時差でずらさず切り出す', () => {
    expect(formatDate('2026-09-24T23:30:00')).toBe('2026.09.24');
    expect(toDateAttr('2026-09-24T23:30:00')).toBe('2026-09-24');
  });
});

describe('casePath', () => {
  it('詳細ページのパスを作る', () => {
    expect(casePath('sample-case')).toBe('/cases/sample-case/');
  });
});
