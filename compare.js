// 여러 마트의 같은 재료를 묶어 가격을 비교하는 함수들.
// "특란 30구", "가온/아침햇살특란 30구/1판" → 둘 다 "계란"
// 브라우저(app.js)와 Node 테스트(scripts/test_compare.js)에서 함께 씁니다.
(function (root) {
  // [묶음 이름, 알아볼 단어들]. 긴 단어가 먼저 맞으면 그쪽으로 묶임 (고추장 > 고추)
  // 한 글자 단어(무, 김, 닭, 파)는 상품명 안의 낱말과 똑같을 때만 맞춤 (무화과 ≠ 무)
  const INGREDIENTS = [
    // 계란·두부·가공
    ['계란', ['계란', '달걀', '특란', '대란', '왕란', '구운란', '맥반석란']],
    ['메추리알', ['메추리알']],
    ['두부', ['두부', '순두부', '연두부']],
    ['유부', ['유부']],
    ['어묵', ['어묵', '오뎅']],
    ['햄', ['햄', '스팸', '런천미트']],
    ['소시지', ['소시지', '비엔나', '소세지']],
    ['묵', ['도토리묵', '청포묵', '묵']],
    ['김치', ['김치', '포기김치', '깍두기', '총각김치']],
    // 채소
    ['대파', ['대파', '왕대파', '깐대파']],
    ['쪽파', ['쪽파', '실파', '흙쪽파', '깐쪽파', '왕쪽파']],
    ['양파', ['양파']],
    ['마늘', ['마늘', '깐마늘', '다진마늘', '통마늘']],
    ['생강', ['생강', '흙생강']],
    ['배추', ['배추', '알배기', '쌈배추', '알배추']],
    ['절임배추', ['절임배추']],
    ['양배추', ['양배추']],
    ['무', ['무', '무우', '다발무', '황토무', '세척무', '무 우']],
    ['알타리', ['알타리', '총각무']],
    ['열무', ['열무']],
    ['얼갈이', ['얼갈이']],
    ['갓', ['갓', '청갓', '홍갓']],
    ['시금치', ['시금치']],
    ['콩나물', ['콩나물']],
    ['숙주', ['숙주']],
    ['애호박', ['애호박', '인큐애호박']],
    ['단호박', ['단호박']],
    ['감자', ['감자', '햇감자']],
    ['고구마', ['고구마', '호박고구마', '밤고구마']],
    ['당근', ['당근', '세척당근']],
    ['오이', ['오이', '백오이', '취청오이']],
    ['가지', ['가지']],
    ['청양고추', ['청양고추']],
    ['꽈리고추', ['꽈리고추']],
    ['풋고추', ['풋고추', '오이고추', '아삭이고추']],
    ['파프리카', ['파프리카', '피망']],
    ['깻잎', ['깻잎']],
    ['상추', ['상추', '청상추', '적상추']],
    ['부추', ['부추']],
    ['미나리', ['미나리']],
    ['근대', ['근대']],
    ['아욱', ['아욱']],
    ['고사리', ['고사리']],
    ['도라지', ['도라지']],
    ['시래기', ['시래기', '무청시래기']],
    ['우거지', ['우거지', '배추우거지']],
    ['연근', ['연근']],
    ['우엉', ['우엉']],
    ['브로콜리', ['브로콜리']],
    ['느타리버섯', ['느타리']],
    ['새송이버섯', ['새송이']],
    ['표고버섯', ['표고']],
    ['팽이버섯', ['팽이']],
    ['양송이버섯', ['양송이']],
    ['콜라비', ['콜라비']],
    // 고기
    ['삼겹살', ['삼겹살', '오겹살']],
    ['대패삼겹살', ['대패삼겹', '대패 삼겹']],
    ['우삼겹', ['우삼겹', '우삼겹살']],
    ['목살', ['목살']],
    ['앞다리살', ['앞다리']],
    ['뒷다리살', ['뒷다리']],
    ['돼지갈비', ['돼지갈비', '한돈생갈비', '돈갈비']],
    ['소갈비', ['소갈비', '찜갈비', 'LA갈비']],
    ['소불고기', ['소불고기', '불고기']],
    ['사태', ['사태']],
    ['양지', ['양지']],
    ['차돌박이', ['차돌']],
    ['등심', ['등심']],
    ['우족·꼬리', ['우족', '꼬리반골', '꼬리반벌', '한우꼬리', '꼬리']],
    ['닭', ['닭', '생닭', '닭볶음탕', '닭다리', '닭가슴살', '닭봉', '닭날개']],
    ['오리', ['오리']],
    ['다짐육', ['다짐육', '민찌']],
    // 수산
    ['고등어', ['고등어']],
    ['갈치', ['갈치', '은갈치']],
    ['삼치', ['삼치']],
    ['꽁치', ['꽁치']],
    ['조기·굴비', ['조기', '굴비']],
    ['가자미', ['가자미']],
    ['임연수', ['임연수']],
    ['동태·코다리', ['동태', '명태', '코다리']],
    ['황태', ['황태']],
    ['오징어', ['오징어']],
    ['쭈꾸미', ['쭈꾸미', '주꾸미']],
    ['낙지', ['낙지']],
    ['새우', ['새우']],
    ['꽃게', ['꽃게']],
    ['전복', ['전복']],
    ['굴', ['굴', '생굴']],
    ['바지락·조개', ['바지락', '조개', '홍합']],
    ['연어', ['연어']],
    ['멸치', ['멸치']],
    ['미역', ['미역']],
    ['미역줄기', ['미역줄기']],
    ['다시마', ['다시마']],
    ['김', ['김', '재래김', '파래김', '김밥용김', '도시락김', '조미김']],
    ['김가루', ['김가루']],
    ['파래', ['물파래']],
    // 양념·곡물
    ['쌀', ['쌀', '햅쌀']],
    ['찹쌀', ['찹쌀']],
    ['식용유', ['식용유', '콩기름', '카놀라유']],
    ['참기름', ['참기름']],
    ['들기름', ['들기름']],
    ['간장', ['간장', '진간장', '국간장']],
    ['된장', ['된장']],
    ['고추장', ['고추장']],
    ['쌈장', ['쌈장']],
    ['고춧가루', ['고춧가루']],
    ['설탕', ['설탕']],
    ['소금', ['소금', '천일염']],
    ['액젓', ['액젓', '까나리', '멸치액젓']],
    ['새우젓', ['새우젓']],
    ['게장', ['게장', '간장게장', '양념게장']],
    ['과일청·차', ['한라봉차', '유자차', '생강차', '레몬차', '자몽차', '모과차', '대추차']],
    ['물엿·올리고당', ['물엿', '올리고당']],
    ['식초', ['식초']],
    ['당면', ['당면']],
    ['소면·국수', ['소면', '국수', '중면']],
    ['라면', ['라면', '탕면', '신라면']],
    ['밀가루·부침가루', ['밀가루', '부침가루', '튀김가루']],
    // 과일
    ['바나나', ['바나나']],
    ['대추', ['대추', '사과대추']],
    ['사과', ['사과', '부사', '시나노골드']],
    ['배', ['신고배', '배']],
    ['감·홍시', ['단감', '대봉감', '연시', '홍시']],
    ['귤', ['귤', '감귤', '한라봉']],
    ['샤인머스켓', ['샤인머스켓', '샤인머스캣']],
    ['포도', ['포도', '거봉']],
    ['키위', ['키위']],
    ['오렌지', ['오렌지']],
    ['토마토', ['토마토']],
  ];

  const ENTRIES = [];
  INGREDIENTS.forEach(([key, words], order) => {
    for (const w of words) ENTRIES.push({ key, word: w.replace(/\s/g, ''), order });
  });

  function tokens(name) {
    return name.split(/[\s/,+*()[\]·&]+/).filter(Boolean);
  }

  function cleanName(name) {
    // "청정원/스파게티소스(토마토) 600g" → "스파게티소스"
    let n = name.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
    if (n.includes('/')) {
      const parts = n.split('/').map((s) => s.trim()).filter(Boolean);
      // 앞쪽이 브랜드처럼 짧고 숫자가 없으면 버림
      if (parts.length > 1 && !/\d/.test(parts[0]) && parts[0].length <= 5) parts.shift();
      n = parts.join(' ');
    }
    return tokens(n).filter((t) => !/\d/.test(t)).join(' ').trim() || name.trim();
  }

  function ingredientKey(name) {
    // 괄호 안(맛·크기 설명)은 빼고 찾음: "스파게티소스(토마토)" ≠ 토마토
    const bare = name.replace(/\([^)]*\)/g, ' ');
    const flat = bare.replace(/\s/g, '');
    const toks = tokens(bare);
    let best = null;
    for (const e of ENTRIES) {
      const hit = e.word.length === 1 ? toks.includes(e.word) : flat.includes(e.word);
      if (hit && (!best || e.word.length > best.word.length || (e.word.length === best.word.length && e.order < best.order))) best = e;
    }
    return best ? best.key : cleanName(name);
  }

  // 용량 읽기: "대파 10단/1망" → {qty:10, unit:'단'}, "부채살 100g당" → {qty:100, unit:'g'}
  const UNIT_RE = /(\d+(?:\.\d+)?)\s*(kg|g|l|ml|단|개|구|마리|팩|봉|입|포기|통|송이|근|판|kg당|g당)(?![a-z])/i;
  function parseUnit(name) {
    const m = name.match(UNIT_RE);
    if (!m) return null;
    let qty = parseFloat(m[1]);
    let unit = m[2].toLowerCase().replace('당', '');
    if (!(qty > 0)) return null;
    if (unit === 'kg') { qty *= 1000; unit = 'g'; }
    if (unit === 'l') { qty *= 1000; unit = 'ml'; }
    if (unit === '근') { qty *= 600; unit = 'g'; }
    return { qty, unit };
  }

  function unitPrice(item) {
    const u = parseUnit(item.name);
    if (!u) return null;
    const per = u.unit === 'g' || u.unit === 'ml' ? 100 : 1;
    return { unit: u.unit, per, value: (item.price / u.qty) * per };
  }

  function unitLabel(up) {
    if (!up) return '';
    const n = Math.round(up.value);
    const head = up.per === 100 ? `100${up.unit}` : `1${up.unit}`;
    return `${head}당 ${n.toLocaleString('ko-KR')}원`;
  }

  // items → [{ key, items(싼 순), marts(마트 수), byUnit(단위가격으로 줄 세웠는지) }]
  function groupByIngredient(items) {
    const map = new Map();
    for (const it of items) {
      const key = ingredientKey(it.name);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    const groups = [];
    for (const [key, list] of map) {
      const ups = list.map(unitPrice);
      const sameUnit = list.length > 1 && ups.every((u) => u && u.unit === ups[0].unit);
      const rows = list.map((it, i) => ({ item: it, up: ups[i] }));
      rows.sort((a, b) => (sameUnit ? a.up.value - b.up.value : 0) || a.item.price - b.item.price);
      groups.push({
        key,
        rows,
        marts: new Set(list.map((it) => it.mart)).size,
        byUnit: sameUnit,
        min: Math.min(...list.map((it) => it.price)),
      });
    }
    return groups;
  }

  const api = { ingredientKey, parseUnit, unitPrice, unitLabel, groupByIngredient, cleanName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Compare = api;
})(typeof window !== 'undefined' ? window : globalThis);
