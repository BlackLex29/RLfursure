// app/api/verify-otp/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig"; // Adjust path as needed

interface VerifyOTPRequestBody {
  email: string;
  code: string;
  otpHash: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  console.log("🚨 === verify-otp API called ===");

  try {
    const body: VerifyOTPRequestBody = await request.json();
    console.log("📦 Received body:", { 
      email: body.email, 
      code: body.code?.length, 
      hasOtpHash: !!body.otpHash,
      userId: body.userId 
    });

    const { email, code, otpHash, userId } = body;

    // Validation
    if (!email || !code || !otpHash) {
      console.error("❌ Missing required fields:", { 
        hasEmail: !!email, 
        hasCode: !!code, 
        hasOtpHash: !!otpHash 
      });
      return NextResponse.json(
        { error: "Email, code, and OTP hash are required" }, 
        { status: 400 }
      );
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { error: "Invalid OTP code format" }, 
        { status: 400 }
      );
    }

    console.log("🔍 Decoding OTP hash...");
    
    // Decode the OTP hash to extract components
    let decodedHash: string;
    try {
      decodedHash = Buffer.from(otpHash, 'base64').toString('utf-8');
      console.log("📝 Decoded hash structure (sanitized):", decodedHash.split(':').map((part, i) => 
        i === 1 ? '***' : part.substring(0, 10) + '...'
      ));
    } catch (decodeError) {
      console.error("❌ Failed to decode OTP hash:", decodeError);
      return NextResponse.json(
        { error: "Invalid OTP hash format" }, 
        { status: 400 }
      );
    }

    const [storedEmail, storedCode, timestamp] = decodedHash.split(':');
    
    if (!storedEmail || !storedCode || !timestamp) {
      console.error("❌ Invalid hash components:", { 
        hasEmail: !!storedEmail, 
        hasCode: !!storedCode, 
        hasTimestamp: !!timestamp 
      });
      return NextResponse.json(
        { error: "Invalid OTP hash structure" }, 
        { status: 400 }
      );
    }

    // Verify email matches (case-insensitive)
    if (storedEmail.toLowerCase() !== email.toLowerCase()) {
      console.error("❌ Email mismatch:", { 
        stored: storedEmail.toLowerCase(), 
        provided: email.toLowerCase() 
      });
      return NextResponse.json(
        { error: "Email verification failed" }, 
        { status: 400 }
      );
    }

    // Verify OTP code matches exactly
    if (storedCode !== code) {
      console.error("❌ OTP code mismatch");
      return NextResponse.json(
        { error: "Invalid OTP code" }, 
        { status: 400 }
      );
    }

    // Verify OTP is not expired (10 minutes)
    const currentTime = Date.now();
    const otpTime = parseInt(timestamp, 10);
    const tenMinutes = 10 * 60 * 1000;
    
    if (isNaN(otpTime)) {
      console.error("❌ Invalid timestamp:", timestamp);
      return NextResponse.json(
        { error: "Invalid OTP timestamp" }, 
        { status: 400 }
      );
    }

    const timeElapsed = currentTime - otpTime;
    if (timeElapsed > tenMinutes) {
      console.error("❌ OTP expired:", { 
        timeElapsed: `${Math.floor(timeElapsed / 1000 / 60)} minutes`,
        maxAllowed: "10 minutes"
      });
      return NextResponse.json(
        { error: "OTP has expired. Please request a new code." }, 
        { status: 400 }
      );
    }

    console.log("✅ OTP verified successfully for:", email);

    // Update Firestore if userId is provided
    if (userId) {
      try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date().toISOString(),
          lastOtpVerification: new Date().toISOString()
        });
        console.log("✅ Firestore updated for user:", userId);
      } catch (firestoreError) {
        console.error("❌ Firestore update error:", firestoreError);
        // Don't fail the request if Firestore update fails
        // The frontend will handle the Firestore update
      }
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully! Two-Factor Authentication is now enabled.",
      verifiedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error("❌ OTP verification error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to verify OTP. Please try again.';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}