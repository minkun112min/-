#!/usr/bin/env bash
# 특가 처리 → 저장 → main 에 올리기. 다른 작업이 먼저 올려서 충돌하면
# 최신 상태를 다시 받아 처음부터 다시 처리합니다 (최대 5번).
# 사용: scripts/save_and_push.sh "<커밋 메시지>" <처리 명령...>
set -u
msg="$1"; shift
branch="${GITHUB_REF_NAME:-main}"
git config user.name "minsikdang-bot"
git config user.email "actions@users.noreply.github.com"

for attempt in 1 2 3 4 5; do
  git fetch -q origin "$branch"
  git reset -q --hard "origin/$branch"
  "$@" || echo "처리 명령이 실패 코드를 냈지만 바뀐 내용이 있으면 저장합니다"
  git add -A
  if git diff --cached --quiet; then
    echo "변경 없음"
    exit 0
  fi
  git commit -q -m "$msg"
  if git push -q origin "HEAD:$branch"; then
    echo "저장 완료 (시도 $attempt)"
    exit 0
  fi
  echo "다른 작업과 겹침 → 최신 상태로 다시 처리 (시도 $attempt)"
  sleep $((attempt * 3))
done
echo "5번 시도했지만 저장하지 못했습니다"
exit 1
