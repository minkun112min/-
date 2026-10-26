"""마트 홈페이지에서 오늘의 특가를 가져와 data/sales.json 에 저장합니다.

config/marts.json 의 마트마다 "type" 으로 읽는 방법을 정합니다.
- "dhn_smart" : smart.dhn.kr 스마트전단 (메인 → '행사보기' 페이지의 상품 목록)
- "selectors" : 일반 홈페이지. selectors 에 CSS 선택자를 적어 둠
- "text"      : 페이지 글자에서 '품목 ○○원' 줄을 찾음
- "link"      : 자동 수집하지 않음 (앱의 바로가기 버튼만)
"inbox": true 인 마트는 서버가 직접 접속하지 않고, 아이패드 단축어가 inbox/ 폴더에
올린 페이지를 scripts/process_inbox.py 가 읽습니다 (해외 접속이 막힌 마트용).

실행: python scripts/fetch_sales.py
       python scripts/fetch_sales.py --file dhn=tests/fixtures/dhn_view.html   (저장된 파일로 시험)
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config" / "marts.json"
OUTPUT = ROOT / "data" / "sales.json"
KST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
}
TEXT_PRICE_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+)\s*원")
# "9,900" "각1,180" "1,980원" 처럼 가격만 있는 칸
PRICE_CELL_RE = re.compile(r"^\D{0,4}?(\d{1,3}(?:,\d{3})+|\d{3,7})\s*원?\s*$")


def price_cell(text):
    m = PRICE_CELL_RE.match((text or "").strip())
    return int(m.group(1).replace(",", "")) if m else None


def get(url):
    res = requests.get(url, headers=HEADERS, timeout=30)
    res.raise_for_status()
    res.encoding = "utf-8" if "utf" in (res.encoding or "").lower() else (res.apparent_encoding or res.encoding)
    return res.text


def text_of(node, selector):
    el = node.select_one(selector) if node is not None else None
    return el.get_text(" ", strip=True) if el else ""


# ---------- smart.dhn.kr 스마트전단 ----------
def dhn_view_url(home_html, home_url):
    m = re.search(r"/smart/view/[A-Za-z0-9]+\?home=[A-Za-z0-9]+", home_html)
    return urljoin(home_url, m.group(0)) if m else None


def parse_dhn(html, mart_id):
    soup = BeautifulSoup(html, "html.parser")

    # 코너 이름: 메뉴의 tit_text_info_click(4) → '야채코너', 't' → 첫 코너
    sections = {}
    for a in soup.find_all(attrs={"onclick": re.compile(r"tit_text_info_click")}):
        m = re.search(r"tit_text_info_click\('?(\w+)'?\)", a["onclick"])
        label = a.get_text(" ", strip=True).replace("arrow_forward", "").strip()
        if m and label:
            sections.setdefault("0" if m.group(1) == "t" else m.group(1), label)

    items, seen = [], set()
    # 첫 코너는 <dl>, 나머지 코너는 <div class="pop_item"> 에 들어 있음
    for node in soup.select("dl[data-goods-hide], div.pop_item[data-goods-hide]"):
        if node.get("data-goods-hide") == "Y":
            continue
        if node.name == "dl":
            name = text_of(node, "li.name span[id^=pre_goods_name]")
            option = text_of(node, "li.name span[id^=pre_goods_option]")
        else:
            spans = [s.get_text(" ", strip=True) for s in node.select(".pop_name span")]
            name = spans[0] if spans else ""
            option = spans[1] if len(spans) > 1 else ""
        price = price_cell(text_of(node, ".price2"))
        original = price_cell(text_of(node, ".price1"))
        if not name or not price:
            continue  # "주문받습니다" 처럼 가격이 없는 안내 상품
        full = f"{name} {option}".strip()
        step = text_of(node, ".step_no")
        key = (full, price)
        if key in seen:
            continue
        seen.add(key)
        items.append({
            "mart": mart_id,
            "name": full,
            "price": price,
            "original_price": original if original and original > price else None,
            "section": sections.get(step, ""),
            "badge": text_of(node, ".pop_option_wrap1 .pop_option"),
        })
    title = text_of(soup, ".pre_tit")
    return items, title


def scrape_dhn(mart):
    home = get(mart["url"])
    view = dhn_view_url(home, mart["url"])
    if not view:
        raise RuntimeError("'행사보기' 링크를 찾지 못함")
    return parse_dhn(get(view), mart["id"])


# ---------- pabal.net 전단 (광주식자재마트, 엘마트 광주점) ----------
PABAL_PRICE = re.compile(r"^(now_price\d*|proc_price)$")
PABAL_NAME = re.compile(r"^flexTableItemHeader")
DATE_TITLE = re.compile(r"^\d{1,2}월\s*\d{1,2}일")


def parse_pabal(html, mart_id):
    soup = BeautifulSoup(html, "html.parser")
    items, seen, section, title = [], {}, "", ""
    for el in soup.find_all(True):
        classes = el.get("class") or []
        if "flexTableTitle" in classes:  # 코너 제목 (엘마트: "▶ 야채식자재 3일장")
            raw = el.get_text(" ", strip=True)
            text = raw.lstrip("▶ ").strip()
            if DATE_TITLE.match(text) and not raw.startswith("▶"):
                title = title or text
            elif text and text != "전단보기":
                section = text
            continue
        if not any(PABAL_PRICE.match(c) for c in classes):
            continue
        price = price_cell(el.get_text(strip=True))
        if not price:
            continue
        # 가격 칸에서 위로 올라가며 상품명 칸이 들어 있는 상품 카드를 찾음
        card, name_el = el, None
        for _ in range(4):
            card = card.parent
            if card is None:
                break
            name_el = card.find(class_=PABAL_NAME)
            if name_el:
                break
        if not name_el:
            continue
        status = card.parent.find(attrs={"data-c": True}) if card.parent else None
        if status is not None and status.get("data-c") in ("Y", "X"):  # Y 품절, X 금액 없음
            continue
        name = re.sub(r"\s+", " ", name_el.get_text(" ", strip=True)).strip("` ")
        if not name:
            continue
        badge = text_of(card, ".exclusive_box")
        if (name, price) in seen:  # 대표상품과 코너에 같은 상품이 또 나옴 → 표시만 보충
            old = seen[(name, price)]
            old["badge"] = old["badge"] or badge
            old["section"] = old["section"] or section
            continue
        items.append({
            "mart": mart_id,
            "name": name,
            "price": price,
            "original_price": None,
            "section": section,
            "badge": badge,
        })
        seen[(name, price)] = items[-1]
    return items, title


# ---------- 일반 홈페이지 ----------
def scrape_selectors(html, mart):
    soup = BeautifulSoup(html, "html.parser")
    sel = mart["selectors"]
    items = []
    for node in soup.select(sel["item"]):
        name = text_of(node, sel["name"]) if sel.get("name") else ""
        price = price_cell(text_of(node, sel["price"])) if sel.get("price") else None
        orig = price_cell(text_of(node, sel["original_price"])) if sel.get("original_price") else None
        if name and price:
            items.append({"mart": mart["id"], "name": name, "price": price,
                          "original_price": orig if orig and orig > price else None})
    return items


def scrape_text(html, mart):
    soup = BeautifulSoup(html, "html.parser")
    items = []
    for line in soup.get_text("\n").splitlines():
        line = line.strip()
        prices = [int(p.replace(",", "")) for p in TEXT_PRICE_RE.findall(line)]
        prices = [p for p in prices if p >= 10]
        if not prices:
            continue
        name = TEXT_PRICE_RE.split(line)[0]
        name = re.sub(r"[\[\]★☆▶→~:*#\-|]|정상가|판매가|할인가|특가", " ", name)
        name = re.sub(r"\s+", " ", name).strip()
        if not name or len(name) > 40:
            continue
        price, orig = min(prices), max(prices)
        items.append({"mart": mart["id"], "name": name, "price": price,
                      "original_price": orig if orig > price else None})
    return items


def parse_html(mart, html):
    """이미 받은 HTML(아이패드가 올린 파일 등)에서 특가를 읽습니다."""
    kind = mart.get("type") or "text"
    if kind == "dhn_smart":
        return parse_dhn(html, mart["id"])
    if kind == "pabal":
        return parse_pabal(html, mart["id"])
    if kind == "selectors":
        return scrape_selectors(html, mart), ""
    return scrape_text(html, mart), ""


def scrape(mart):
    """서버에서 직접 접속해 특가를 읽습니다."""
    if mart.get("type") == "dhn_smart":
        return scrape_dhn(mart)
    return parse_html(mart, get(mart["url"]))


def decode_html(raw: bytes) -> str:
    for enc in ("utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="replace")


def load_config():
    return json.loads(CONFIG.read_text(encoding="utf-8")).get("marts", [])


def save_sales(results, failed=()):
    """results = {마트id: (items, 제목)}. 이번에 읽은 마트만 바꾸고 나머지 마트 특가는 그대로 둡니다."""
    try:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    if data.get("sample"):
        data = {}
    now = datetime.now(KST)
    stamp = now.isoformat(timespec="seconds")
    items = [it for it in data.get("items", []) if it.get("mart") not in results]
    notes = {k: v for k, v in data.get("notes", {}).items() if k not in results}
    updated = {k: v for k, v in data.get("mart_updated", {}).items() if k not in results}
    for mid, (new_items, title) in results.items():
        items.extend(new_items)
        updated[mid] = stamp
        if title:
            notes[mid] = title
    OUTPUT.write_text(
        json.dumps({
            "date": now.strftime("%Y-%m-%d"),
            "updated_at": stamp,
            "mart_updated": updated,
            "failed": list(failed),
            "notes": notes,
            "items": items,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"저장 완료: 총 {len(items)}개")


def main(argv):
    local = {}
    if "--file" in argv:
        for spec in argv[argv.index("--file") + 1:]:
            mid, _, path = spec.partition("=")
            local[mid] = path

    marts = [m for m in load_config() if m.get("url") and m.get("type") != "link" and not m.get("inbox")]
    if local:
        marts = [m for m in load_config() if m["id"] in local]
    if not marts:
        print("자동 수집할 마트가 없습니다.")
        return 0

    results, failed = {}, []
    for mart in marts:
        try:
            if mart["id"] in local:
                got = parse_html(mart, decode_html(Path(local[mart["id"]]).read_bytes()))
            else:
                got = scrape(mart)
            print(f"{mart['name']}: {len(got[0])}개")
            if got[0]:
                results[mart["id"]] = got
            else:
                failed.append(mart["name"])
        except Exception as e:  # 한 마트가 실패해도 나머지는 계속
            print(f"{mart['name']} 실패: {e}", file=sys.stderr)
            failed.append(mart["name"])

    if not results:
        print("가져온 특가가 없어 기존 파일을 유지합니다.")
        return 1 if failed else 0
    save_sales(results, failed)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
