// app/api/send-password-reset/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Your clinic's email configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@rlclinic.com';
const SENDER_NAME = 'RL Clinic - Fursure Care';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Generate a temporary reset token (you can also use Firebase's token)
    const resetToken = generateResetToken();
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // HTML Email Template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f7fa;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  
                  <!-- Header with Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                        🔑 Password Reset Request
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #2c3e50;">
                        Hi <strong>${name || 'there'}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #2c3e50;">
                        We received a request to reset your password for your <strong>RL Clinic - Fursure Care</strong> account.
                      </p>
                      
                      <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #2c3e50;">
                        Click the button below to reset your password:
                      </p>
                      
                      <!-- Reset Button -->
                      <table role="presentation" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 8px; background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);">
                            <a href="${resetLink}" 
                               style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 30px 0 20px 0; font-size: 14px; line-height: 1.6; color: #6c757d;">
                        Or copy and paste this link into your browser:
                      </p>
                      
                      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #4ECDC4; word-break: break-all;">
                        <a href="${resetLink}" style="color: #4ECDC4; text-decoration: none; font-size: 14px;">
                          ${resetLink}
                        </a>
                      </div>
                      
                      <!-- Security Notice -->
                      <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 6px;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #856404;">
                          <strong>⚠️ Security Notice:</strong><br>
                          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6c757d;">
                        <strong>RL Clinic - Fursure Care</strong>
                      </p>
                      <p style="margin: 0 0 10px 0; font-size: 13px; color: #6c757d;">
                        Ensuring your pet's health and happiness
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #adb5bd;">
                        This is an automated message, please do not reply to this email.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Plain text version
    const textContent = `
Hi ${name || 'there'},

We received a request to reset your password for your RL Clinic - Fursure Care account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

---
RL Clinic - Fursure Care
Ensuring your pet's health and happiness

This is an automated message, please do not reply to this email.
    `;

    // Send email via Brevo
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: email,
            name: name || email,
          },
        ],
        subject: 'Reset Your Password - RL Clinic',
        htmlContent: htmlContent,
        textContent: textContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      messageId: data.messageId,
      message: 'Password reset email sent successfully',
    });

  } catch (error) {
    console.error('Error sending password reset email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Generate a random reset token
function generateResetToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}