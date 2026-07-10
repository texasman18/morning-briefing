export const config = {
  matcher: '/',
};

export default function middleware() {
  return new Response('Authentication required.', {
    status: 401,
  });
}
