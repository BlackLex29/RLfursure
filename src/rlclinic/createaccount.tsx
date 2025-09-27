'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import Link from 'next/link';
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
  signOut,
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
  * {
    box-sizing: border-box;
  }
  
  body {
    background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
    margin: 0;
    padding: 0;
    min-height: 100vh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }
`;

// Main Container Styles
const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 480px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 8px;
    background: linear-gradient(90deg, #FF9E6D, #FFD166, #4ECDC4);
  }
  
  @media (max-width: 640px) {
    padding: 30px 20px;
  }
`;

// Header Styles
const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 30px;
  cursor: pointer;
`;

const LogoImage = styled.img`
  width: 100px;
  height:100px;
  object-fit: contain;
  
  @media (max-width: 640px) {
    width: 40px;
    height: 40px;
  }
`;


const Title = styled.h2`
  color: #2D3748;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  text-align: center;
  
  @media (max-width: 640px) {
    font-size: 20px;
  }
`;

const Subtitle = styled.p`
  color: #718096;
  font-size: 14px;
  text-align: center;
  margin-bottom: 30px;
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

// Form Styles
const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  color: #2D3748;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  
  &::before {
    content: "🐾";
    margin-right: 8px;
    font-size: 12px;
  }
`;

const Input = styled.input`
  padding: 12px 16px;
  border: 2px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #4ECDC4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }
  
  &::placeholder {
    color: #A0AEC0;
  }
  
  &:invalid:not(:focus):not(:placeholder-shown) {
    border-color: #E53E3E;
  }
