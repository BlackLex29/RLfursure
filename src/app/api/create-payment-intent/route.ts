import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
    
    if (!PAYMONGO_SECRET_KEY) {
      return NextResponse.json(
        { error: 'PayMongo secret key not configured' },
        { status: 500 }
      );
    }

    const { amount, description, payment_method_type, return_url } = await request.json().catch(() => ({}));

    // Determine payment method types based on selection
    let paymentMethodTypes = ['card'];
    if (payment_method_type === 'gcash') paymentMethodTypes = ['gcash'];
    if (payment_method_type === 'paymaya') paymentMethodTypes = ['paymaya'];

    // Create checkout session
    const checkoutResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                amount: amount || 10000,
                currency: 'PHP',
                name: description || 'Order Payment',
                quantity: 1
              }
            ],
            payment_method_types: paymentMethodTypes,
            success_url: `${return_url || request.nextUrl.origin}?payment_status=success`,
            cancel_url: `${return_url || request.nextUrl.origin}?payment_status=failed`,
            description: description || 'Order Payment'
          }
        }
      })
    });

    if (!checkoutResponse.ok) {
      const errorData = await checkoutResponse.json();
      console.error('PayMongo Checkout error:', errorData);
      return NextResponse.json(
        { error: 'PayMongo Checkout error', details: errorData },
        { status: checkoutResponse.status }
      );
    }

    const checkoutData = await checkoutResponse.json();
    
    // Return the checkout URL and payment intent ID
    return NextResponse.json({
      data: {
        attributes: {
          checkout_url: checkoutData.data.attributes.checkout_url,
          payment_intent_id: checkoutData.data.attributes.payment_intent_id
        }
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// New API endpoint to check payment status
export async function GET(request: NextRequest) {
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
    
    if (!PAYMONGO_SECRET_KEY) {
      return NextResponse.json(
        { error: 'PayMongo secret key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('payment_intent_id');
    
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    // Retrieve payment intent status from PayMongo
    const paymentIntentResponse = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
      },
    });

    if (!paymentIntentResponse.ok) {
      const errorData = await paymentIntentResponse.json();
      console.error('PayMongo Payment Intent error:', errorData);
      return NextResponse.json(
        { error: 'PayMongo Payment Intent error', details: errorData },
        { status: paymentIntentResponse.status }
      );
    }

    const paymentIntentData = await paymentIntentResponse.json();
    const status = paymentIntentData.data.attributes.status;
    
    return NextResponse.json({ status });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}