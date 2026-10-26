// 실행: node scripts/test_parser.js
const assert = require('assert');
const { parseSaleText, categorize } = require('../parser.js');

const sample = `
🎉 OO마트 10월 26일 오늘의 특가 🎉
[특가] 시금치 1단 2,980원 → 1,480원
★ 국내산 돼지앞다리살 1kg 9,900원
2) 두부(300g) 990원
고등어 2손 정상가 11,800원 특가 7,900원
⏰ 영업시간 오전 9시~밤 10시
3만원 이상 구매시 배달 가능
파프리카 3입 2,500원
`;

const items = parseSaleText(sample);
console.log(items);

assert.strictEqual(items.length, 5);
assert.deepStrictEqual(
  { n: items[0].name, p: items[0].price, o: items[0].original_price, c: items[0].category },
  { n: '시금치 1단', p: 1480, o: 2980, c: '채소' }
);
assert.strictEqual(items[1].name, '국내산 돼지앞다리살 1kg');
assert.strictEqual(items[1].category, '육류');
assert.strictEqual(items[2].name, '두부(300g)');
assert.strictEqual(items[2].category, '계란·두부');
assert.strictEqual(items[3].price, 7900);
assert.strictEqual(items[3].original_price, 11800);
assert.strictEqual(items[3].category, '수산');
assert.strictEqual(categorize('파프리카 3입').category, '채소');
console.log('✅ 모든 테스트 통과');
