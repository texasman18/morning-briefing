import { next } from '@vercel/functions';

export const config = {
  matcher: '/((?!_vercel/).*)',
};

export default function middleware() {
  return next();
}
