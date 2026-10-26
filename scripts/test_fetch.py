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
