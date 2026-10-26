// 민식당 특가 수집 (Scriptable 로더)
// 이 코드를 Scriptable 앱에 한 번만 붙여넣으세요. 고칠 일이 생기면
// GitHub 의 ipad/collect.js 만 바뀌고, 이 코드는 그대로 둡니다.
const REPO = 'minkun112min/-';
const REFS = ['main', 'claude/mart-sale-automation-ydx056'];
const KEY = 'minsikdang_github_token';

// 1) 토큰: 처음 한 번만 물어보고 아이패드 키체인(암호 저장소)에 보관
if (!Keychain.contains(KEY)) {
  const a = new Alert();
  a.title = 'GitHub 토큰 입력';
  a.message = 'github_pat_ 로 시작하는 토큰을 붙여넣으세요. 이 아이패드에만 안전하게 저장됩니다.';
  a.addSecureTextField('github_pat_...');
  a.addAction('저장');
  await a.present();
  const typed = a.textFieldValue(0).trim();
  if (typed) Keychain.set(KEY, typed);
}
const token = Keychain.contains(KEY) ? Keychain.get(KEY) : '';

// 2) GitHub 에서 최신 수집 코드 받기
let code = null, ref = null, why = '';
for (const r of REFS) {
  const req = new Request(`https://api.github.com/repos/${REPO}/contents/ipad/collect.js?ref=${encodeURIComponent(r)}`);
  req.headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw' };
  const text = await req.loadString();
  if (req.response.statusCode === 200) { code = text; ref = r; break; }
  why += `${r}: ${req.response.statusCode} `;
}

// 3) 실행하고 결과 보여주기
let result;
if (!code) {
  // 토큰이 틀렸으면(401) 지워서 다음 실행 때 다시 묻기
  if (/401|403/.test(why) && Keychain.contains(KEY)) Keychain.remove(KEY);
  result = `수집 코드를 못 받았어요 (${why}). 401이면 토큰이 틀렸거나 만료된 거예요. 다시 실행하면 토큰을 새로 물어봐요.`;
} else {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    result = await new AsyncFunction('token', 'ref', code)(token, ref);
  } catch (e) {
    result = `오류: ${e}`;
  }
}

if (config.runsInApp) {
  const done = new Alert();
  done.title = '민식당 특가 수집';
  done.message = String(result);
  done.addAction('확인');
  await done.present();
}
Script.setShortcutOutput(String(result));
Script.complete();
