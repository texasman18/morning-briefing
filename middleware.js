export const config = {
  matcher: '/',
};

export default function middleware() {
  let info;
  try {
    info = {
      hasProcess: typeof process,
      envUser: typeof process !== 'undefined' ? (process.env ? process.env.SITE_USER : 'no-env-obj') : 'no-process',
    };
  } catch (e) {
    info = { error: String(e) };
  }
  return new Response(JSON.stringify(info), { status: 200, headers: { 'content-type': 'application/json' } });
}