`;

const PasswordInputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  color: #718096;
  
  &:hover {
    color: #4A5568;
  }
  
  &:focus {
    outline: none;
    color: #4ECDC4;
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

// Button Styles
const Button = styled.button`
  background: #4ECDC4;
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: #3BB5AD;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  color: #4ECDC4;
  border: 2px solid #4ECDC4;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: #4ECDC4;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
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
  gap: 10px;
  background: white;
  color: #374151;
  border: 2px solid #E5E7EB;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  
  &:hover:not(:disabled) {
    background: #F9FAFB;
    border-color: #D1D5DB;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const GoogleIcon = styled.span`
  font-weight: bold;
  font-size: 16px;
  background: linear-gradient(45deg, #4285f4, #34a853, #fbbc05, #ea4335);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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

// Pet-themed decorative elements
const PetDecoration = styled.div`
  position: absolute;
  font-size: 20px;
  z-index: 0;
  opacity: 0.1;
  
  &:nth-child(1) {
    top: 20px;
    right: 20px;
    transform: rotate(15deg);
  }
  
  &:nth-child(2) {
    bottom: 20px;
    left: 20px;
    transform: rotate(-15deg);
  }
`;

// Main Component
export const Createaccount = () => {
  const router = useRouter();
  
  // State Management
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
  const otpRef = useRef<string>("");
  const otpEmailRef = useRef<string>("");
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
  const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const verifyOTP = (enteredOtp: string, expectedOtp: string): boolean => {
    return enteredOtp === expectedOtp;
  };

  const sanitizeInput = (input: string): string => {
    return input.trim();
  };

  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email.toLowerCase());
  };

  // Send OTP Email Function via API Route
// Ultra-safe version with no type errors
const sendOTPEmail = async (email: string, name: string): Promise<{ success: boolean; otp?: string }> => {
  try {
    console.log('🔄 Sending OTP to:', email);
    
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email: email.toLowerCase(), 
        name: sanitizeInput(name) 
      }),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      // Very safe error message extraction
      let errorMessage = `Server error: ${response.status}`;
      
      if (responseData && typeof responseData === 'object') {
        if (typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (typeof responseData.message === 'string') {
          errorMessage = responseData.message;
        }
      }
      
      throw new Error(errorMessage);
    }

    // Check if response has otp field
    const otp = (responseData && typeof responseData === 'object' && typeof responseData.otp === 'string') 
      ? responseData.otp 
      : undefined;

    return { 
      success: true, 
      otp: otp 
    };
    
  } catch (error) {
    console.error('❌ OTP Send Error:', error);
    
    // Handle any type of error safely
    if (error instanceof Error) {
      throw error; // Just re-throw the original error
    }
    
    // Handle non-Error objects
    if (typeof error === 'string') {
      throw new Error(error);
    }
    
    throw new Error('Failed to send OTP. Please try again.');
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
    const otpCode = generateOTP();
    
    otpRef.current = otpCode;
    otpEmailRef.current = formData.email.toLowerCase();
    
    await sendOTPEmail(
      formData.email, 
      otpCode, 
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
    const otpCode = generateOTP();
    
    otpRef.current = otpCode;
    
    await sendOTPEmail(
      formData.email, 
      otpCode, 
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
      const storedOtp = otpRef.current;
      const storedEmail = otpEmailRef.current;
      
      if (!storedOtp || storedEmail !== formData.email.toLowerCase()) {
        setError("OTP expired or invalid. Please request a new one.");
        return;
      }
      
      const isValid = verifyOTP(otp, storedOtp);
      
      if (!isValid) {
        setError("Invalid OTP. Please check and try again.");
        return;
      }
      
      console.log('Creating user with email and password...');
      
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
    otpRef.current = "";
    otpEmailRef.current = "";
    cleanup();
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

  // Google Sign Up Handler
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
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        const displayName = user.displayName || "";
        const nameParts = displayName.split(" ");
        const firstname = nameParts[0] || "";
        const lastname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        
        await setDoc(doc(db, "users", user.uid), {
          firstname: sanitizeInput(firstname),
          lastname: sanitizeInput(lastname),
          name: sanitizeInput(displayName),
          email: user.email?.toLowerCase() || "",
          phone: "",
          role: "user",
          createdAt: new Date().toISOString(),
          provider: "google",
          lastLogin: new Date().toISOString(),
          emailVerified: user.emailVerified || false,
        });
        
        setSuccess("✅ Account created successfully with Google! Redirecting to login...");
      } else {
        setSuccess("✅ Account already exists. Redirecting to login...");
      }
      
      setTimeout(async () => {
        try {
          await signOut(auth);
          router.push("/login");
        } catch (signOutError) {
          console.error("Error signing out:", signOutError);
          router.push("/login");
        }
      }, 2000);

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

  const handleLoginRedirect = (): void => {
    router.push("/login");
  };

  // Don't render until client-side
  if (!isClient) {
    return null;
  }

  // Render
  return (
    <>
      <GlobalStyle />
      <Container>
        <Card>
          <PetDecoration>🐕</PetDecoration>
          <PetDecoration>🐈</PetDecoration>
          
          {/* Logo Section with Image */}
          <Link href="/" passHref>
            <LogoContainer>
             <LogoImage 
              src="https://scontent.fmnl13-4.fna.fbcdn.net/v/t39.30808-6/308051699_1043145306431767_6902051210877649285_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeH7C3PaObQLeqOOxA3pTYw1U6XSiAPBS_lTpdKIA8FL-aWJ6pOqX-tCsYAmdUOHVzzxg-T9gjpVH_1PkEO0urYZ&_nc_ohc=c0pRYSw4KrsQ7kNvwHE5hTL&_nc_oc=AdnvMYaefSnLD_BwDZly3HzWrlUVGkQ679uNFhrON8Jd2UeyPFELDF-ZgFiqTpl5QFA&_nc_zt=23&_nc_ht=scontent.fmnl13-4.fna&_nc_gid=GOsLrMoCfHtNYu3UarKtXQ&oh=00_AfYkkXSbQmUWBw5G7PQZzCYGBVqYBsWLo3ZYe87ifPKIyA&oe=68D30859" 
              alt="FurSureCare Logo" 
  onError={(e) => {
    // Fallback if image fails to load
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
  }}
/>
            </LogoContainer>
          </Link>
          
          <Title>Create Account</Title>
          <Subtitle>Join our pet-loving community</Subtitle>
          
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
                <VerificationTitle>Verify Your Email</VerificationTitle>
                <VerificationText>
                  We&apos;ve sent a 6-digit verification code to your email address.
                  Please enter it below to complete your registration.
                </VerificationText>
                
                {/* Development OTP Display - Remove in production */}
                {process.env.NODE_ENV === 'development' && otpRef.current && (
                  <div style={{
                    background: '#fff3cd', 
                    border: '1px solid #ffc107', 
                    borderRadius: '8px', 
                    padding: '15px', 
                    margin: '15px 0', 
                    textAlign: 'center'
                  }}>
                    <strong style={{color: '#856404'}}>
                      Development Mode - OTP: {otpRef.current}
                    </strong>
                  </div>
                )}
                
                <VerificationEmail>
                  📧 {formData.email}
                </VerificationEmail>
                
                <Form onSubmit={handleVerifyOTP}>
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
                  <GoogleIcon>G</GoogleIcon>
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
          </Card>
        </Container>
      </>
    );
  };
  
  export default Createaccount;