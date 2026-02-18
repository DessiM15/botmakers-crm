import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// CRM routes that require team auth
const CRM_ROUTES = [
  '/pipeline',
  '/leads',
  '/clients',
  '/projects',
  '/proposals',
  '/invoices',
  '/email-generator',
  '/settings',
  '/activity',
  '/referrals',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip middleware for webhooks and cron routes — handled in route handlers
  if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // Skip middleware for static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session on every request
  const { data: { user } } = await supabase.auth.getUser();

  const isCrmRoute =
    pathname === '/' ||
    CRM_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  const isPortalRoute = pathname.startsWith('/portal') && pathname !== '/portal/login';
  const isSignIn = pathname === '/sign-in';
  const isPortalLogin = pathname === '/portal/login';

  // /sign-in with session → redirect /
  if (isSignIn && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // /portal/login with session → redirect /portal
  if (isPortalLogin && user) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  // CRM routes: no session → redirect /sign-in
  if (isCrmRoute && !user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // CRM routes: check team_users.is_active (use service role to bypass RLS)
  if (isCrmRoute && user) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: teamUser } = await admin
      .from('team_users')
      .select('is_active')
      .eq('id', user.id)
      .single();

    if (!teamUser || teamUser.is_active === false) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
  }

  // Portal routes: no session → redirect /portal/login
  if (isPortalRoute && !user) {
    return NextResponse.redirect(new URL('/portal/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
