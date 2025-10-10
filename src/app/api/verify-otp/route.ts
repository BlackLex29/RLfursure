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

    // ✅ Basic field checks
    if (!email || !otp || !otpHash || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ Expiry check
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // ✅ Decode and verify OTP hash
    try {
      const decoded = Buffer.from(otpHash, 'base64').toString('utf-8');
      const [hashEmail, hashOtp, hashTimestamp] = decoded.split(':');

      console.log('Decoded OTP hash:', { hashEmail, hashOtp, hashTimestamp });

      // Ensure structure is valid
      if (!hashEmail || !hashOtp || !hashTimestamp) {
        return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
      }

      // Optional: double-check timestamp for extra safety (within 10 mins)
      const MAX_AGE_MS = 10 * 60 * 1000;
      if (Date.now() - parseInt(hashTimestamp) > MAX_AGE_MS) {
        return NextResponse.json({ error: 'OTP has expired (timestamp check)' }, { status: 400 });
      }

      // ✅ Match email and OTP
      if (hashEmail !== email.toLowerCase() || hashOtp !== otp) {
        console.warn('❌ OTP mismatch:', { expectedEmail: hashEmail, expectedOtp: hashOtp });
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
