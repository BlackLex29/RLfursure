// File: src/app/api/send-otp/route.js
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, name } = await request.json();

    console.log('📧 OTP Request received for:', email);
    console.log('👤 Name:', name);

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate OTP (6-digit random number)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('🔢 Generated OTP:', otp);

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log('🔑 RESEND_API_KEY not found, using development mode');
      
      return NextResponse.json(
        { 
          success: true,
          message: 'OTP generated successfully (development mode - RESEND not configured)',
          otp: otp
        },
        { status: 200 }
      );
    }

    console.log('📤 Attempting to send email via RESEND...');

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'RL Clinic <onboarding@resend.dev>', // You can verify your domain in Resend dashboard
      to: email,
      subject: 'Your OTP Code - RL Clinic',
      html: generateEmailTemplate(otp, name),
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    console.log('✅ Email sent successfully via RESEND:', data?.id);

    return NextResponse.json(
      { 
        success: true,
        message: 'OTP sent successfully',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to send OTP. Please try again.';
    
    if (error.message.includes('API key')) {
      errorMessage = 'Email service not configured properly.';
    } else if (error.message.includes('domain')) {
      errorMessage = 'Email domain not verified. Please check Resend dashboard.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Email template function
function generateEmailTemplate(otp, name = 'User') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #f4f4f4; 
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%); 
                color: white; 
                padding: 30px; 
                text-align: center; 
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
            }
            .content {
                padding: 30px;
            }
            .otp-container {
                text-align: center;
                margin: 30px 0;
            }
            .otp-code { 
                font-size: 42px; 
                font-weight: bold; 
                color: #2c3e50;
                letter-spacing: 8px;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                border: 2px dashed #4ecdc4;
                display: inline-block;
                margin: 15px 0;
            }
            .warning {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #856404;
            }
            .footer { 
                text-align: center; 
                margin-top: 30px; 
                color: #666;
                font-size: 14px;
                padding: 20px;
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
            }
            .logo {
                font-size: 20px;
                font-weight: bold;
                color: #4ecdc4;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 OTP Verification</h1>
            </div>
            <div class="content">
                <p>Hello <strong>${name}</strong>,</p>
                <p>You are attempting to verify your account with <strong>RL Clinic</strong>. Use the following OTP code to complete your verification:</p>
                
                <div class="otp-container">
                    <div class="otp-code">${otp}</div>
                </div>
                
                <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>This OTP is valid for 10 minutes only</li>
                        <li>Do not share this code with anyone</li>
                        <li>If you didn't request this, please ignore this email</li>
                    </ul>
                </div>
                
                <p>If you have any questions, please contact our support team.</p>
                
                <p>Best regards,<br><strong>RL Clinic Team</strong></p>
            </div>
            <div class="footer">
                <div class="logo">🏥 RL Clinic</div>
                <p>Fursure Care - Ensuring the best care for your pets</p>
                <p>© 2024 RL Clinic. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}