// app/api/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface VerifyOTPRequestBody {
  email: string;
  otp: string;
  otpHash: string;
  expiresAt: number;
}

export async function POST(request: NextRequest) {
  console.log('🔍 === verify-otp ===');
  
  try {
    const body: VerifyOTPRequestBody = await request.json();
    const { email, otp, otpHash, expiresAt } = body;

    console.log('Verifying:', { email, otp, hasHash: !!otpHash, expiresAt });

    if (!email || !otp || !otpHash || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check expiration
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Verify OTP
    try {
      const decoded = Buffer.from(otpHash, 'base64').toString('utf-8');
      console.log('Decoded hash:', decoded);
      
      const parts = decoded.split(':');
      
      if (parts.length !== 3) {
        return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
      }
      
      const [hashEmail, hashOtp] = parts;
      
      console.log('Comparing:', { hashEmail, hashOtp, email: email.toLowerCase(), otp });
      
      // Verify email and OTP match
      if (hashEmail !== email.toLowerCase() || hashOtp !== otp) {
        return NextResponse.json({ error: 'Invalid OTP. Please check and try again.' }, { status: 400 });
      }
      
      console.log('✅ OTP verified successfully');
      return NextResponse.json({ success: true, message: 'OTP verified successfully' });
      
    } catch (error) {
      console.error('OTP decode error:', error);
      return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('❌ Verify OTP error:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}