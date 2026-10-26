(function () {
  const { parseSaleText, categorize, CATEGORIES } = window.SaleParser;

  // ---------- 저장소 (이 휴대폰에만 저장) ----------
  const LS = {
    get(key, fallback) {
      try { const v = localStorage.getItem('minsikdang.' + key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('minsikdang.' + key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
    },
  };

  const todayStr = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const TODAY = todayStr();
  const won = (n) => (n || 0).toLocaleString('ko-KR') + '원';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keyOf = (it) => it.mart + '::' + it.name + '::' + it.price;
  // 마트 홈페이지의 코너 이름으로 분류를 바로잡기
  const SECTION_CATEGORY = [
    [/야채|채소|청과/, '채소', '🥬'], [/정육|축산|고기/, '육류', '🥩'], [/수산|생선|해산/, '수산', '🐟'], [/과일/, '과일', '🍎'],
  ];
  const PALETTE = ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#c2255c', '#0c8599', '#e67700'];

  // ---------- 상태 ----------
  const state = {
    marts: [],
    remoteItems: [],
    remoteDate: null,
    remoteSample: false,
    remoteNotes: {},
    manualItems: LS.get('manual.' + TODAY, []),
    cart: LS.get('cart', {}), // key -> { item, qty, bought }
    filterCat: '전체',
    filterMart: '전체',
    query: '',
    preview: [],
  };

  function martById(id) {
    return state.marts.find((m) => m.id === id) || { id, name: id, color: '#868e96' };
  }

  function allItems() {
    const map = new Map();
    for (const it of [...state.remoteItems, ...state.manualItems]) {
      const full = { ...categorize(it.name), ...it };
      const sec = SECTION_CATEGORY.find(([re]) => re.test(it.section || ''));
      if (sec && full.category === '기타') { full.category = sec[1]; full.icon = sec[2]; }
      map.set(keyOf(full), full); // 같은 마트·같은 이름이면 나중 것(직접 입력)이 우선
    }
    return [...map.values()];
  }

  // ---------- 데이터 불러오기 ----------
  async function loadJSON(url) {
    const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  async function init() {
    let configMarts = [];
    try { configMarts = (await loadJSON('config/marts.json')).marts || []; } catch (e) { /* 파일로 열었을 때 */ }
    const saved = LS.get('marts', null);
    const fromConfig = configMarts.map(({ id, name, color, url }) => ({ id, name, color, url: url || '' }));
    // 이 휴대폰에서 바꾼 이름·색은 유지하고, 새로 생긴 마트와 홈페이지 주소는 설정 파일에서 채움
    state.marts = saved
      ? [...saved.map((m) => ({ ...m, url: (fromConfig.find((c) => c.id === m.id) || {}).url || m.url || '' })),
         ...fromConfig.filter((c) => !saved.some((m) => m.id === c.id) && !(LS.get('removedMarts', []).includes(c.id)))]
      : fromConfig;
    if (!state.marts.length) state.marts = [{ id: 'mart-a', name: '우리동네마트', color: PALETTE[0] }];

    try {
      const data = await loadJSON('data/sales.json');
      state.remoteItems = data.items || [];
      state.remoteDate = data.date || null;
      state.remoteSample = !!data.sample;
      state.remoteNotes = data.notes || {};
    } catch (e) { /* 자동 수집 데이터 없음 */ }

    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('today-label').textContent =
      `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) 오늘의 특가`;

    bindEvents();
    renderAll();
  }

  // ---------- 화면 그리기 ----------
  function renderAll() {
    renderStats();
    renderChips();
    renderSales();
    renderCart();
    renderMartSelect();
    renderMartEdit();
  }

  function cartTotals() {
    let count = 0, total = 0;
    for (const c of Object.values(state.cart)) { count += c.qty; total += c.qty * c.item.price; }
    return { count, total };
  }

  function renderStats() {
    const items = allItems();
    const { count, total } = cartTotals();
    document.getElementById('stat-items').textContent = items.length;
    document.getElementById('stat-marts').textContent = new Set(items.map((i) => i.mart)).size;
    document.getElementById('stat-total').textContent = won(total);
    document.getElementById('cart-count').textContent = count;
  }

  function renderChips() {
    const cats = ['전체', ...CATEGORIES.map((c) => c.key), '기타'];
    const icons = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.icon]));
    icons['기타'] = '🛒';
    document.getElementById('cat-chips').innerHTML = cats
      .map((c) => `<button class="chip ${state.filterCat === c ? 'on' : ''}" data-cat="${esc(c)}">${icons[c] ? icons[c] + ' ' : ''}${esc(c)}</button>`)
      .join('');
    document.getElementById('mart-chips').innerHTML = ['전체', ...state.marts.map((m) => m.id)]
      .map((id) => {
        const label = id === '전체' ? '모든 마트' : martById(id).name;
        return `<button class="chip ${state.filterMart === id ? 'on' : ''}" data-mart="${esc(id)}">${esc(label)}</button>`;
      })
      .join('');
  }

  function discount(it) {
    if (!it.original_price || it.original_price <= it.price) return 0;
    return Math.round((1 - it.price / it.original_price) * 100);
  }

  function itemMeta(it) {
    const off = discount(it);
    return `<span class="price">${won(it.price)}</span>` +
      (it.original_price && it.original_price > it.price ? `<span class="orig">${won(it.original_price)}</span>` : '') +
      (off ? `<span class="off">${off}%↓</span>` : '') +
      (it.badge ? `<span class="badge">${esc(it.badge)}</span>` : '') +
      (it.section ? `<span class="tag">${esc(it.section)}</span>` : '') +
      `<span class="tag">${esc(it.category || '기타')}</span>`;
  }

  function renderLinks() {
    const withUrl = state.marts.filter((m) => m.url);
    document.getElementById('mart-links').innerHTML = withUrl.length
      ? '<p class="links-title">마트 특가 페이지 바로가기</p><div class="links">' + withUrl.map((m) =>
          `<a class="link" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="dot" style="background:${esc(m.color)}"></span>${esc(m.name)} ↗</a>`).join('') + '</div>'
      : '';
  }

  function renderSales() {
    renderLinks();
    const notice = document.getElementById('data-notice');
    const msgs = [];
    if (state.remoteSample && state.remoteItems.length) msgs.push('지금 보이는 자동 수집 특가는 <b>예시</b>예요. 마트 홈페이지 주소를 설정하면 매일 아침 진짜 특가로 바뀝니다.');
    else if (state.remoteDate && state.remoteDate !== TODAY && state.remoteItems.length) msgs.push(`자동 수집 특가는 <b>${esc(state.remoteDate)}</b> 기준이에요. 오늘 것은 아직 안 올라왔어요.`);
    notice.innerHTML = msgs.join('<br>');
    notice.hidden = !msgs.length;

    const q = state.query.trim().replace(/\s/g, '');
    const items = allItems().filter((it) =>
      (state.filterCat === '전체' || it.category === state.filterCat) &&
      (state.filterMart === '전체' || it.mart === state.filterMart) &&
      (!q || it.name.replace(/\s/g, '').includes(q))
    );

    const el = document.getElementById('sales-list');
    if (!items.length) {
      el.innerHTML = `<div class="empty"><span class="big">🏷️</span>${allItems().length ? '조건에 맞는 특가가 없어요.' : '아직 오늘 특가가 없어요.<br>마트 카톡을 <b>붙여넣기</b> 탭에 넣어 보세요.'}</div>`;
      return;
    }

    const groups = groupByMart(items);
    el.innerHTML = groups.map(([martId, list]) => {
      const m = martById(martId);
      list.sort((a, b) => discount(b) - discount(a));
      return `<div class="mart-group">
        <div class="mart-head"><h3><span class="dot" style="background:${esc(m.color)}"></span>${esc(m.name)}</h3><small>${state.remoteNotes[martId] ? esc(state.remoteNotes[martId].replace(/#/g, ' ').trim()) + ' · ' : ''}${list.length}개 특가${m.url ? ` · <a href="${esc(m.url)}" target="_blank" rel="noopener">페이지 ↗</a>` : ''}</small></div>
        ${list.map((it) => {
          const inCart = !!state.cart[keyOf(it)];
          return `<div class="item">
            <div class="ico">${it.icon || '🛒'}</div>
            <div class="info"><div class="name">${esc(it.name)}</div><div class="meta">${itemMeta(it)}</div></div>
            <button class="add ${inCart ? 'in' : ''}" data-add="${esc(keyOf(it))}">${inCart ? '✓ 담김' : '담기'}</button>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  }

  function groupByMart(items) {
    const order = state.marts.map((m) => m.id);
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.mart)) map.set(it.mart, []);
      map.get(it.mart).push(it);
    }
    return [...map.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  function renderCart() {
    const el = document.getElementById('cart-list');
    const entries = Object.entries(state.cart);
    document.getElementById('cart-actions').hidden = !entries.length;
    if (!entries.length) {
      el.innerHTML = `<div class="empty"><span class="big">🧺</span>장바구니가 비어 있어요.<br><b>오늘 특가</b>에서 재료를 담아 보세요.</div>`;
      return;
    }
    const items = entries.map(([key, c]) => ({ ...c.item, _key: key, _qty: c.qty, _bought: c.bought }));
    const groups = groupByMart(items);
    let grand = 0;
    el.innerHTML = groups.map(([martId, list]) => {
      const m = martById(martId);
      const sub = list.reduce((s, it) => s + it.price * it._qty, 0);
      grand += sub;
      const left = list.filter((it) => !it._bought).length;
      return `<div class="mart-group">
        <div class="mart-head"><h3><span class="dot" style="background:${esc(m.color)}"></span>${esc(m.name)}</h3><small>${left ? `살 것 ${left}개` : '다 샀어요 ✓'}</small></div>
        ${list.map((it) => `<div class="item ${it._bought ? 'bought' : ''}">
          <input type="checkbox" class="check" data-bought="${esc(it._key)}" ${it._bought ? 'checked' : ''} aria-label="샀음 표시" />
          <div class="info"><div class="name">${it.icon || '🛒'} ${esc(it.name)}</div><div class="meta"><span class="price">${won(it.price * it._qty)}</span>${it._qty > 1 ? `<span>(${won(it.price)} × ${it._qty})</span>` : ''}</div></div>
          <div class="qty">
            <button data-dec="${esc(it._key)}" aria-label="빼기">−</button>
            <span>${it._qty}</span>
            <button data-inc="${esc(it._key)}" aria-label="더하기">+</button>
          </div>
        </div>`).join('')}
        <div class="subtotal"><span>${esc(m.name)} 소계</span><b>${won(sub)}</b></div>
      </div>`;
    }).join('') + `<div class="grand"><span>총 장보기 금액</span><b>${won(grand)}</b></div>`;
  }

  function renderMartSelect() {
    const sel = document.getElementById('paste-mart');
    const cur = sel.value;
    sel.innerHTML = state.marts.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    if (cur && state.marts.some((m) => m.id === cur)) sel.value = cur;
  }

  function renderMartEdit() {
    document.getElementById('mart-edit-list').innerHTML = state.marts.map((m) => `
      <div class="mart-edit">
        <input type="color" value="${esc(m.color)}" data-mcolor="${esc(m.id)}" aria-label="색상" />
        <input type="text" value="${esc(m.name)}" data-mname="${esc(m.id)}" />
        <button class="btn ghost" data-mdel="${esc(m.id)}" style="width:auto;margin:0">삭제</button>
      </div>`).join('');
  }

  function renderPreview() {
    const card = document.getElementById('preview-card');
    card.hidden = !state.preview.length;
    document.getElementById('preview-count').textContent = state.preview.length ? `(${state.preview.length}개)` : '';
    document.getElementById('preview-list').innerHTML = state.preview.map((it, i) => `
      <div class="pv">
        <input type="checkbox" class="check" data-pv-on="${i}" ${it.on ? 'checked' : ''} aria-label="추가" />
        <input type="text" value="${esc(it.name)}" data-pv-name="${i}" />
        <input type="number" inputmode="numeric" value="${it.price}" data-pv-price="${i}" />
      </div>`).join('');
  }

  // ---------- 동작 ----------
  function saveCart() { LS.set('cart', state.cart); }
  function saveManual() { LS.set('manual.' + TODAY, state.manualItems); }
  function saveMarts() { LS.set('marts', state.marts); }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function go(view) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
    window.scrollTo(0, 0);
  }

  function addManualItems(list) {
    for (const it of list) {
      const idx = state.manualItems.findIndex((x) => keyOf(x) === keyOf(it));
      if (idx >= 0) state.manualItems[idx] = it; else state.manualItems.push(it);
    }
    saveManual();
  }

  function shoppingListText() {
    const items = Object.values(state.cart).map((c) => ({ ...c.item, _qty: c.qty, _bought: c.bought }));
    let grand = 0;
    const lines = [`🧺 민식당 장보기 (${TODAY})`];
    for (const [martId, list] of groupByMart(items)) {
      const sub = list.reduce((s, it) => s + it.price * it._qty, 0);
      grand += sub;
      lines.push('', `[${martById(martId).name}] ${won(sub)}`);
      for (const it of list) lines.push(`${it._bought ? '✅' : '▫️'} ${it.name}${it._qty > 1 ? ' ×' + it._qty : ''} — ${won(it.price * it._qty)}`);
    }
    lines.push('', `합계 ${won(grand)}`);
    return lines.join('\n');
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function bindEvents() {
    document.body.addEventListener('click', async (e) => {
      const t = e.target.closest('button, input[type=checkbox]');
      if (!t) return;
      const d = t.dataset;

      if (d.go) { go(d.go); return; }
      if (d.cat) { state.filterCat = d.cat; renderChips(); renderSales(); return; }
      if (d.mart) { state.filterMart = d.mart; renderChips(); renderSales(); return; }

      if (d.add) {
        if (state.cart[d.add]) { delete state.cart[d.add]; toast('장바구니에서 뺐어요'); }
        else {
          const it = allItems().find((x) => keyOf(x) === d.add);
          if (it) { state.cart[d.add] = { item: it, qty: 1, bought: false }; toast(`${martById(it.mart).name} 장바구니에 담았어요`); }
        }
        saveCart(); renderStats(); renderSales(); renderCart(); return;
      }
      if (d.inc) { state.cart[d.inc].qty++; saveCart(); renderStats(); renderCart(); return; }
      if (d.dec) {
        if (--state.cart[d.dec].qty <= 0) delete state.cart[d.dec];
        saveCart(); renderStats(); renderCart(); renderSales(); return;
      }
      if (d.bought) { state.cart[d.bought].bought = t.checked; saveCart(); renderCart(); return; }

      if (d.pvOn !== undefined) { state.preview[+d.pvOn].on = t.checked; return; }

      if (d.mdel) {
        if (state.marts.length <= 1) { toast('마트는 하나 이상 있어야 해요'); return; }
        if (!confirm(`'${martById(d.mdel).name}'을(를) 목록에서 지울까요?`)) return;
        state.marts = state.marts.filter((m) => m.id !== d.mdel);
        LS.set('removedMarts', [...LS.get('removedMarts', []), d.mdel]);
        saveMarts(); renderAll(); return;
      }

      switch (t.id) {
        case 'parse-btn': {
          const found = parseSaleText(document.getElementById('paste-text').value);
          state.preview = found.map((it) => ({ ...it, on: true }));
          renderPreview();
          toast(found.length ? `${found.length}개 특가를 찾았어요` : '가격(○○원)이 있는 줄을 못 찾았어요');
          if (found.length) document.getElementById('preview-card').scrollIntoView({ behavior: 'smooth' });
          break;
        }
        case 'save-parsed': {
          const mart = document.getElementById('paste-mart').value;
          const chosen = state.preview.filter((it) => it.on && it.name && it.price > 0)
            .map(({ name, price, original_price }) => ({ mart, name, price, original_price }));
          addManualItems(chosen);
          state.preview = [];
          document.getElementById('paste-text').value = '';
          renderPreview(); renderAll(); go('sales');
          toast(`${martById(mart).name} 특가 ${chosen.length}개 추가!`);
          break;
        }
        case 'manual-add': {
          const name = document.getElementById('manual-name').value.trim();
          const price = parseInt(document.getElementById('manual-price').value, 10);
          if (!name || !(price > 0)) { toast('품목과 가격을 넣어 주세요'); break; }
          const mart = document.getElementById('paste-mart').value;
          addManualItems([{ mart, name, price, original_price: null }]);
          document.getElementById('manual-name').value = '';
          document.getElementById('manual-price').value = '';
          renderAll(); toast(`${martById(mart).name}에 '${name}' 추가`);
          break;
        }
        case 'copy-list':
          toast((await copyText(shoppingListText())) ? '복사했어요! 카톡에 붙여넣기 하세요' : '복사에 실패했어요');
          break;
        case 'clear-cart':
          if (confirm('장바구니를 비울까요?')) { state.cart = {}; saveCart(); renderAll(); }
          break;
        case 'add-mart': {
          const input = document.getElementById('new-mart');
          const name = input.value.trim();
          if (!name) break;
          state.marts.push({ id: 'mart-' + Date.now().toString(36), name, color: PALETTE[state.marts.length % PALETTE.length] });
          input.value = '';
          saveMarts(); renderAll(); toast(`'${name}' 추가했어요`);
          break;
        }
        case 'clear-manual':
          if (confirm('오늘 직접 넣은 특가를 모두 지울까요?')) { state.manualItems = []; saveManual(); renderAll(); }
          break;
      }
    });

    document.body.addEventListener('change', (e) => {
      const d = e.target.dataset;
      if (d.mname) { const m = martById(d.mname); m.name = e.target.value.trim() || m.name; saveMarts(); renderAll(); }
      if (d.mcolor) { martById(d.mcolor).color = e.target.value; saveMarts(); renderAll(); }
    });

    document.body.addEventListener('input', (e) => {
      const d = e.target.dataset;
      if (e.target.id === 'search') { state.query = e.target.value; renderSales(); }
      if (d.pvName !== undefined) state.preview[+d.pvName].name = e.target.value;
      if (d.pvPrice !== undefined) state.preview[+d.pvPrice].price = parseInt(e.target.value, 10) || 0;
    });
  }

  init();
})();
