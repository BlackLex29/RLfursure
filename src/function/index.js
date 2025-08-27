import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// Gmail credentials (gamitin mo Gmail na naka-allow sa "App Passwords")
const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: "yourgmail@gmail.com", // palitan ng Gmail mo
    pass: "your-app-password",   // dapat App Password, hindi normal Gmail pass
  },
});

// Temporary storage for OTPs (pang demo lang, mas ok kung Firestore)
let otpStore = {};

// Function to send OTP
exports.sendOtp = functions.https.onCall(async (data) => {
  const email = data.email;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Email required");
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  const mailOptions = {
    from: "yourgmail@gmail.com",
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent to email" };
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw new functions.https.HttpsError("unknown", "Failed to send OTP");
  }
});

// Function to verify OTP
exports.verifyOtp = functions.https.onCall((data) => {
  const { email, otp } = data;
  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // one-time use lang
    return { success: true, message: "OTP verified" };
  } else {
    throw new functions.https.HttpsError("invalid-argument", "Invalid OTP");
  }
});