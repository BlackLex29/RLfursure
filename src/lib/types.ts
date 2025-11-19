// src/lib/types.ts
export interface UserRole {
  role: 'veterinarian' | 'user' | 'admin';
  firstName?: string;
  lastName?: string;
  email: string;
  twoFactorEnabled?: boolean;
  failedAttempts?: number;
  lockUntil?: number;
}