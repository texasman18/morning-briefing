export const config = {
  matcher: '/',
};

export default function middleware() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Morning Briefing", charset="UTF-8"',
    },
  });
}
