export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

interface VerifyOTPRequestBody {
  email: string;
  code: string;
  otpHash: string;
}

export async function POST(request: NextRequest) {
  console.log("🚨 === verify-otp ===");

  try {
    const body: VerifyOTPRequestBody = await request.json();
    const { email, code, otpHash } = body;

    if (!email || !code || !otpHash) {
      return NextResponse.json({ error: "Email, code, and OTP hash are required" }, { status: 400 });
    }

    if (code.length !== 6) {
      return NextResponse.json({ error: "Invalid OTP code format" }, { status: 400 });
    }

    // Decode the OTP hash to extract components
    const decodedHash = Buffer.from(otpHash, 'base64').toString('utf-8');
    const [storedEmail, storedCode, timestamp] = decodedHash.split(':');
    
    if (!storedEmail || !storedCode || !timestamp) {
      return NextResponse.json({ error: "Invalid OTP hash" }, { status: 400 });
    }

    // Verify email matches
    if (storedEmail.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 400 });
    }

    // Verify OTP code (the storedCode is the actual OTP)
    if (storedCode !== code) {
      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    // Verify OTP is not expired (10 minutes)
    const currentTime = Date.now();
    const otpTime = parseInt(timestamp);
    const tenMinutes = 10 * 60 * 1000;
    
    if (currentTime - otpTime > tenMinutes) {
      return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
    }

    console.log("✅ OTP verified successfully for:", email);
    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error: unknown) {
    console.error("❌ OTP verification error:", error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify OTP';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}