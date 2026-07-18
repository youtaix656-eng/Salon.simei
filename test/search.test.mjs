import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientMatchesQuery,
  clientMatchesFilter,
  collectTags,
  parseTagsInput,
} from '../src/lib/search.js';

const client = {
  id: 'c1',
  name: '佐藤 美咲',
  kana: 'さとう みさき',
  birthday: '07-25',
  pressure: 'つよめ',
  focusAreas: '肩甲骨まわり・首',
  likes: '愛犬の話',
  ngTopics: '仕事の話は控えめに',
  notes: 'デスクワークで肩こり',
  tags: ['常連', 'VIP'],
};

test('clientMatchesQuery: カルテ全体をキーワード検索できる', () => {
  assert.ok(clientMatchesQuery(client, '佐藤'));
  assert.ok(clientMatchesQuery(client, 'さとう'));
  assert.ok(clientMatchesQuery(client, '肩こり'));      // メモ
  assert.ok(clientMatchesQuery(client, '肩甲骨'));      // 部位
  assert.ok(clientMatchesQuery(client, '愛犬'));        // 話題
  assert.ok(clientMatchesQuery(client, 'VIP'));         // タグ
  assert.ok(clientMatchesQuery(client, '07-25'));       // 誕生日の文字一致
  assert.ok(!clientMatchesQuery(client, '存在しない'));
  assert.ok(clientMatchesQuery(client, ''));            // 空は全件
});

test('clientMatchesQuery: 「注意」「⚠️」で注意点ありを検索', () => {
  assert.ok(clientMatchesQuery(client, '注意'));
  assert.ok(clientMatchesQuery(client, '⚠️'));
  assert.ok(clientMatchesQuery(client, '⚠️注意⚠️'));
  assert.ok(!clientMatchesQuery({ ...client, ngTopics: '' }, '注意'));
  assert.ok(!clientMatchesQuery({ ...client, ngTopics: '  ' }, '⚠️'));
});

test('clientMatchesQuery: 「誕生日」「N月」で誕生日検索', () => {
  assert.ok(clientMatchesQuery(client, '誕生日'));
  assert.ok(!clientMatchesQuery({ ...client, birthday: '' }, '誕生日'));
  assert.ok(clientMatchesQuery(client, '7月'));
  assert.ok(!clientMatchesQuery(client, '8月'));
  // 年入りの誕生日でも月で引ける
  assert.ok(clientMatchesQuery({ ...client, birthday: '1990-07-25' }, '7月'));
});

test('clientMatchesFilter: 絞り込みチップ', () => {
  assert.ok(clientMatchesFilter(client, '', '2026-07-17'));
  assert.ok(clientMatchesFilter(client, 'birthday', '2026-07-17'));
  assert.ok(!clientMatchesFilter(client, 'birthday', '2026-08-17'));
  assert.ok(clientMatchesFilter(client, 'caution', '2026-07-17'));
  assert.ok(!clientMatchesFilter({ ...client, ngTopics: '' }, 'caution', '2026-07-17'));
  assert.ok(clientMatchesFilter(client, 'tag:常連', '2026-07-17'));
  assert.ok(!clientMatchesFilter(client, 'tag:新規', '2026-07-17'));
});

test('collectTags: 重複なしで出現順', () => {
  const tags = collectTags([
    { tags: ['常連', 'VIP'] },
    { tags: ['新規'] },
    { tags: ['常連'] },
    {},
  ]);
  assert.deepEqual(tags, ['常連', 'VIP', '新規']);
});

test('parseTagsInput: 「、」「,」区切りを配列に', () => {
  assert.deepEqual(parseTagsInput('常連、VIP'), ['常連', 'VIP']);
  assert.deepEqual(parseTagsInput(' 常連 , VIP ,'), ['常連', 'VIP']);
  assert.deepEqual(parseTagsInput(''), []);
});
