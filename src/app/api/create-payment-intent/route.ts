import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
    
    if (!PAYMONGO_SECRET_KEY) {
      console.error('PayMongo secret key not configured');
      return NextResponse.json(
        { error: 'Payment service configuration error' },
        { status: 500 }
      );
    }

    const { amount, description, payment_method_type, return_url, reference_number } = await request.json();

    // Input validation
    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Invalid amount. Minimum amount is ₱1.00' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Determine payment method types
    let paymentMethodTypes = ['card'];
    if (payment_method_type === 'gcash') paymentMethodTypes = ['gcash'];
    if (payment_method_type === 'paymaya') paymentMethodTypes = ['paymaya'];

    // Create checkout session payload
    const checkoutPayload = {
      data: {
        attributes: {
          line_items: [
            {
              amount: Math.round(amount),
              currency: 'PHP',
              name: description.substring(0, 200),
              quantity: 1
            }
          ],
          payment_method_types: paymentMethodTypes,
          success_url: return_url,
          cancel_url: return_url.replace('success', 'cancelled'),
          description: description.substring(0, 200),
          metadata: {
            reference_number: reference_number || `REF-${Date.now()}`,
            created_at: new Date().toISOString()
          }
        }
      }
    };

    console.log('🔄 Creating PayMongo checkout session:', checkoutPayload);

    const checkoutResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutPayload)
    });

    const responseData = await checkoutResponse.json();

    if (!checkoutResponse.ok) {
      console.error('❌ PayMongo Checkout error:', responseData);
      
      return NextResponse.json(
        { 
          error: 'Failed to create payment session', 
          details: responseData.errors?.[0]?.detail || 'Unknown error' 
        },
        { status: checkoutResponse.status }
      );
    }

    console.log('✅ PayMongo checkout session created:', responseData.data.id);

    return NextResponse.json({
      success: true,
      data: {
        checkout_url: responseData.data.attributes.checkout_url,
        payment_intent_id: responseData.data.id,
        reference_number: reference_number,
        amount: amount,
        currency: 'PHP'
      }
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Remove GET method muna for simplicity
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}