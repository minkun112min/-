"""아이패드 단축어가 inbox/ 에 올린 마트 페이지를 읽어 data/sales.json 에 반영합니다.

파일 이름: inbox/<마트id>-<아무거나>.html   예) inbox/gjs-20261027-0700.html
- 마트마다 가장 최근 파일만 읽습니다.
- 읽기에 실패하면 원본을 raw/<마트id>.html 로 남깁니다 (페이지 모양이 바뀌었을 때 확인용).
- 읽은 inbox 파일은 지웁니다.

실행: python scripts/process_inbox.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_sales import ROOT, decode_html, load_config, parse_html, save_sales  # noqa: E402

INBOX = ROOT / "inbox"
RAW = ROOT / "raw"


def main():
    files = sorted(p for p in INBOX.glob("*.htm*") if p.is_file())
    if not files:
        print("inbox 가 비어 있습니다.")
        return 0

    marts = {m["id"]: m for m in load_config()}
    latest = {}
    for f in files:  # 이름순 = 시간순이라 마지막 것이 최신
        latest[f.name.split("-")[0].split(".")[0]] = f

    RAW.mkdir(exist_ok=True)
    results, failed = {}, []
    for mid, f in latest.items():
        mart = marts.get(mid)
        if not mart:
            print(f"{f.name}: 모르는 마트 id '{mid}' (config/marts.json 확인)", file=sys.stderr)
            continue
        html = decode_html(f.read_bytes())
        try:
            items, title = parse_html(mart, html)
        except Exception as e:
            print(f"{mart['name']} 읽기 실패: {e}", file=sys.stderr)
            items, title = [], ""
        print(f"{mart['name']}: {len(items)}개 ({f.name}, {len(html):,}자)")
        if items:
            results[mid] = (items, title)
            (RAW / f"{mid}.html").unlink(missing_ok=True)
        else:
            # 읽기에 실패했을 때만 원본을 남겨 원인을 확인 (매일 저장하면 저장소가 커짐)
            (RAW / f"{mid}.html").write_text(html, encoding="utf-8")
            failed.append(mart["name"])

    for f in files:
        f.unlink()

    if results:
        save_sales(results, failed)
    else:
        print("읽은 특가가 없어 기존 특가를 유지합니다. raw/ 의 원본을 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
