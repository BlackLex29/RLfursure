import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

    if (!PAYMONGO_SECRET_KEY) {
      console.error("❌ Missing PayMongo Secret Key");
      return NextResponse.json(
        { 
          success: false,
          error: "Payment configuration error - missing secret key" 
        },
        { status: 500 }
      );
    }

    const { amount, description, reference_number } = await request.json();

    console.log("🟦 QR Payment request received:", {
      amount, 
      description, 
      reference_number
    });

    // Validate required fields
    if (!amount || amount < 1) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid amount. Minimum amount is ₱1" 
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { 
          success: false,
          error: "Description is required" 
        },
        { status: 400 }
      );
    }

    // Convert to centavos
    const amountInCentavos = Math.round(amount * 100);
    console.log(`💰 Amount conversion: ₱${amount} → ${amountInCentavos} centavos`);

    // PayMongo QR Code payload
    const payload = {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: "PHP",
          description: description.substring(0, 200),
          metadata: {
            reference_number: reference_number,
            appointment_id: reference_number
          }
        }
      }
    };

    console.log("📤 Sending to PayMongo QR API:", {
      url: "https://api.paymongo.com/v1/qr_codes",
      amount: amountInCentavos,
      reference: reference_number
    });

    // Create Basic Auth header
    const authString = Buffer.from(PAYMONGO_SECRET_KEY + ":").toString('base64');
    
    const response = await fetch("https://api.paymongo.com/v1/qr_codes", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("📥 PayMongo raw response:", responseText);

    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse PayMongo response:", parseError);
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid response from payment gateway",
          details: responseText
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error("❌ PayMongo API Error:", {
        status: response.status,
        statusText: response.statusText,
        errors: jsonData.errors
      });
      
      const errorDetail = jsonData.errors?.[0]?.detail || 
                         jsonData.error?.message || 
                         `Payment gateway error: ${response.status}`;
      
      return NextResponse.json(
        { 
          success: false,
          error: errorDetail,
          details: jsonData.errors,
          status: response.status
        },
        { status: response.status }
      );
    }

    const qrData = jsonData.data;
    
    if (!qrData) {
      console.error("❌ No data in PayMongo response:", jsonData);
      return NextResponse.json(
        { 
          success: false,
          error: "No data received from payment gateway",
          response: jsonData
        },
        { status: 500 }
      );
    }

    const qrImageUrl = qrData.attributes?.image_url;
    const qrPayload = qrData.attributes?.payload;

    if (!qrImageUrl) {
      console.error("❌ No QR image URL in response:", qrData);
      return NextResponse.json(
        { 
          success: false,
          error: "No QR code image received from payment gateway",
          data: qrData
        },
        { status: 500 }
      );
    }

    console.log("✅ QR Code successfully created:", {
      qrImageUrl: qrImageUrl.substring(0, 100) + "...",
      reference_number,
      amount: amount
    });

    return NextResponse.json({
      success: true,
      data: {
        qr_image_url: qrImageUrl,
        qr_payload: qrPayload,
        reference_number: reference_number,
        amount: amount,
        amount_in_centavos: amountInCentavos
      }
    });

  } catch (err) {
    console.error("❌ QR PAYMENT ERROR:", err);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}