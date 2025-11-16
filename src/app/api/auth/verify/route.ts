import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin"; // Your Firebase admin setup

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Get additional user data from Firebase Auth
    const user = await adminAuth.getUser(decodedToken.uid);

    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      name: user.displayName || user.email,
      role: decodedToken.role || 'user', // Make sure role is included in your token
      emailVerified: user.emailVerified,
    });
    
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}