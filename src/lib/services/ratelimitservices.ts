import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from  '@/firebaseConfig';

export interface RateLimitStatus {
  attempts: number;
  attemptsRemaining: number;
  isBlocked: boolean;
  blockUntil: number | null;
  blockCount: number;
}

// Fixed block duration - always 15 minutes
const calculateBlockDuration = (): number => {
  return 15 * 60 * 1000; // Always 15 minutes
};

export const checkRateLimit = async (email: string): Promise<RateLimitStatus> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitRef = doc(db, 'rateLimits', normalizedEmail);
    const now = Date.now();
    const maxAttempts = 5;

    const docSnap = await getDoc(rateLimitRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const blockCount = data.blockCount || 0;
      
      // Reset if block time has passed and account was blocked
      if (data.isBlocked && data.blockUntil && (now > data.blockUntil)) {
        await setDoc(rateLimitRef, {
          attempts: 0,
          lastAttempt: serverTimestamp(),
          isBlocked: false,
          blockUntil: null,
          blockCount: 0, // Reset block count since we're using fixed duration
          email: normalizedEmail
        });
        return {
          attempts: 0,
          attemptsRemaining: maxAttempts,
          isBlocked: false,
          blockUntil: null,
          blockCount: 0
        };
      }

      // If still blocked
      if (data.isBlocked && data.blockUntil) {
        return {
          attempts: data.attempts,
          attemptsRemaining: 0,
          isBlocked: true,
          blockUntil: data.blockUntil,
          blockCount
        };
      }

      return {
        attempts: data.attempts,
        attemptsRemaining: Math.max(0, maxAttempts - data.attempts),
        isBlocked: false,
        blockUntil: null,
        blockCount
      };
    } else {
      // No record exists
      return {
        attempts: 0,
        attemptsRemaining: maxAttempts,
        isBlocked: false,
        blockUntil: null,
        blockCount: 0
      };
    }
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return {
      attempts: 0,
      attemptsRemaining: 5,
      isBlocked: false,
      blockUntil: null,
      blockCount: 0
    };
  }
};

export const trackFailedLogin = async (email: string): Promise<RateLimitStatus> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitRef = doc(db, 'rateLimits', normalizedEmail);
    const now = Date.now();
    const maxAttempts = 5;

    // Use transaction to prevent race conditions
    return await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(rateLimitRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const blockCount = data.blockCount || 0;
        
        // Check if currently blocked
        if (data.isBlocked && data.blockUntil && now < data.blockUntil) {
          return {
            attempts: data.attempts,
            attemptsRemaining: 0,
            isBlocked: true,
            blockUntil: data.blockUntil,
            blockCount
          };
        }
        
        // Reset if block time has passed
        if (data.isBlocked && data.blockUntil && now >= data.blockUntil) {
          const newAttempts = 1; // Start fresh
          transaction.set(rateLimitRef, {
            attempts: newAttempts,
            lastAttempt: serverTimestamp(),
            isBlocked: false,
            blockUntil: null,
            blockCount: 0, // Reset block count
            email: normalizedEmail
          });
          
          return {
            attempts: newAttempts,
            attemptsRemaining: maxAttempts - newAttempts,
            isBlocked: false,
            blockUntil: null,
            blockCount: 0
          };
        }
        
        // Increment attempts for non-blocked account
        const newAttempts = data.attempts + 1;
        const isNowBlocked = newAttempts >= maxAttempts;
        // Always use 15 minutes block duration, don't increment blockCount for duration calculation
        const newBlockUntil = isNowBlocked ? now + calculateBlockDuration() : null;
        const newBlockCount = isNowBlocked ? blockCount + 1 : blockCount;
        
        transaction.update(rateLimitRef, {
          attempts: newAttempts,
          lastAttempt: serverTimestamp(),
          isBlocked: isNowBlocked,
          blockUntil: newBlockUntil,
          blockCount: newBlockCount
        });

        return {
          attempts: newAttempts,
          attemptsRemaining: Math.max(0, maxAttempts - newAttempts),
          isBlocked: isNowBlocked,
          blockUntil: newBlockUntil,
          blockCount: newBlockCount
        };
      } else {
        // First attempt
        transaction.set(rateLimitRef, {
          attempts: 1,
          lastAttempt: serverTimestamp(),
          isBlocked: false,
          blockUntil: null,
          blockCount: 0,
          email: normalizedEmail
        });

        return {
          attempts: 1,
          attemptsRemaining: maxAttempts - 1,
          isBlocked: false,
          blockUntil: null,
          blockCount: 0
        };
      }
    });
  } catch (error) {
    console.error('Error tracking failed login:', error);
    return {
      attempts: 0,
      attemptsRemaining: 5,
      isBlocked: false,
      blockUntil: null,
      blockCount: 0
    };
  }
};

export const resetFailedAttempts = async (email: string): Promise<void> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitRef = doc(db, 'rateLimits', normalizedEmail);
    
    await setDoc(rateLimitRef, {
      attempts: 0,
      lastAttempt: serverTimestamp(),
      isBlocked: false,
      blockUntil: null,
      blockCount: 0,
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Error resetting failed attempts:', error);
  }
};