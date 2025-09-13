import { NextResponse } from "next/server";
import { resend } from "@/lib/resend"; // gamitin yung centralized resend

export async function POST(request: Request) {
  try {
    const { email, otpCode, name } = await request.json();

    if (!email || !otpCode || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: "Fursureclinic <onboarding@resend.dev>", // test domain
      to: [email],
      subject: "Your Verification Code - Fursureclinic 🐾",
      html: `
        <h2>Email Verification</h2>
        <p>Hi ${name},</p>
        <p>Your OTP is: <b>${otpCode}</b></p>
      `,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      return NextResponse.json(
        { success: false, message: "Failed to send email" },
        { status: 500 }
      );
    }

    console.log("✅ Email sent:", data?.id);
    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err) {
    console.error("❌ API error:", err);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
