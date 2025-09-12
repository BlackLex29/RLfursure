import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, otpCode, name } = await request.json();

    if (!email || !otpCode || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not found in environment variables');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: 'Fursureclinic <onboarding@your-domain.com>', // Replace with your domain
      to: [email],
      subject: 'Verify Your Email - Fursureclinic',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4ECDC4;">Welcome to Fursureclinic! 🐾</h2>
          <p>Hi ${name},</p>
          <p>Thank you for creating an account with us. Please use the following verification code to complete your registration:</p>
          
          <div style="background: #f0f8ff; border: 2px solid #4ECDC4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0; color: #4ECDC4; font-size: 32px; letter-spacing: 4px;">${otpCode}</h3>
          </div>
          
          <p>This code will expire in 10 minutes for security reasons.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #666; font-size: 12px;">
            This email was sent by Fursureclinic. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: data?.id });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}