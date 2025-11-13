// src/app/api/process-refund/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface RefundRequest {
  amount: number;
  paymentId: string;
  reason: string;
  notes: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Processing refund request...');
    
    const body: RefundRequest = await request.json();
    const { amount, paymentId, reason, notes } = body;

    // Validate required fields
    if (!amount || !paymentId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, paymentId, and reason are required' },
        { status: 400 }
      );
    }

    const refundRequest = {
      data: {
        attributes: {
          amount: Math.round(amount * 100), // Convert to cents
          payment_id: paymentId,
          reason: reason,
          notes: notes || 'No additional notes provided'
        }
      }
    };

    console.log('PayMongo refund request:', {
      amount: refundRequest.data.attributes.amount,
      paymentId: paymentId,
      reason: reason
    });

    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    
    if (!paymongoSecretKey) {
      console.error('PayMongo secret key not configured');
      return NextResponse.json(
        { error: "PayMongo API key not configured on server" },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.paymongo.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`
      },
      body: JSON.stringify(refundRequest)
    });

    const responseText = await response.text();
    console.log('PayMongo response status:', response.status);
    console.log('PayMongo response:', responseText);

    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Error parsing PayMongo response:', parseError);
      return NextResponse.json(
        { error: `Invalid response from PayMongo: ${responseText}` },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('PayMongo API error:', responseData);
      return NextResponse.json(
        { 
          error: responseData.errors?.[0]?.detail || `PayMongo API error: ${response.status}`,
          details: responseData.errors
        },
        { status: response.status }
      );
    }

    console.log('Refund processed successfully:', responseData.data.id);
    
    return NextResponse.json({ 
      success: true, 
      refundId: responseData.data.id,
      status: responseData.data.attributes.status
    });

  } catch (error) {
    console.error('Server error processing refund:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}