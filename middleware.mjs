// Vercel Routing Middleware — 사이트 전체(페이지 + /api/*)에 로그인(쿠키) 접근 제한 적용
// 실제 보유종목/수익률 등 개인 금융정보가 표시되므로, 로그인 전에는 어떤 경로도 노출하지 않습니다.
// 참고: Vercel 라우팅 계층이 WWW-Authenticate 응답 헤더를 예약/충돌 처리하여 500대 에러를
// 유발하는 것이 확인되어(네이티브 브라우저 Basic Auth 팝업 대신) 쿠키 기반 커스텀 로그인 폼을 사용합니다.
import { next } from '@vercel/functions';

export const config = {
  matcher: '/((?!_vercel/).*)',
};

const COOKIE_NAME = 'mb_auth';

// 쿠키에는 자격증명 원문 대신 SHA-256 해시 토큰만 저장한다.
// (기존 btoa(user:pass) 방식은 쿠키 유출 = 비밀번호 유출이었음)
async function authToken(user, pass) {
  const data = new TextEncoder().encode('mb-v2:' + user + ':' + pass);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 고정 길이 hex 문자열 비교 (타이밍 차이 최소화)
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function loginPage(showError) {
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>로그인 필요 — 모닝 브리핑</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#1e293b;padding:32px 28px;border-radius:16px;width:280px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
h1{font-size:16px;margin:0 0 20px;text-align:center}
input{width:100%;padding:10px 12px;margin-bottom:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:14px;box-sizing:border-box}
button{width:100%;padding:10px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-weight:700;cursor:pointer;font-size:14px}
.err{color:#f87171;font-size:12px;margin-bottom:10px;text-align:center}
</style></head><body>
<form class="box" method="POST" action="/__login">
<h1>📈 모닝 브리핑 로그인</h1>
${showError ? '<div class="err">아이디 또는 비밀번호가 올바르지 않습니다.</div>' : ''}
<input type="text" name="user" placeholder="아이디" autofocus required>
<input type="password" name="pass" placeholder="비밀번호" required>
<button type="submit">로그인</button>
</form>
</body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export default async function middleware(request) {
  const validUser = process.env.SITE_USER;
  const validPass = process.env.SITE_PASSWORD;

  if (!validUser || !validPass) {
    return new Response('사이트 비밀번호가 설정되지 않았습니다.', { status: 503 });
  }

  const url = new URL(request.url);

  // 로그인 폼 제출 처리
  if (url.pathname === '/__login' && request.method === 'POST') {
    let user = '';
    let pass = '';
    try {
      const form = await request.formData();
      user = form.get('user') || '';
      pass = form.get('pass') || '';
    } catch (e) {
      return loginPage(true);
    }

    if (safeEqual(user, validUser) && safeEqual(pass, validPass)) {
      const token = await authToken(validUser, validPass);
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/',
          'Set-Cookie': COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000',
        },
      });
    }
    return loginPage(true);
  }

  // 쿠키 검증 — 저장된 해시 토큰과 대조 (구버전 btoa 쿠키는 자동으로 불일치 → 재로그인)
  const cookieVal = getCookie(request, COOKIE_NAME);
  if (cookieVal) {
    const expected = await authToken(validUser, validPass);
    if (safeEqual(cookieVal, expected)) {
      return next();
    }
  }

  return loginPage(false);
}
