// 실행: node scripts/test_compare.js
const assert = require('assert');
const C = require('../compare.js');

const key = C.ingredientKey;
assert.strictEqual(key('특란 30구'), '계란');
assert.strictEqual(key('가온/아침햇살특란 30구/1판'), '계란');
assert.strictEqual(key('왕대파 10단/1망'), '대파');
assert.strictEqual(key('무화과 1Kg/1상자'), '무화과');       // '무'로 묶이면 안 됨
assert.strictEqual(key('다발무 1단'), '무');
assert.strictEqual(key('해표순창궁 태양초고추장 1.5kg+400g'), '고추장');
assert.strictEqual(key('대패 우삼겹살 600g/1근'), '우삼겹');
assert.strictEqual(key('간장게장 1팩'), '게장');
assert.strictEqual(key('청정원/스파게티소스(토마토) 600g'), '스파게티소스');
assert.strictEqual(key('사과대추 1팩'), '대추');

assert.deepStrictEqual(C.parseUnit('왕대파 10단/1망'), { qty: 10, unit: '단' });
assert.deepStrictEqual(C.parseUnit('샤인머스켓 2Kg/1상자'), { qty: 2000, unit: 'g' });
assert.deepStrictEqual(C.parseUnit('호주산 냉동 소불고기 600g/1근'), { qty: 600, unit: 'g' });

// 같은 단위면 단위가격으로 싼 순
const g = C.groupByIngredient([
  { mart: 'a', name: '대파 1단', price: 1980 },
  { mart: 'b', name: '대파 10단', price: 14900 },
  { mart: 'c', name: '왕대파 10단/1망', price: 17800 },
]);
assert.strictEqual(g.length, 1);
assert.strictEqual(g[0].byUnit, true);
assert.deepStrictEqual(g[0].rows.map((r) => r.item.mart), ['b', 'c', 'a']);
assert.strictEqual(C.unitLabel(g[0].rows[0].up), '1단당 1,490원');

// 단위가 섞이면 가격 싼 순
const g2 = C.groupByIngredient([
  { mart: 'a', name: '계란 30구', price: 7580 },
  { mart: 'b', name: '특란 1판', price: 6980 },
]);
assert.strictEqual(g2[0].byUnit, false);
assert.strictEqual(g2[0].rows[0].item.mart, 'b');
console.log('✅ 품목 비교 테스트 통과');
