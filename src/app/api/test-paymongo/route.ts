import { NextResponse } from "next/server";

export async function GET() {
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

    console.log("🔑 Testing PayMongo key...");
    console.log("Key exists:", !!PAYMONGO_SECRET_KEY);
    console.log("Key starts with:", PAYMONGO_SECRET_KEY?.substring(0, 8));

    if (!PAYMONGO_SECRET_KEY) {
      return NextResponse.json({
        success: false,
        error: "No PayMongo secret key found"
      });
    }

    // Test authentication with PayMongo
    const authString = Buffer.from(PAYMONGO_SECRET_KEY + ":").toString('base64');
    
    const response = await fetch("https://api.paymongo.com/v1/merchants", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Accept": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      merchant_test: response.ok ? "Keys are working!" : "Keys are invalid",
      error: data.errors?.[0]?.detail
    });

  } catch (err) {
    console.error("Test error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}