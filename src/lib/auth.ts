import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const auth = betterAuth({
  baseURL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  
  // Remove adapter - newer versions handle this automatically
  
  emailAndPassword: { 
    enabled: true,
    requireEmailVerification: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh every 24h
  },

  trustedOrigins: ["http://localhost:3000"],

  // Updated email verification structure
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => { // Note: 'user' and 'url' parameters
      try {
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: user.email,
          subject: "Verify your email address",
          html: `<a href="${url}">Verify Email</a>`,
        });
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    },
  },

  plugins: [
    twoFactor({
      otpOptions: {
        sendOTP: async ({ user, otp }) => { // Note: 'user' and 'otp' parameters
          try {
            await resend.emails.send({
              from: "onboarding@resend.dev", 
              to: user.email,
              subject: "Your verification code",
              html: `<p>Your OTP code is <b>${otp}</b></p>`,
            });
          } catch (err) {
            console.error("Failed to send OTP email:", err);
          }
        },
      },
    }),
  ],
});