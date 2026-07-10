export const config = {
  matcher: '/',
};

export default function middleware(request) {
  let info;
  try {
    const authHeader = request.headers.get('authorization');
    let atobResult = null;
    let atobError = null;
    try {
      atobResult = atob('dGVzdDoxMjM=');
    } catch (e) {
      atobError = String(e);
    }
    info = {
      hasRequest: typeof request,
      authHeader: authHeader,
      atobResult,
      atobError,
    };
  } catch (e) {
    info = { error: String(e), stack: e && e.stack };
  }
  return new Response(JSON.stringify(info), { status: 200, headers: { 'content-type': 'application/json' } });
}
