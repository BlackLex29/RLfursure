import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { amount, description } = await request.json();

    if (!amount || amount < 1) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum ₱1" },
        { status: 400 }
      );
    }

    // 👇 manual payment reference
    const reference_number = `MANUAL-${Date.now()}`;

    return NextResponse.json({
      success: true,
      method: "manual_qr",
      qr_image: "/Gcashqrcode.jpg",  // <--- ilagay mo file mo sa /public/qrph.png
      reference_number,
      amount,
      description,
      message: "Please scan the QR and upload proof of payment."
    });

  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: err },
      { status: 500 }
    );
  }
}
