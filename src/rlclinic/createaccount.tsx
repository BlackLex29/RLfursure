'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  GoogleAuthProvider, 
  AuthError,
  updateProfile
} from "firebase/auth";
import { db, auth } from "../firebaseConfig";
// Constants
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PHONE_REGEX = /^09\d{9}$/;
const OTP_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Type definitions
interface FormData {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface PasswordErrors {
  hasMinLength: string;
  hasUpperCase: string;
  hasLowerCase: string;
  hasNumber: string;
  hasSpecialChar: string;
}

// Type guard for AuthError
function isAuthError(error: unknown): error is AuthError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// Global Styles
const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f5f7fa;
    min-height: 100vh;
    overflow-x: hidden;
  }
  
  * {
    box-sizing: border-box;
  }
`;

// Main Container Styles
const Container = styled.div`
  min-height: 100vh;
  display: flex;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const LeftPanel = styled.div`
  flex: 1;
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.9) 0%, rgba(68, 160, 141, 0.9) 100%);
  padding: 3rem;
  display: flex;
  flex-direction: column;
  position: relative;
  color: white;
  overflow: hidden;
  
  @media (max-width: 768px) {
    padding: 2rem;
    min-height: 40vh;
  }
`;

const PetBackground = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const PanelOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.85) 0%, rgba(68, 160, 141, 0.85) 100%);
  z-index: 1;
`;

const CenteredLogoSection = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  gap: 1.5rem;
`;

const LogoImage = styled.img`
  width: 350px;
  height: 350px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    width: 120px;
    height: 120px;
  }
`;

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ClinicName = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const ClinicSubtitle = styled.p`
  font-size: 1.1rem;
  margin: 0;
  opacity: 0.9;
  font-weight: 400;
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: white;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const FormHeader = styled.div`
  text-align: center;
  margin-bottom: 0.5rem;
`;

const FormTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
`;

const FormSubtitle = styled.p`
  color: #666;
  margin: 0;
  font-size: 1rem;
`;

// Form Styles
const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  
  &::before {
    content: "🐾";
    margin-right: 8px;
    font-size: 12px;
  }
