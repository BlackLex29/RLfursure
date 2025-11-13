import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('appointment_id');

    if (!appointmentId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Appointment ID is required" 
        },
        { status: 400 }
      );
    }

    console.log("🔍 Checking payment status for appointment:", appointmentId);

    // Get appointment from Firebase
    const appointmentDoc = await getDoc(doc(db, "appointments", appointmentId));
    
    if (!appointmentDoc.exists()) {
      return NextResponse.json(
        { 
          success: false,
          error: "Appointment not found" 
        },
        { status: 404 }
      );
    }

    const appointmentData = appointmentDoc.data();
    
    console.log("📊 Appointment status:", appointmentData.status);

    return NextResponse.json({
      success: true,
      data: {
        status: appointmentData.status,
        paymentMethod: appointmentData.paymentMethod,
        amount: appointmentData.price
      }
    });

  } catch (err) {
    console.error("❌ Payment status check error:", err);
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}