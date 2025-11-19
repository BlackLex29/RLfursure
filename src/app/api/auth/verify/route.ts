import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    // Get admin auth instance
    const adminAuth = getAdminAuth();

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Get user data
    const user = await adminAuth.getUser(decodedToken.uid);

    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      name: user.displayName || user.email,
      role: decodedToken.role || 'user',
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}