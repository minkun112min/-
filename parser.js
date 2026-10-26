// 카톡/문자로 받은 특가 안내 글에서 "품목 + 가격"을 뽑아내는 함수들.
// 브라우저(app.js)와 Node 테스트(scripts/test_parser.js)에서 함께 씁니다.
(function (root) {
  const PRICE_RE = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;

  // 품목이 아닌 안내 문구 (영업시간, 주소 등)
  const SKIP_WORDS = ['영업', '시간', '주소', '문의', '전화', '배달', '배송', '주차', '카드', '쿠폰', '포인트', '이상 구매', '구매시', '구매 시', '합계', '총'];

  const CATEGORIES = [
    { key: '채소', icon: '🥬', words: ['시금치', '배추', '무', '파', '양파', '마늘', '감자', '고구마', '호박', '오이', '당근', '콩나물', '숙주', '버섯', '상추', '깻잎', '고추', '부추', '미나리', '가지', '브로콜리', '양배추', '열무', '얼갈이', '청경채', '쑥갓', '도라지', '고사리', '취나물', '비름', '나물', '연근', '우엉', '토란', '생강', '피망', '파프리카', '아욱', '근대', '알타리', '총각무', '쪽파', '대파', '갓', '알배기', '단호박', '절임배추', '시래기', '우거지'] },
    { key: '육류', icon: '🥩', words: ['돼지', '소고기', '한우', '쇠고기', '닭', '오리', '삼겹', '목살', '앞다리', '뒷다리', '갈비', '불고기', '등심', '안심', '사태', '양지', '차돌', '다짐육', '베이컨', '햄', '소시지', '스팸', '제육', '수육'] },
    { key: '수산', icon: '🐟', words: ['고등어', '갈치', '삼치', '꽁치', '조기', '굴비', '동태', '명태', '코다리', '오징어', '낙지', '쭈꾸미', '주꾸미', '새우', '조개', '바지락', '홍합', '굴', '꽃게', '게', '미역', '다시마', '김', '멸치', '황태', '어묵', '생선', '연어', '참치', '가자미', '임연수', '전복', '해물', '파래', '톳'] },
    { key: '계란·두부', icon: '🥚', words: ['계란', '달걀', '특란', '대란', '왕란', '구운란', '두부', '유부', '메추리알', '순두부', '묵', '도토리묵', '청포묵'] },
    { key: '양념·곡물', icon: '🧂', words: ['쌀', '잡곡', '현미', '찹쌀', '간장', '된장', '고추장', '고춧가루', '참기름', '들기름', '식용유', '설탕', '소금', '식초', '물엿', '올리고당', '액젓', '젓갈', '새우젓', '깨', '밀가루', '부침가루', '전분', '당면', '국수', '라면', '김치'] },
    { key: '과일', icon: '🍎', words: ['사과', '배', '귤', '감귤', '바나나', '포도', '딸기', '수박', '참외', '복숭아', '감', '토마토', '키위', '오렌지', '자두', '멜론'] },
  ];

  function categorize(name) {
    const n = name.replace(/\s/g, '');
    // 긴 단어부터 확인해 "파프리카"가 "파"로 잡히는 것 등을 줄임
    let best = null;
    for (const c of CATEGORIES) {
      for (const w of c.words) {
        if (n.includes(w) && (!best || w.length > best.len)) best = { cat: c, len: w.length };
      }
    }
    return best ? { category: best.cat.key, icon: best.cat.icon } : { category: '기타', icon: '🛒' };
  }

  function toNumber(s) {
    return parseInt(String(s).replace(/,/g, ''), 10);
  }

  function cleanName(s) {
    return s
      // 이모지·기호 제거
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ' ')
      .replace(/[★☆◆◇■□●○▶▷►→←⇒➡️✔✅※♥♡\-–—>:~|*#]/g, ' ')
      // [특가], (오늘만) 같은 머리말 제거 — 단, (1단)처럼 규격은 유지
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\((?:오늘만|특가|한정|행사|파격|초특가|당일)[^)]*\)/g, ' ')
      // 번호 매기기 제거: "1." "1)" "①"
      .replace(/^\s*\d+\s*[.)]\s*/, ' ')
      .replace(/[①-⑳]/g, ' ')
      .replace(/(정상가|판매가|할인가|특가|행사가|초특가|파격가|가격|단돈|only|ONLY)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseLine(line) {
    const prices = [];
    let m;
    PRICE_RE.lastIndex = 0;
    while ((m = PRICE_RE.exec(line)) !== null) {
      const v = toNumber(m[1]);
      if (v >= 10) prices.push({ value: v, index: m.index, end: m.index + m[0].length });
    }
    if (prices.length === 0) return null;

    let name = cleanName(line.slice(0, prices[0].index));
    if (!name) name = cleanName(line.slice(prices[prices.length - 1].end));
    if (!name || name.length < 1) return null;
    if (SKIP_WORDS.some((w) => name.includes(w))) return null;

    const values = prices.map((p) => p.value);
    const price = Math.min(...values);
    const max = Math.max(...values);
    const original_price = max > price ? max : null;

    return { name, price, original_price, ...categorize(name) };
  }

  function parseSaleText(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseLine)
      .filter(Boolean);
  }

  const api = { parseSaleText, parseLine, categorize, CATEGORIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SaleParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
