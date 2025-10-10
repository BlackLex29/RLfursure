// app/api/send-email-otp/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import SibApiV3Sdk from "@getbrevo/brevo";

interface OTPRequestBody {
  email: string;
  name: string;
}

interface BrevoError {
  response?: {
    body?: string;
  };
  message?: string;
}

const OTP_EXPIRY_MINUTES = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  console.log("🚨 === send-email-otp ===");

  try {
    const body: OTPRequestBody = await request.json();
    const { email, name } = body;

    if (!email || !name) {
      return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters long" }, { status: 400 });
    }

    if (!process.env.BREVO_API_KEY) {
      console.error("❌ Missing BREVO_API_KEY in environment variables");
      return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
    }

    const OTP_CODE = generateOTP();
    console.log("🔐 Generated OTP for:", email);

    const timestamp = Date.now();
    const otpHash = Buffer.from(`${email.toLowerCase()}:${OTP_CODE}:${timestamp}`).toString("base64");
    const expiresAt = timestamp + OTP_EXPIRY_MINUTES * 60 * 1000;

    await sendEmailWithBrevo(email, name.trim(), OTP_CODE);

    console.log("✅ Email sent successfully");
    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      otpHash,
      expiresAt,
    });
  } catch (error: unknown) {
    console.error("❌ Email OTP error:", error);
    
    // Proper error handling without 'any'
    let errorMessage = "Failed to send email. Please try again.";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

function generateOTP(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return ((array[0] % 900000) + 100000).toString();
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailWithBrevo(email: string, name: string, otp: string): Promise<void> {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  try {
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!);

    console.log("📤 Sending email to:", email);

    await apiInstance.sendTransacEmail({
      subject: `Your FurSureCare Verification Code: ${otp}`,
      sender: {
        name: "FURSURE",
        email: "lextermilo@gmail.com", // must be verified sender sa Brevo
      },
      to: [{ email, name }],
      htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#20c997;padding:30px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:28px;">🐾 FurSureCare</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#333;margin:0 0 20px 0;">Hi ${name}!</h2>
              <p style="color:#666;font-size:16px;margin:0 0 20px 0;">Your verification code is:</p>
              <div style="background:#F3F4F6;border:2px dashed #20c997;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
                <span style="font-size:36px;font-weight:bold;color:#20c997;letter-spacing:8px;">${otp}</span>
              </div>
              <p style="color:#666;font-size:14px;margin:20px 0 0 0;">This code expires in <strong>10 minutes</strong>. Don't share it with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:20px 30px;text-align:center;">
              <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} FurSureCare Veterinary Clinic</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    });

    console.log("✅ Brevo email sent successfully to:", email);
  } catch (err: unknown) {
    // Proper error typing without 'any'
    const brevoError = err as BrevoError;
    console.error("❌ Brevo send error:", brevoError?.response?.body || brevoError?.message || err);
    throw err;
  }
}