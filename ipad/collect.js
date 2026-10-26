// 민식당 특가 수집 — 아이패드 Scriptable 앱에서 실행되는 본체입니다.
// 아이패드의 로더(ipad/loader.js)가 실행할 때마다 이 파일을 GitHub에서 받아 실행합니다.
// 그래서 이 파일만 고치면 아이패드에서는 아무것도 바꿀 필요가 없습니다.
//
// 하는 일: 해외 접속이 막힌 마트 페이지를 한국에 있는 아이패드가 받아 inbox/ 에 올림
//          → GitHub 작업(inbox.yml)이 특가로 정리
// 실행 기록은 ipad/last-run.txt 에 남겨 문제를 원격으로 확인합니다.
// (이 파일 안에서는 로더가 넘겨준 token, ref 를 씁니다)

const REPO = 'minkun112min/-';
const BRANCH = 'main';
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// pabal.net 전단: 첫 화면이 오늘 행사 페이지로 이동하라는 짧은 안내문을 줌
const MARTS = [
  { id: 'gjs', url: 'https://gjs.pabal.net/' },
  { id: 'ogq', url: 'https://ogq.pabal.net/' },
];

const log = [];
const say = (msg) => { log.push(msg); console.log(msg); };

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function absolute(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = base.match(/^https?:\/\/[^/]+/i)[0];
  return path.startsWith('/') ? origin + path : origin + '/' + path;
}

async function fetchPage(url) {
  const r = new Request(url);
  r.headers = { 'User-Agent': UA };
  r.timeoutInterval = 30;
  const text = await r.loadString();
  const code = r.response ? r.response.statusCode : '?';
  return { text, code };
}

// 자바스크립트 이동(location.href='...')을 최대 3번까지 따라감
async function fetchFollowing(url) {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const { text, code } = await fetchPage(current);
    say(`  GET ${current} → ${code}, ${text.length}자`);
    const m = text.length < 5000 && text.match(/location\.(?:href\s*=|replace\s*\()\s*['"]([^'"]+)['"]/);
    if (!m) return { text, finalUrl: current };
    current = absolute(current, m[1]);
    say(`  ↪ 이동 안내 발견: ${current}`);
  }
  throw new Error('이동이 너무 많음');
}

async function github(method, path, body) {
  const r = new Request(`https://api.github.com/repos/${REPO}/contents/${path}`);
  r.method = method;
  r.headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  if (body) r.body = JSON.stringify(body);
  let json = {};
  try { json = await r.loadJSON(); } catch (e) { /* 빈 응답 */ }
  return { code: r.response ? r.response.statusCode : 0, json };
}

async function putFile(path, text, message) {
  // 같은 이름 파일이 있으면 sha 를 붙여야 덮어쓸 수 있음
  const old = await github('GET', `${path}?ref=${BRANCH}`);
  const body = { message, branch: BRANCH, content: Data.fromString(text).toBase64String() };
  if (old.code === 200 && old.json.sha) body.sha = old.json.sha;
  return github('PUT', path, body);
}

const results = [];
say(`민식당 특가 수집 시작 ${new Date().toLocaleString('ko-KR')} (코드: ${ref})`);

for (const mart of MARTS) {
  say(`[${mart.id}]`);
  try {
    const { text, finalUrl } = await fetchFollowing(mart.url);
    const html = `<!-- source: ${finalUrl} -->\n` + text;
    const path = `inbox/${mart.id}-${stamp()}.html`;
    const up = await putFile(path, html, `아이패드 수집 ${mart.id}`);
    if (up.code === 200 || up.code === 201) {
      say(`  ✅ 업로드 ${path} (${html.length}자)`);
      results.push(`${mart.id} ✅`);
    } else {
      say(`  ❌ 업로드 실패 ${up.code}: ${JSON.stringify(up.json).slice(0, 300)}`);
      results.push(`${mart.id} ❌ 업로드 ${up.code}`);
    }
  } catch (e) {
    say(`  ❌ 오류: ${e}`);
    results.push(`${mart.id} ❌`);
  }
}

const logUp = await putFile('ipad/last-run.txt', log.join('\n') + '\n', '아이패드 실행 기록');
if (!(logUp.code === 200 || logUp.code === 201)) say(`(기록 저장 실패 ${logUp.code})`);

return results.join(' · ');
