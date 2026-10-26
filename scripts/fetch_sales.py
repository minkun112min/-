"""마트 홈페이지에서 오늘의 특가를 가져와 data/sales.json 에 저장합니다.

config/marts.json 에서 url 과 selectors 가 채워진 마트만 수집합니다.
- selectors.item           : 특가 상품 하나를 감싸는 요소 (CSS 선택자)
- selectors.name           : 그 안의 상품명
- selectors.price          : 그 안의 판매가(할인가)
- selectors.original_price : 그 안의 정상가 (없으면 비워두기)
item 선택자를 비워두면 페이지 글자 전체를 카톡 붙여넣기와 같은 방식으로 읽습니다.

실행: python scripts/fetch_sales.py
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config" / "marts.json"
OUTPUT = ROOT / "data" / "sales.json"
KST = timezone(timedelta(hours=9))
PRICE_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+)\s*원?")
TEXT_PRICE_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+)\s*원")
HEADERS = {"User-Agent": "Mozilla/5.0 (민식당 특가 알리미)"}


def to_price(text):
    if not text:
        return None
    m = PRICE_RE.search(text.replace(" ", ""))
    return int(m.group(1).replace(",", "")) if m else None


def scrape_with_selectors(soup, mart):
    sel = mart["selectors"]
    items = []
    for node in soup.select(sel["item"]):
        name_el = node.select_one(sel["name"]) if sel.get("name") else None
        price_el = node.select_one(sel["price"]) if sel.get("price") else None
        orig_el = node.select_one(sel["original_price"]) if sel.get("original_price") else None
        name = name_el.get_text(" ", strip=True) if name_el else ""
        price = to_price(price_el.get_text(" ", strip=True)) if price_el else None
        orig = to_price(orig_el.get_text(" ", strip=True)) if orig_el else None
        if name and price:
            items.append({
                "mart": mart["id"],
                "name": name,
                "price": price,
                "original_price": orig if orig and orig > price else None,
            })
    return items


def scrape_text(soup, mart):
    """선택자가 없을 때: 줄마다 '품목 ... 가격원' 형태를 찾습니다."""
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
        price = min(prices)
        orig = max(prices)
        items.append({
            "mart": mart["id"],
            "name": name,
            "price": price,
            "original_price": orig if orig > price else None,
        })
    return items


def main():
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    marts = [m for m in config.get("marts", []) if m.get("url")]
    if not marts:
        print("홈페이지 주소(url)가 설정된 마트가 없어 수집을 건너뜁니다.")
        return 0

    all_items, failed = [], []
    for mart in marts:
        try:
            res = requests.get(mart["url"], headers=HEADERS, timeout=20)
            res.raise_for_status()
            res.encoding = res.apparent_encoding or res.encoding
            soup = BeautifulSoup(res.text, "html.parser")
            if mart.get("selectors", {}).get("item"):
                items = scrape_with_selectors(soup, mart)
            else:
                items = scrape_text(soup, mart)
            print(f"{mart['name']}: {len(items)}개")
            all_items.extend(items)
        except Exception as e:  # 한 마트가 실패해도 나머지는 계속
            print(f"{mart['name']} 실패: {e}", file=sys.stderr)
            failed.append(mart["name"])

    if not all_items:
        print("가져온 특가가 없어 기존 파일을 유지합니다.")
        return 1 if failed else 0

    now = datetime.now(KST)
    OUTPUT.write_text(
        json.dumps(
            {
                "date": now.strftime("%Y-%m-%d"),
                "updated_at": now.isoformat(timespec="seconds"),
                "failed": failed,
                "items": all_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"저장 완료: 총 {len(all_items)}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
