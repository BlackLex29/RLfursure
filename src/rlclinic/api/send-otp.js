import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, otpCode, name } = req.body;

    if (!email || !otpCode || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'Email service not configured' });
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
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true, messageId: data?.id });

  } catch (error) {
    console.error('API route error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}