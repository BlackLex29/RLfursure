// File: src/app/api/send-otp/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, phone } = await request.json();

    // Validate input
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone number is required' },
        { status: 400 }
      );
    }

    // Generate OTP (6-digit random number)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // TODO: Implement your OTP sending logic here
    console.log(`Generated OTP for ${email || phone}: ${otp}`);

    // For development purposes only
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          message: 'OTP sent successfully',
          otp: otp
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'OTP sent successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}