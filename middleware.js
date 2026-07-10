export const config = {
  matcher: '/',
};

export default function middleware() {
  return new Response('MIDDLEWARE_ALIVE', { status: 200 });
}
