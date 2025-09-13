// lib/resend.ts
import { Resend } from "resend";

// ONLY use environment variable, no hardcoded key
export const resend = new Resend(process.env.RESEND_API_KEY);