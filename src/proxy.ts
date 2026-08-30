import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple mock proxy to demonstrate RBAC
export function proxy(request: NextRequest) {
  // In a real application, you would decrypt the session cookie here,
  // extract the user's role, and verify if they can access the path.

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
  
  // Example: require admin role for /admin
  // const role = request.cookies.get('user_role')?.value;
  // if (isAdminPath && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
  //   return NextResponse.redirect(new URL('/', request.url))
  // }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/wallet/:path*',
    '/profile/:path*',
  ],
}
