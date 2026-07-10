// Vercel Routing Middleware — 사이트 전체(페이지 + /api/*)에 Basic Auth 접근 제한 적용
// 실제 보유종목/수익률 등 개인 금융정보가 표시되므로, 로그인 전에는 어떤 경로도 노출하지 않습니다.
// 참고: 프레임워크 미사용 프로젝트는 .mjs 확장자(또는 package.json "type":"module")가 필요하며,
// 체인을 통과시키려면 반드시 @vercel/functions 의 next() 를 반환해야 합니다.
import { next } from '@vercel/functions';

export const config = {
  matcher: '/((?!_vercel/).*)',
};

function unauthorized() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Morning Briefing", charset="UTF-8"',
    },
  });
}

export default function middleware(request) {
  const validUser = process.env.SITE_USER;
  const validPass = process.env.SITE_PASSWORD;

  // 서버에 비밀번호가 설정되지 않은 경우, 안전하게 기본 차단
  if (!validUser || !validPass) {
    return unauthorized();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    let decoded = '';
    try {
      decoded = atob(authHeader.slice(6));
    } catch (e) {
      return unauthorized();
    }
    const sep = decoded.indexOf(':');
    const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
    const pass = sep >= 0 ? decoded.slice(sep + 1) : '';
    if (user === validUser && pass === validPass) {
      return next();
    }
  }

  return unauthorized();
}
