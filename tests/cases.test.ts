/**
 * 導入事例の検証・変換のテスト（src/cms/cases.ts・src/cms/text.ts）
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeWpCase, parseCases, sortAndCheck } from '../src/cms/cases';
import { decodeWpText } from '../src/cms/text';

const wpCase = (overrides: Record<string, unknown> = {}, tensaku: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'sample-case',
  title: { rendered: 'A&#038;B社の事例 &#8211; 3倍に' },
  date: '2026-09-24T10:00:00',
  modified: '2026-09-25T10:00:00',
  tensaku: {
    company: '株式会社サンプル',
    companySize: '従業員 10名',
    person: '制作部 ディレクター',
    voiceTitle: '見出し\n2行目',
    voiceText: '本文',
    challenge: '課題1\n\n課題2',
    solution: '導入',
    result: '効果',
    showOnTop: true,
    industry: { slug: 'design', name: 'デザイン会社' },
    metrics: [{ label: '日数', value: '6日 → 2日' }],
    image: { url: 'https://cms.example.com/wp-content/uploads/a.jpg', width: 1200, height: 675, alt: '写真' },
    ...tensaku,
  },
  ...overrides,
});

describe('decodeWpText', () => {
  it('WordPress の実体参照を文字に戻し、タグを除く', () => {
    expect(decodeWpText('A&#038;B &#8211; C &amp; &lt;b&gt; <strong>D</strong>')).toBe('A&B – C & <b> D');
  });

  it('16 進の実体参照も戻し、知らない名前は残す', () => {
    expect(decodeWpText('&#x2014; &unknown;')).toBe('— &unknown;');
  });

  it('改行コードをそろえ、前後の空白を除く', () => {
    expect(decodeWpText('  1\r\n2\r3  ')).toBe('1\n2\n3');
  });
});

describe('normalizeWpCase：正常なデータ', () => {
  it('REST の 1 件を画面用の形にする（入れ子を平らにし、実体参照を戻す）', () => {
    const record = normalizeWpCase(wpCase());
    expect(record).toMatchObject({
      slug: 'sample-case',
      title: 'A&B社の事例 – 3倍に',
      company: '株式会社サンプル',
      industry: { slug: 'design', name: 'デザイン会社' },
      metrics: [{ label: '日数', value: '6日 → 2日' }],
      showOnTop: true,
    });
    expect(record.image).toEqual({
      url: 'https://cms.example.com/wp-content/uploads/a.jpg',
      width: 1200,
      height: 675,
      alt: '写真',
    });
  });

  it('業種は null、数値は 0 件、規模は空文字でもよい', () => {
    const record = normalizeWpCase(wpCase({}, { industry: null, metrics: [], companySize: '' }));
    expect(record.industry).toBeNull();
    expect(record.metrics).toEqual([]);
    expect(record.companySize).toBe('');
  });
});

describe('normalizeWpCase：不正なデータ', () => {
  it('必須項目が空白だけなら、事例と項目が分かるエラーで止める', () => {
    expect(() => normalizeWpCase(wpCase({}, { company: ' ' }))).toThrow(
      /「sample-case」[\s\S]*tensaku\.company: 企業名が空です/
    );
  });

  it('必須項目のキーが無ければ止める', () => {
    const raw = wpCase();
    delete (raw.tensaku as Record<string, unknown>).person;
    expect(() => normalizeWpCase(raw)).toThrow(/tensaku\.person/);
  });

  it('任意に見える項目も、キーが無ければ止める（業種は null、規模は空文字で送る決まり）', () => {
    const raw = wpCase();
    delete (raw.tensaku as Record<string, unknown>).industry;
    expect(() => normalizeWpCase(raw)).toThrow(/tensaku\.industry/);
  });

  it('型が違えば止める（真偽値の代わりに文字列、数値の代わりに文字列）', () => {
    expect(() => normalizeWpCase(wpCase({}, { showOnTop: 'true' }))).toThrow(/tensaku\.showOnTop/);
    expect(() => normalizeWpCase(wpCase({ id: '1' }))).toThrow(/id/);
  });

  it('アイキャッチ画像が無い事例は止める', () => {
    expect(() => normalizeWpCase(wpCase({}, { image: null }))).toThrow(/アイキャッチ画像が設定されていません/);
  });

  it('画像の URL が URL の形でなければ止める', () => {
    expect(() =>
      normalizeWpCase(wpCase({}, { image: { url: 'case.jpg', width: 1200, height: 675, alt: '写真' } }))
    ).toThrow(/tensaku\.image\.url/);
  });

  it('数値は 3 件まで', () => {
    const metric = { label: '項目', value: '値' };
    expect(() => normalizeWpCase(wpCase({}, { metrics: [metric, metric, metric, metric] }))).toThrow(
      /tensaku\.metrics/
    );
  });

  it('URL に使えないスラッグ（日本語をエンコードしたものなど）は止める', () => {
    expect(() => normalizeWpCase(wpCase({ slug: '%e4%ba%8b%e4%be%8b' }))).toThrow(/スラッグは半角英数字/);
    expect(() => normalizeWpCase(wpCase({ slug: 'Sample_Case' }))).toThrow(/スラッグは半角英数字/);
  });

  it('オブジェクトでない値は、名前を「(不明)」として止める', () => {
    expect(() => normalizeWpCase(null)).toThrow(/「\(不明\)」/);
  });
});

describe('sortAndCheck', () => {
  it('公開日の新しい順に並べる', () => {
    const a = normalizeWpCase(wpCase({ slug: 'a', date: '2026-01-01T00:00:00' }));
    const b = normalizeWpCase(wpCase({ slug: 'b', date: '2026-02-01T00:00:00' }));
    expect(sortAndCheck([a, b]).map(r => r.slug)).toEqual(['b', 'a']);
  });

  it('スラッグの重複を止める', () => {
    const a = normalizeWpCase(wpCase());
    expect(() => sortAndCheck([a, a])).toThrow(/スラッグ「sample-case」が重複/);
  });
});

describe('parseCases（応答全体）', () => {
  it('空の配列は 0 件として扱う（事例が無い状態）', () => {
    expect(parseCases([])).toEqual([]);
  });

  it('配列でない応答（エラー応答など）は止める', () => {
    expect(() => parseCases({ code: 'rest_no_route' })).toThrow(/配列ではありません/);
  });

  it('1 件でも不正なら全体を止め、正しい事例だけで続けることはしない', () => {
    expect(() => parseCases([wpCase({ slug: 'ok' }), wpCase({ slug: 'ng' }, { result: '' })])).toThrow(
      /「ng」[\s\S]*導入後の効果が空です/
    );
  });

  it('同梱の架空データは検証を通り、新しい順に並ぶ', () => {
    const records = parseCases(JSON.parse(readFileSync('data/wp-cases.json', 'utf8')));
    expect(records.map(r => r.slug)).toEqual([
      'demo-app-studio',
      'sample-design-office',
      'example-ad-agency',
      'test-web-production',
    ]);
    expect(records.find(r => r.slug === 'example-ad-agency')?.company).toBe('エグザンプル広告 & パートナーズ');
  });

  it('確認用の不正データは企業名の空欄で止まる', () => {
    expect(() => parseCases(JSON.parse(readFileSync('tests/fixtures/invalid-cases.json', 'utf8')))).toThrow(
      /「broken-case」[\s\S]*企業名が空です/
    );
  });
});