`;

const Input = styled.input`
  padding: 0.875rem 1rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
  width: 100%;
  height: 48px;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }
  
  &:disabled {
    background-color: #f8f9fa;
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  &::placeholder {
    color: #999;
  }
`;

const PasswordInputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 1.1rem;
  z-index: 2;
  
  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const ErrorText = styled.span`
  color: #E53E3E;
  font-size: 12px;
  margin-top: 4px;
`;

// Password Rules Styles
const PasswordRules = styled.div`
  background: #F7FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
`;

const RuleText = styled.p`
  color: #2D3748;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
`;

const RuleItem = styled.p<{ valid: string }>`
  color: ${props => props.valid === 'true' ? '#38A169' : '#718096'};
  font-size: 11px;
  margin: 2px 0;
  
  &::before {
    content: ${props => props.valid === 'true' ? '"✓"' : '"•"'};
    margin-right: 4px;
    font-weight: bold;
  }
`;

// Checkbox Styles
const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 10px 0;
`;

const Checkbox = styled.input`
  margin-right: 8px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  color: #4A5568;
  font-size: 14px;
  cursor: pointer;
`;

// Message Styles
const ErrorMessage = styled.div`
  background: #FED7D7;
  color: #C53030;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  word-wrap: break-word;
`;

const SuccessMessage = styled.div`
  background: #C6F6D5;
  color: #2D7843;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  word-wrap: break-word;
`;

const InfoMessage = styled.div`
  background: #BEE3F8;
  color: #2C5282;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  word-wrap: break-word;
`;

// Button Styles
const Button = styled.button`
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  color: #4ECDC4;
  border: 2px solid #4ECDC4;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: #4ECDC4;
    color: white;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const GoogleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  background: white;
  color: #333;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  
  &:hover:not(:disabled) {
    border-color: #4ecdc4;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const GoogleIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Divider Styles
const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 25px 0;
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: #E2E8F0;
`;

const DividerText = styled.span`
  color: #718096;
  font-size: 12px;
  padding: 0 15px;
`;

// OTP Verification Styles
const OTPVerificationCard = styled.div`
  background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
  border: 2px solid #4ECDC4;
  border-radius: 16px;
  padding: 30px;
  margin: 20px 0;
  text-align: center;
  box-shadow: 0 8px 25px rgba(78, 205, 196, 0.15);
`;

const VerificationTitle = styled.h3`
  color: #4ECDC4;
  margin-bottom: 15px;
  font-size: 24px;
  font-weight: 700;
  
  @media (max-width: 640px) {
    font-size: 20px;
  }
`;

const VerificationText = styled.p`
  color: #4a5568;
  margin-bottom: 15px;
  line-height: 1.6;
  font-size: 16px;
  
  @media (max-width: 640px) {
    font-size: 14px;
  }
`;

const VerificationEmail = styled.div`
  background: rgba(78, 205, 196, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin: 15px 0;
  font-weight: 600;
  color: #4ECDC4;
  word-break: break-all;
  font-size: 14px;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 25px 0;
`;

const ResendText = styled.p`
  color: #4a5568;
  font-size: 14px;
  margin-top: 15px;
`;

const ResendLink = styled.span`
  color: #4ECDC4;
  cursor: pointer;
  font-weight: 600;
  
  &:hover {
    text-decoration: underline;
  }
`;

// Footer Styles
const LoginRedirect = styled.p`
  color: #718096;
  font-size: 14px;
  text-align: center;
  margin-top: 30px;
`;

const LoginLink = styled.span`
  color: #4ECDC4;
  cursor: pointer;
  font-weight: 600;
  
  &:hover {
    text-decoration: underline;
  }
`;

// Main Component
export const Createaccount = () => {
  const router = useRouter();
  
  // State Management
  const [otpHash, setOtpHash] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>("");
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [phoneError, setPhoneError] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPasswordRules, setShowPasswordRules] = useState<boolean>(false);
  
  // Refs for OTP storage
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Form Data
  const [formData, setFormData] = useState<FormData>({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  
  // Password Validation State
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({
    hasMinLength: "false",
    hasUpperCase: "false",
    hasLowerCase: "false",
    hasNumber: "false",
    hasSpecialChar: "false"
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  // Effects
  useEffect(() => {
    setIsClient(true);
    
    return cleanup;
  }, [cleanup]);

  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
    }
    
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [resendCooldown]);

  // Utility Functions
  const sanitizeInput = (input: string): string => {
    return input.trim();
  };

  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email.toLowerCase());
  };

  // Send Email OTP Function via API Route
const sendEmailOTP = async (email: string, name: string): Promise<{ success: boolean, otpHash?: string }> => {
  try {
    const response = await fetch('/api/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.toLowerCase(),
        name: sanitizeInput(name)
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.error || `Server error: ${response.status}`);
    }

    if (responseData?.success) {
      setInfo(`Verification OTP sent to ${email}. Please check your inbox and spam folder.`);
      if (responseData.otpHash) {
        setOtpHash(responseData.otpHash); // Store the otpHash
      }
      return { success: true, otpHash: responseData.otpHash };
    }
    
    throw new Error(responseData.error || 'Failed to send OTP');
  } catch (err: unknown) {
    console.error('Error sending OTP:', err);
    throw err instanceof Error ? err : new Error('Failed to send OTP');
  }
};
const verifyEmailOTP = async (email: string, otp: string): Promise<{ success: boolean }> => {
  try {
    const response = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.toLowerCase(),
        code: otp, // Rename otp to code
        otpHash // Send the stored otpHash
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.error || 'Verification failed');
    }

    return { success: responseData.success };
  } catch (err: unknown) {
    console.error('Error verifying OTP:', err);
    throw err instanceof Error ? err : new Error('Failed to verify OTP');
  }
};
  // Database Functions
  const checkPhoneNumberExists = async (phone: string): Promise<boolean> => {
    try {
      if (!phone || phone.length !== 11) return false;
      
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phone", "==", phone));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (err) {
      console.error("Error checking phone number:", err);
      return false;
    }
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      if (!email) return false;
      
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (err) {
      console.error("Error checking email:", err);
      return false;
    }
  };

  const completeAccountCreation = useCallback(async (userData: {
    uid: string;
    email: string;
    firstname: string;
    lastname: string;
    phone: string;
  }) => {
    try {
      console.log('Creating user document in Firestore...');
      
      const userDocData = {
        firstname: sanitizeInput(userData.firstname),
        lastname: sanitizeInput(userData.lastname),
        name: `${sanitizeInput(userData.firstname)} ${sanitizeInput(userData.lastname)}`,
        email: userData.email.toLowerCase(),
        phone: userData.phone,
        role: "user",
        createdAt: new Date().toISOString(),
        provider: "email",
        lastLogin: new Date().toISOString(),
        emailVerified: true,
      };
      
      await setDoc(doc(db, "users", userData.uid), userDocData);
      
      console.log('Account creation completed successfully');
      
      setSuccess("✅ Account created successfully! Redirecting to login...");
      setError("");
      setInfo("");
      setOtpSent(false);
      
      // Clear form data for security
      setFormData({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      });
      
      setTimeout(() => {
        router.push("/login");
      }, 2000);
      
    } catch (err) {
      console.error("Error completing account creation:", err);
      setError("Failed to complete account creation. Please try again.");
    }
  }, [router]);

  // Validation Functions
  const validatePassword = (password: string): boolean => {
    const errors: PasswordErrors = {
      hasMinLength: password.length >= 8 ? "true" : "false",
      hasUpperCase: /[A-Z]/.test(password) ? "true" : "false",
      hasLowerCase: /[a-z]/.test(password) ? "true" : "false",
      hasNumber: /\d/.test(password) ? "true" : "false",
      hasSpecialChar: /[@$!%*?&]/.test(password) ? "true" : "false"
    };
    
    setPasswordErrors(errors);
    return PASSWORD_REGEX.test(password);
  };

  const validatePhone = async (phone: string): Promise<boolean> => {
    const cleanedPhone = phone.replace(/\D/g, '');
    
    if (cleanedPhone.length > 0 && cleanedPhone.length !== 11) {
      setPhoneError("Phone number must be exactly 11 digits");
      return false;
    } else if (cleanedPhone.length === 11 && !cleanedPhone.startsWith('09')) {
      setPhoneError("Philippine numbers must start with 09");
      return false;
    } else if (cleanedPhone.length === 11) {
      try {
        const phoneExists = await checkPhoneNumberExists(cleanedPhone);
        if (phoneExists) {
          setPhoneError("This phone number is already registered");
          return false;
        }
      } catch {
        setPhoneError("Unable to verify phone number. Please try again.");
        return false;
      }
    }
    
    setPhoneError("");
    return PHONE_REGEX.test(cleanedPhone);
  };

  // OTP Handler Functions
  const handleSendOTP = async (): Promise<void> => {
  setError("");
  setInfo("");
  setLoading(true);
  
  try {
    const emailExists = await checkEmailExists(formData.email);
    if (emailExists) {
      setError("This email is already registered. Please sign in instead.");
      return;
    }

    const result = await sendEmailOTP(
      formData.email, 
      `${formData.firstname} ${formData.lastname}`
    );
    
    setOtpSent(true);
    setInfo(`📧 Verification OTP sent to ${formData.email}. Please check your inbox and spam folder.`);
    setResendCooldown(60);
    
  } catch (err: unknown) {
    console.error("Error sending OTP:", err);
    if (err instanceof Error) {
      setError(err.message);
    } else {
      setError("Failed to send OTP. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};

const handleResendOTP = async (): Promise<void> => {
  if (resendCooldown > 0) return;
  
  setOtpLoading(true);
  setError("");
  setInfo("");
  
  try {
    const result = await sendEmailOTP(
      formData.email, 
      `${formData.firstname} ${formData.lastname}`
    );
    
    setInfo("📧 OTP resent successfully! Please check your inbox and spam folder.");
    setResendCooldown(60);
  } catch (err: unknown) {
    console.error("Resend OTP error:", err);
    if (err instanceof Error) {
      setError(err.message);
    } else {
      setError("Failed to resend OTP. Please try again.");
    }
  } finally {
    setOtpLoading(false);
  }
};

  const handleVerifyOTP = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setInfo("");
    setOtpLoading(true);
    
    try {
      // Verify OTP using API
      const verificationResult = await verifyEmailOTP(formData.email, otp);
      
      if (!verificationResult.success) {
        setError("Invalid OTP. Please check and try again.");
        return;
      }
      
      console.log('✅ OTP verified, creating user...');
      
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email.toLowerCase(), 
        formData.password
      );
      
      const user = userCredential.user;
      console.log('User created:', user.uid);
      
      await updateProfile(user, {
        displayName: `${sanitizeInput(formData.firstname)} ${sanitizeInput(formData.lastname)}`
      });
      
      await completeAccountCreation({
        uid: user.uid,
        email: formData.email.toLowerCase(),
        firstname: formData.firstname,
        lastname: formData.lastname,
        phone: formData.phone
      });
      
    } catch (err: unknown) {
      console.error("OTP verification error:", err);
      
      if (isAuthError(err)) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError("This email is already registered. Please sign in instead.");
            break;
          case 'auth/invalid-email':
            setError("Invalid email address format.");
            break;
          case 'auth/weak-password':
            setError("Password is too weak. Please choose a stronger password.");
            break;
          case 'auth/network-request-failed':
            setError("Network error. Please check your internet connection.");
            break;
          default:
            setError(err.message || "Failed to create account. Please try again.");
        }
      } else if (err instanceof Error) {
        setError(err.message || "Failed to create account. Please try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };  

  const handleCancelOTP = (): void => {
    setOtpSent(false);
    setOtp("");
    setError("");
    setInfo("");
    cleanup();
  };

  // Google Sign Up with OTP Handler
  const handleGoogleSignUp = async (): Promise<void> => {
    setError("");
    setSuccess("");
    setInfo("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      console.log('Google sign up successful:', user.uid);
      
      // Check if user already exists
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        setSuccess("✅ Account already exists. Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
        return;
      }

      // Send OTP for Google sign-up
      const displayName = user.displayName || "";
      const nameParts = displayName.split(" ");
      const firstname = nameParts[0] || "";
      const lastname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      await sendEmailOTP(user.email || "", displayName);
      
      // Store Google user data temporarily for OTP verification
      localStorage.setItem('googleUserData', JSON.stringify({
        uid: user.uid,
        email: user.email,
        firstname,
        lastname,
        displayName
      }));

      setOtpSent(true);
      setInfo(`📧 Verification OTP sent to ${user.email}. Please check your inbox and spam folder.`);
      setResendCooldown(60);
      
    } catch (err: unknown) {
      console.error("Google sign up error:", err);
      
      if (isAuthError(err)) {
        switch (err.code) {
          case 'auth/popup-closed-by-user':
            setError("Google sign up was cancelled");
            break;
          case 'auth/account-exists-with-different-credential':
            setError("An account already exists with this email. Please sign in with your existing method.");
            break;
          case 'auth/popup-blocked':
            setError("Popup was blocked. Please allow popups for this site.");
            break;
          case 'auth/network-request-failed':
            setError("Network error. Please check your internet connection.");
            break;
          default:
            setError(err.message || "Failed to sign up with Google");
        }
      } else if (err instanceof Error) {
        setError(err.message || "Failed to sign up with Google");
      } else {
        setError("An unexpected error occurred during Google sign up");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OTP Verification
  const handleGoogleOTPVerification = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setInfo("");
    setOtpLoading(true);
    
    try {
      const googleUserDataStr = localStorage.getItem('googleUserData');
      if (!googleUserDataStr) {
        setError("Google sign-up session expired. Please try again.");
        return;
      }

      const googleUserData = JSON.parse(googleUserDataStr);
      
      // Verify OTP using API
      const verificationResult = await verifyEmailOTP(googleUserData.email, otp);
      
      if (!verificationResult.success) {
        setError("Invalid OTP. Please check and try again.");
        return;
      }
      
      console.log('✅ OTP verified, creating Google user...');
      
      // Create user document in Firestore
      await setDoc(doc(db, "users", googleUserData.uid), {
        firstname: sanitizeInput(googleUserData.firstname),
        lastname: sanitizeInput(googleUserData.lastname),
        name: sanitizeInput(googleUserData.displayName),
        email: googleUserData.email.toLowerCase(),
        phone: "",
        role: "user",
        createdAt: new Date().toISOString(),
        provider: "google",
        lastLogin: new Date().toISOString(),
        emailVerified: true,
      });
      
      console.log('Google account creation completed successfully');
      
      // Clean up
      localStorage.removeItem('googleUserData');
      
      setSuccess("✅ Account created successfully with Google! Redirecting to login...");
      setError("");
      setInfo("");
      setOtpSent(false);
      
      setTimeout(() => {
        router.push("/login");
      }, 2000);
      
    } catch (err: unknown) {
      console.error("Google OTP verification error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to verify OTP. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Input Handler Functions
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const cleanedValue = value.replace(/\D/g, '').slice(0, 11);
      setFormData(prev => ({
        ...prev,
        [name]: cleanedValue
      }));
      
      if (cleanedValue.length === 11) {
        // Debounce phone validation
        setTimeout(() => validatePhone(cleanedValue), 500);
      } else {
        setPhoneError("");
      }
    } else if (name === 'email') {
      const cleanedValue = value.toLowerCase().trim();
      setFormData(prev => ({
        ...prev,
        [name]: cleanedValue
      }));
    } else {
      const cleanedValue = name === 'firstname' || name === 'lastname' ? 
        sanitizeInput(value) : value;
      
      setFormData(prev => ({
        ...prev,
        [name]: cleanedValue
      }));
      
      if (name === 'password') {
        validatePassword(value);
        if (value.length > 0) {
          setShowPasswordRules(true);
        }
      }
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(value);
  };

  // UI Handler Functions
  const handlePasswordFocus = (): void => {
    setShowPasswordRules(true);
  };

  const handlePasswordBlur = (): void => {
    if (!PASSWORD_REGEX.test(formData.password) && formData.password.length > 0) {
      setShowPasswordRules(true);
    } else {
      setTimeout(() => setShowPasswordRules(false), 200);
    }
  };

  const togglePasswordVisibility = (e: React.MouseEvent): void => {
    e.preventDefault();
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = (e: React.MouseEvent): void => {
    e.preventDefault();
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setInfo("");
    
    // Validation
    if (!formData.firstname || !formData.lastname || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      setError("All fields are required");
      setShowPasswordRules(true);
      return;
    }
    
    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    const isValidPhone = await validatePhone(formData.phone);
    if (!isValidPhone) {
      setError("Please enter a valid Philippine phone number (11 digits starting with 09)");
      return;
    }

    try {
      const phoneExists = await checkPhoneNumberExists(formData.phone);
      if (phoneExists) {
        setError("This phone number is already registered. Please use a different number.");
        return;
      }
    } catch {
      setError("Unable to verify phone number. Please try again.");
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setShowPasswordRules(true);
      return;
    }
    
    if (!PASSWORD_REGEX.test(formData.password)) {
      setError("Password does not meet the requirements");
      setShowPasswordRules(true);
      return;
    }
    
    if (formData.firstname.length < 2 || formData.lastname.length < 2) {
      setError("First name and last name must be at least 2 characters long");
      return;
    }
    
    await handleSendOTP();
  };

  const handleLoginRedirect = (): void => {
    router.push("/login");
  };

  // Check if we're in a Google OTP flow
  const isGoogleOTPFlow = otpSent && localStorage.getItem('googleUserData');

  // Don't render until client-side
  if (!isClient) {
    return null;
  }

  // Render
  return (
    <>
      <GlobalStyle />
      <Container>
        <LeftPanel>
          <PetBackground 
            src="https://images.unsplash.com/photo-1509205477838-a534e43a849f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8ZG9nJTIwYW5kJTIwY2F0JTIwYmFja2dyb3VuZHxlbnwwfHwwfHx8MA%3D%3D" 
            alt="Dog and cat together"
          />
          <PanelOverlay />
          
          <CenteredLogoSection>
            <LogoImage 
              src="/RL.jpg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <LogoText>
              <ClinicName>FurSureCare</ClinicName>
              <ClinicSubtitle>Your Pet&apos;s Health, Our Priority</ClinicSubtitle>
            </LogoText>
          </CenteredLogoSection>
        </LeftPanel>

        <RightPanel>
          <FormContainer>
            <FormHeader>
              <FormTitle>
                {otpSent ? "Verify Your Email" : "Create Account"}
              </FormTitle>
              <FormSubtitle>
                {otpSent 
                  ? "Enter the code sent to your email" 
                  : "Join our pet-loving community"
                }
              </FormSubtitle>
            </FormHeader>

            {error && <ErrorMessage>{error}</ErrorMessage>}
            {success && <SuccessMessage>{success}</SuccessMessage>}
            {info && <InfoMessage>{info}</InfoMessage>}

            {!otpSent ? (
              <Form onSubmit={handleFormSubmit} noValidate>
                <InputGrid>
                  <InputGroup>
                    <Label htmlFor="firstname">First Name</Label>
                    <Input
                      id="firstname"
                      name="firstname"
                      type="text"
                      placeholder="Enter your first name"
                      value={formData.firstname}
                      onChange={handleInputChange}
                      minLength={2}
                      maxLength={50}
                      required
                      autoComplete="given-name"
                    />
                  </InputGroup>
                  
                  <InputGroup>
                    <Label htmlFor="lastname">Last Name</Label>
                    <Input
                      id="lastname"
                      name="lastname"
                      type="text"
                      placeholder="Enter your last name"
                      value={formData.lastname}
                      onChange={handleInputChange}
                      minLength={2}
                      maxLength={50}
                      required
                      autoComplete="family-name"
                    />
                  </InputGroup>
                </InputGrid>
                
                <InputGroup>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    autoComplete="email"
                    pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                  />
                  {formData.email && !validateEmail(formData.email) && (
                    <ErrorText>Please enter a valid email address</ErrorText>
                  )}
                </InputGroup>
                
                <InputGroup>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="09XXXXXXXXX (11 digits)"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    autoComplete="tel"
                    maxLength={11}
                  />
                  {phoneError && <ErrorText>{phoneError}</ErrorText>}
                </InputGroup>
                
                <InputGroup>
                  <Label htmlFor="password">Password</Label>
                  <PasswordInputContainer>
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onFocus={handlePasswordFocus}
                      onBlur={handlePasswordBlur}
                      required
                      autoComplete="new-password"
                    />
                    <PasswordToggle 
                      type="button" 
                      onClick={togglePasswordVisibility}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "🔓" : "🔒"}
                    </PasswordToggle>
                  </PasswordInputContainer>
                  
                  {showPasswordRules && (
                    <PasswordRules>
                      <RuleText>Password must contain:</RuleText>
                      <RuleItem valid={passwordErrors.hasMinLength}>
                        At least 8 characters
                      </RuleItem>
                      <RuleItem valid={passwordErrors.hasUpperCase}>
                        One uppercase letter
                      </RuleItem>
                      <RuleItem valid={passwordErrors.hasLowerCase}>
                        One lowercase letter
                      </RuleItem>
                      <RuleItem valid={passwordErrors.hasNumber}>
                        One number
                      </RuleItem>
                      <RuleItem valid={passwordErrors.hasSpecialChar}>
                        One special character (@$!%*?&)
                      </RuleItem>
                    </PasswordRules>
                  )}
                </InputGroup>
                
                <InputGroup>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInputContainer>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      autoComplete="new-password"
                    />
                    <PasswordToggle 
                      type="button" 
                      onClick={toggleConfirmPasswordVisibility}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? "🔓" : "🔒"}
                    </PasswordToggle>
                  </PasswordInputContainer>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <ErrorText>Passwords do not match</ErrorText>
                  )}
                </InputGroup>
                
                <CheckboxContainer>
                  <Checkbox
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <CheckboxLabel htmlFor="rememberMe">
                    Remember me on this device
                  </CheckboxLabel>
                </CheckboxContainer>
                
                <Button type="submit" disabled={loading}>
                  {loading ? "Sending OTP..." : "Create Account"}
                </Button>
              </Form>
            ) : (
              <OTPVerificationCard>
                <VerificationTitle>
                  {isGoogleOTPFlow ? "Verify Your Google Account" : "Verify Your Email"}
                </VerificationTitle>
                <VerificationText>
                  We&apos;ve sent a 6-digit verification code to your email address.
                  Please enter it below to complete your registration.
                </VerificationText>
                
                <VerificationEmail>
                  📧 {isGoogleOTPFlow ? JSON.parse(localStorage.getItem('googleUserData') || '{}').email : formData.email}
                </VerificationEmail>
                
                <Form onSubmit={isGoogleOTPFlow ? handleGoogleOTPVerification : handleVerifyOTP}>
                  <InputGroup>
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      name="otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={handleOtpChange}
                      required
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                  </InputGroup>
                  
                  <ButtonContainer>
                    <Button type="submit" disabled={otpLoading || otp.length !== 6}>
                      {otpLoading ? "Verifying..." : "Verify & Create Account"}
                    </Button>
                    <SecondaryButton 
                      type="button" 
                      onClick={handleCancelOTP}
                      disabled={otpLoading}
                    >
                      Cancel
                    </SecondaryButton>
                  </ButtonContainer>
                </Form>
                
                <ResendText>
                  Didn&apos;t receive the code?{" "}
                  {resendCooldown > 0 ? (
                    `Resend available in ${resendCooldown}s`
                  ) : (
                    <ResendLink onClick={handleResendOTP}>
                      Resend OTP
                    </ResendLink>
                  )}
                </ResendText>
              </OTPVerificationCard>
            )}
            
            {!otpSent && (
              <>
                <Divider>
                  <DividerLine />
                  <DividerText>or continue with</DividerText>
                  <DividerLine />
                </Divider>
                
                <GoogleButton 
                  type="button" 
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                >
                  <GoogleIcon>
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </GoogleIcon>
                  Sign up with Google
                </GoogleButton>
              </>
            )}
            
            <LoginRedirect>
              Already have an account?{" "}
              <LoginLink onClick={handleLoginRedirect}>
                Sign in here
              </LoginLink>
            </LoginRedirect>
          </FormContainer>
        </RightPanel>
      </Container>
    </>
  );
};

export default Createaccount;
