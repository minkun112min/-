"""실행: python scripts/test_fetch.py  (홈마트 스마트전단 저장본으로 수집기 확인)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_sales import parse_dhn, price_cell  # noqa: E402

html = (Path(__file__).parent.parent / "tests/fixtures/dhn_view.html").read_text(encoding="utf-8")
items, title = parse_dhn(html, "dhn")
names = {i["name"]: i for i in items}
assert len(items) == 82, len(items)
assert names["알타리 4단"]["price"] == 9900 and names["알타리 4단"]["badge"] == "대박초특가"
assert names["오뚜기3분쇠고기카레/짜장 200g"]["price"] == 1180  # "각1,180"
assert {i["section"] for i in items} >= {"야채코너", "정육", "수산코너"}
assert not any("절임배추" in n for n in names)  # 가격 없는 안내 상품은 제외
assert price_cell("11월7일부터 배송됩니다") is None
assert "10월26" in title
print("✅ 수집기 테스트 통과")

# pabal.net 전단 (광주식자재마트, 엘마트 광주점)
from fetch_sales import parse_pabal  # noqa: E402

root = Path(__file__).parent.parent / "tests/fixtures"
g_items, g_title = parse_pabal((root / "pabal_gjs.html").read_text(encoding="utf-8"), "gjs")
g = {i["name"]: i for i in g_items}
assert len(g_items) > 100, len(g_items)
assert g["창원단감 특/10개"]["price"] == 9900
assert g["연어롤 1팩"]["badge"] == "방문구매전용"
assert g_title.startswith("10월 26일")

o_items, o_title = parse_pabal((root / "pabal_ogq.html").read_text(encoding="utf-8"), "ogq")
o = {i["name"]: i for i in o_items}
assert len(o_items) > 300, len(o_items)
assert o["양파 15Kg/1망"]["price"] == 18900 and o["양파 15Kg/1망"]["section"] == "상상초월 대표상품"
assert o["대파 1단"]["section"] == "10월 26일 월요장날~"
print("✅ pabal 수집기 테스트 통과")
