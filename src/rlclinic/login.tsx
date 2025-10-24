'use client';

import React, { useState, useEffect } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useRouter } from "next/navigation";

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

interface UserRole {
  role: 'veterinarian' | 'user' | 'admin';
  firstName?: string;
  lastName?: string;
  email: string;
  twoFactorEnabled?: boolean;
}

interface FirebaseError {
  code?: string;
  message?: string;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [googleUserData, setGoogleUserData] = useState<{uid: string; email: string; role: string} | null>(null);
  const router = useRouter();

  // IDAGDAG: Check kung may reset password action sa URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    
    if (mode === 'resetPassword' && oobCode) {
      // I-redirect sa reset password page
      router.push(`/reset-password?oobCode=${oobCode}`);
    }
  }, [router]);

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Helper function para i-debug ang API responses
  const debugAPIResponse = async (response: Response) => {
    const text = await response.text();
    console.log("🔍 Raw API response:", text);
    try {
      return JSON.parse(text);
    } catch {
      console.error("❌ Invalid JSON response:", text);
      return { error: "Invalid JSON response", raw: text };
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (showForgotPassword) {
      return;
    }
    
    setLoading(true);
    setError("");
    setOtpRequired(false);

    try {
      console.log("🔄 Attempting login with:", email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("✅ Firebase auth success, user ID:", user.uid);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log("📄 Attempting to fetch user document...");
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      console.log("✅ User document fetched successfully");
      console.log("📄 User document exists:", userDoc.exists());
      
      if (!userDoc.exists()) {
        console.log("❌ No user document found for UID:", user.uid);
        setError("User profile not found. Please contact administrator.");
        await auth.signOut();
        return;
      }

      const userData = userDoc.data() as UserRole;
      console.log("👤 User data:", userData);
      console.log("🔐 2FA enabled:", userData.twoFactorEnabled);
      console.log("🎯 User role:", userData.role);
      
      if (userData.twoFactorEnabled) {
        console.log("🔐 2FA required, proceeding with OTP flow...");
        setUserId(user.uid);
        setUserRole(userData.role);
        setOtpRequired(true);
        
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        
        const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email;
        console.log("📧 Sending OTP to:", userData.email);
        
        // ✅ FIXED: Changed 'otp' to 'code' to match API
        const emailResponse = await fetch('/api/send-email-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            code: otp, // ✅ CHANGED: 'otp' → 'code'
            name: userName
          }),
        });

        const emailData = await debugAPIResponse(emailResponse);
        console.log("📨 Email API response:", emailData);
        
        if (!emailResponse.ok) {
          throw new Error(emailData.error || "Failed to send verification code. Please try again.");
        }

        console.log("💾 Storing verification code in Firestore...");
        await setDoc(doc(db, "verificationCodes", user.uid), {
          code: otp,
          otpHash: emailData.otpHash,
          email: userData.email.toLowerCase(),
          createdAt: Date.now(),
          expiresAt: expiresAt,
          verified: false
        });

        console.log("🚪 Signing out for OTP verification...");
        await auth.signOut();
        
        setError("✅ A verification code has been sent to your email.");
      } else {
        console.log("🎯 No 2FA required, navigating to:", userData.role);
        navigateBasedOnRole(userData.role);
      }
      
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("❌ Login error:", firebaseError);
      
      if (firebaseError?.code === "permission-denied") {
        setError("Database access denied. Please check Firestore rules or contact support.");
      } else if (firebaseError?.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (firebaseError?.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError(firebaseError?.message || "An error occurred during authentication.");
      }
      
      await auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const navigateBasedOnRole = (role: string) => {
    console.log("Navigating based on role:", role);
    switch (role) {
      case 'admin':
        router.push("/admindashboard");
        break;
      case 'veterinarian':
        router.push("/vetdashboard");
        break;
      case 'user':
      default:
        router.push("/userdashboard");  
        break;
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setOtpLoading(true);
    setError("");

    try {
      console.log("🔐 Verifying OTP for user:", userId);
      
      const otpDoc = await getDoc(doc(db, "verificationCodes", userId));
      console.log("📄 OTP document exists:", otpDoc.exists());
      
      if (!otpDoc.exists()) {
        throw new Error("Verification code has expired. Please login again.");
      }

      const otpData = otpDoc.data();

      if (Date.now() > otpData.expiresAt) {
        await deleteDoc(doc(db, "verificationCodes", userId));
        throw new Error("Verification code has expired. Please request a new one.");
      }

      let verificationSuccessful = false;

      if (otpData.code && otpData.code === otpCode) {
        console.log("✅ OTP verification successful via direct code");
        verificationSuccessful = true;
      }
      else if (otpData.otpHash) {
        console.log("🌐 Attempting API verification...");
        
        // ✅ FIXED: Changed field names to match API
        const requestBody = {
          email: email.toLowerCase(),
          code: otpCode, // ✅ CHANGED: 'otp' → 'code'
          otpHash: otpData.otpHash
        };
        
        console.log("📨 Sending OTP verification request:", requestBody);
        
        const response = await fetch('/api/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await debugAPIResponse(response);
        console.log("📨 OTP verification API response:", data);
        
        if (response.ok && data.success) {
          console.log("✅ OTP verification successful via API");
          verificationSuccessful = true;
        } else {
          throw new Error(data.error || 'Invalid verification code');
        }
      } else {
        throw new Error("Invalid verification code format.");
      }

      if (verificationSuccessful) {
        console.log("✅ OTP verification successful, cleaning up...");
        await deleteDoc(doc(db, "verificationCodes", userId));
        
        console.log("🔑 Re-authenticating user...");
        await signInWithEmailAndPassword(auth, email, password);
        
        console.log("🧭 Navigation to:", userRole);
        navigateBasedOnRole(userRole);
      }
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("❌ OTP verification error:", firebaseError);
      setError(firebaseError?.message || "Verification failed. Please try again.");
      setOtpCode("");
    } finally {
      setOtpLoading(false);
    }
  };  

  // BAGONG: Handle Google OTP Verification
  const handleGoogleOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setOtpLoading(true);
    setError("");

    try {
      if (!googleUserData) {
        throw new Error("Google sign-in session expired. Please try again.");
      }

      console.log("🔐 Verifying Google OTP for user:", googleUserData.uid);
      
      const otpDoc = await getDoc(doc(db, "verificationCodes", googleUserData.uid));
      console.log("📄 OTP document exists:", otpDoc.exists());
      
      if (!otpDoc.exists()) {
        throw new Error("Verification code has expired. Please login again.");
      }

      const otpData = otpDoc.data();

      if (Date.now() > otpData.expiresAt) {
        await deleteDoc(doc(db, "verificationCodes", googleUserData.uid));
        throw new Error("Verification code has expired. Please request a new one.");
      }

      let verificationSuccessful = false;

      if (otpData.code && otpData.code === otpCode) {
        console.log("✅ Google OTP verification successful via direct code");
        verificationSuccessful = true;
      }
      else if (otpData.otpHash) {
        console.log("🌐 Attempting API verification for Google...");
        
        // ✅ FIXED: Changed field names to match API
        const response = await fetch('/api/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: googleUserData.email.toLowerCase(),
            code: otpCode, // ✅ CHANGED: 'otp' → 'code'
            otpHash: otpData.otpHash
          }),
        });

        const data = await debugAPIResponse(response);
        console.log("📨 Google OTP verification API response:", data);
        
        if (response.ok && data.success) {
          console.log("✅ Google OTP verification successful via API");
          verificationSuccessful = true;
        } else {
          throw new Error(data.error || 'Invalid verification code');
        }
      } else {
        throw new Error("Invalid verification code format.");
      }

      if (verificationSuccessful) {
        console.log("✅ Google OTP verification successful, cleaning up...");
        await deleteDoc(doc(db, "verificationCodes", googleUserData.uid));
        
        console.log("🔑 Re-authenticating Google user...");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        
        console.log("✅ Google re-authentication successful");
        
        console.log("🧭 Navigation to:", googleUserData.role);
        navigateBasedOnRole(googleUserData.role);
        
        // Clean up
        setGoogleUserData(null);
      }
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("❌ Google OTP verification error:", firebaseError);
      
      if (firebaseError?.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. Please try again.");
      } else if (firebaseError?.code === "auth/popup-blocked") {
        setError("Pop-up was blocked. Please allow pop-ups for this site.");
      } else {
        setError(firebaseError?.message || "Verification failed. Please try again.");
      }
      setOtpCode("");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    console.log("Resending OTP for user:", userId);
    setResendCooldown(60);
    
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const userEmail = googleUserData ? googleUserData.email : email;
      const userUid = googleUserData ? googleUserData.uid : userId;
      
      const userDoc = await getDoc(doc(db, "users", userUid));
      
      if (!userDoc.exists()) {
        throw new Error("User data not found. Please login again.");
      }

      const userData = userDoc.data() as UserRole;
      const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userEmail;
      
      const newOtp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      console.log("Sending new OTP to:", userEmail);
      
      // ✅ FIXED: Changed 'otp' to 'code' to match API
      const response = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          code: newOtp, // ✅ CHANGED: 'otp' → 'code'
          name: userName
        }),
      });

      const data = await debugAPIResponse(response);
      console.log("Resend OTP API response:", data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      console.log("Storing new verification code...");
      try {
        await deleteDoc(doc(db, "verificationCodes", userUid));
      } catch {
        console.log("No existing OTP to delete");
      }
      
      await setDoc(doc(db, "verificationCodes", userUid), {
        code: newOtp,
        otpHash: data.otpHash,
        email: userEmail.toLowerCase(),
        createdAt: Date.now(),
        expiresAt: expiresAt,
        verified: false
      });
      
      console.log("New OTP stored successfully");
      setError("✅ A new verification code has been sent to your email.");
      setOtpCode("");
    } catch (error) {
      const firebaseError = error as FirebaseError;
      console.error("❌ Resend OTP error:", firebaseError);
      setError("❌ Failed to resend code. Please try again.");
      setResendCooldown(0);
    }
  };  

  // BAGONG FORGOT PASSWORD HANDLER
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setError("Please enter your email address.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setResetLoading(true);
    setError("");

    try {
      console.log("Processing forgot password for:", resetEmail);
      
      // IDAGDAG: Action code settings para sa tamang redirect
      const actionCodeSettings = {
        url: "https://r-lfursure-niln.vercel.app/reset-password", // ✅ direct link sa reset page
        handleCodeInApp: true, // tells Firebase to use your app's page
      };
 
      console.log("Sending password reset email...");
      await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);

      console.log("✅ Password reset email sent successfully");
      setResetSuccess(true);
      setError("✅ Password reset link has been sent to your email!");
      
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail("");
        setResetSuccess(false);
        setError("");
      }, 5000);
      
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("❌ Forgot password error:", firebaseError);
      
      if (firebaseError?.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (firebaseError?.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else if (firebaseError?.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(firebaseError?.message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowForgotPassword(true);
    setError("");
  };

  const handleCancelReset = () => {
    setShowForgotPassword(false);
    setResetEmail("");
    setError("");
    setResetSuccess(false);
  };

  const handleCancelOTP = () => {
    setOtpRequired(false);
    setOtpCode("");
    setUserId("");
    setUserRole("");
    setGoogleUserData(null);
    setError("");
    setEmail("");
    setPassword("");
  };

  const handleSignUpRedirect = () => {
    router.push("/createaccount");
  };

  const handleGoogleLogin = async () => {
    console.log("🔵 Google login clicked");
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      console.log("🌐 Initiating Google sign-in...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("✅ Google sign-in successful, user ID:", user.uid);
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserRole;
        console.log("👤 Existing user data:", userData);
        
        if (userData.twoFactorEnabled) {
          console.log("🔐 2FA required for Google user, generating OTP...");
          const otp = generateOTP();
          const expiresAt = Date.now() + 10 * 60 * 1000;
          
          const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email;
          console.log("✉️ Sending OTP to:", userData.email);
          
          // ✅ FIXED: Changed 'otp' to 'code' to match API
          const emailResponse = await fetch('/api/send-email-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userData.email,
              code: otp, // ✅ CHANGED: 'otp' → 'code'
              name: userName
            }),
          });

          const emailData = await debugAPIResponse(emailResponse);
          console.log("📩 Email API response:", emailData);
          
          if (!emailResponse.ok) {
            throw new Error(emailData.error || "Failed to send verification code. Please try again.");
          }

          console.log("💾 Storing verification code in Firestore...");
          await setDoc(doc(db, "verificationCodes", user.uid), {
            code: otp,
            otpHash: emailData.otpHash,
            email: userData.email.toLowerCase(),
            createdAt: Date.now(),
            expiresAt: expiresAt,
            verified: false
          });

          console.log("🚪 Signing out for OTP verification...");
          await auth.signOut();
        
          // Store Google user data for OTP verification
          setGoogleUserData({
            uid: user.uid,
            email: userData.email,
            role: userData.role
          });
        
          setOtpRequired(true);
          setError("✅ A verification code has been sent to your email.");
        } else {
          console.log(" No 2FA required, navigating to:", userData.role);
          navigateBasedOnRole(userData.role);
        }
      } else {
        console.log("New Google user, creating user document...");
        const newUserData: UserRole = {
          role: 'user',
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          email: user.email || '',
          twoFactorEnabled: false
        };
      
        await setDoc(doc(db, "users", user.uid), newUserData);
        console.log("✅ User document created, navigating to user dashboard");
        navigateBasedOnRole('user');
      }
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("❌ Google login error:", firebaseError);
    
      if (firebaseError?.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. Please try again.");
      } else if (firebaseError?.code === "auth/popup-blocked") {
        setError("Pop-up was blocked. Please allow pop-ups for this site.");
      } else {
        setError(firebaseError?.message || "Failed to sign in with Google. Please try again.");
      }
    
      try {
        await auth.signOut();
      } catch (signOutError) {
        console.log("Sign out error:", signOutError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if we're in a Google OTP flow
  const isGoogleOTPFlow = otpRequired && googleUserData;

  return (
    <>
      <GlobalStyle />
      <LoginContainer>
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
                {showForgotPassword ? "Reset Password" : !otpRequired ? "Welcome" : "Email Verification"}
              </FormTitle>
              <FormSubtitle>
                {showForgotPassword 
                  ? "Enter your email to receive a password reset link"
                  : !otpRequired 
                    ? "Sign in to your account"
                    : "Enter the code sent to your email"
                }
              </FormSubtitle>
            </FormHeader>

            {!otpRequired ? (
              showForgotPassword ? (
                <ForgotPasswordForm onSubmit={handleForgotPassword}>
                  <ResetDescription>
                    <ResetIcon>🔑</ResetIcon>
                    <ResetText>
                      Enter your email address and we&apos;ll send you a link to reset your password.
                    </ResetText>
                  </ResetDescription>

                  <InputGroup>
                    <InputLabel>Email Address</InputLabel>
                    <StyledInput
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={resetLoading || resetSuccess}
                      autoFocus
                    />
                  </InputGroup>

                  {error && (
                    <ErrorMessage $success={resetSuccess}>
                      {error}
                    </ErrorMessage>
                  )}

                  <ButtonRow>
                    <CancelButton 
                      type="button" 
                      onClick={handleCancelReset} 
                      disabled={resetLoading}
                    >
                      ⮜ Back to Login
                    </CancelButton>
                    <VerifyButton 
                      type="submit" 
                      disabled={resetLoading || resetSuccess}
                    >
                      {resetLoading ? "Sending..." : resetSuccess ? "Sent!" : "Send Reset Link"}
                    </VerifyButton>
                  </ButtonRow>
                </ForgotPasswordForm>
              ) : (
                <LoginForm onSubmit={handleSubmit}>
                  <InputGroup>
                    <InputLabel>Email</InputLabel>
                    <StyledInput
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={loading}
                    />
                  </InputGroup>
                  
                  <InputGroup>
                    <InputLabel>Password</InputLabel>
                    <PasswordContainer>
                      <StyledInput
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        disabled={loading}
                      />
                      <PasswordToggle 
                        type="button" 
                        onClick={togglePasswordVisibility}
                      >
                        {showPassword ?  "🔓":"🔒"}
                      </PasswordToggle>
                    </PasswordContainer>
                  </InputGroup>

                  <ForgotPasswordLink onClick={handleForgotPasswordClick}>
                    Forgot password?
                  </ForgotPasswordLink>

                  {error && <ErrorMessage>{error}</ErrorMessage>}

                  <LoginButton type="submit" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </LoginButton>

                  <Divider>
                    <DividerLine />
                    <DividerText>or</DividerText>
                    <DividerLine />
                  </Divider>

                  <GoogleLoginButton type="button" onClick={handleGoogleLogin} disabled={loading}>
                    <GoogleIcon>
                      <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                      </svg>
                    </GoogleIcon>
                    Continue with Google
                  </GoogleLoginButton>
                </LoginForm>
              )
            ) : (
              <OTPForm onSubmit={isGoogleOTPFlow ? handleGoogleOTPVerification : handleOTPVerification}>
                <OTPDescription>
                  <EmailIcon>📧</EmailIcon>
                  <OTPText>
                    We&apos;ve sent a 6-digit verification code to <strong>{isGoogleOTPFlow ? googleUserData.email : email}</strong>
                  </OTPText>
                </OTPDescription>

                <InputGroup>
                  <OTPInput
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    disabled={otpLoading}
                    autoFocus
                  />
                </InputGroup>

                <ResendContainer>
                  {resendCooldown > 0 ? (
                    <ResendText>Resend code in {resendCooldown}s</ResendText>
                  ) : (
                    <ResendLink onClick={handleResendOTP}>
                      Resend verification code
                    </ResendLink>
                  )}
                </ResendContainer>

                {error && <ErrorMessage>{error}</ErrorMessage>}

                <ButtonRow>
                  <CancelButton type="button" onClick={handleCancelOTP} disabled={otpLoading}>
                    Cancel
                  </CancelButton>
                  <VerifyButton 
                    type="submit" 
                    disabled={otpLoading || otpCode.length !== 6}
                  >
                    {otpLoading ? "Verifying..." : "Verify"}
                  </VerifyButton>
                </ButtonRow>

                <OTPExpiryNote>Code expires in 10 minutes</OTPExpiryNote>
              </OTPForm>
            )}

            {!otpRequired && !showForgotPassword && (
              <ToggleForm>
                Don&apos;t have an account?{" "}
                <ToggleLink onClick={handleSignUpRedirect}>
                  Sign up for free
                </ToggleLink>
              </ToggleForm>
            )}
          </FormContainer>
        </RightPanel>
      </LoginContainer>
    </>
  );
};

export default Login;

// STYLED COMPONENTS (SAME AS BEFORE)
const LoginForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ForgotPasswordForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const OTPForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const LoginContainer = styled.div`
  display: flex;
  min-height: 100vh;
  
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
    width: 80px;
    height: 80px;
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
  max-width: 400px;
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

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const InputLabel = styled.label`
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
`;

const StyledInput = styled.input`
  padding: 0.875rem 1rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
  width: 100%;
  
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

const PasswordContainer = styled.div`
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

const ForgotPasswordLink = styled.button`
  background: none;
  border: none;
  color: #4ecdc4;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  padding: 0;
  align-self: flex-start;
  
  &:hover {
    color: #3db8af;
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div<{ $success?: boolean }>`
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  background: ${props => props.$success ? '#d4edda' : '#f8d7da'};
  color: ${props => props.$success ? '#155724' : '#721c24'};
  border: 1px solid ${props => props.$success ? '#c3e6cb' : '#f5c6cb'};
`;

const LoginButton = styled.button`
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

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0;
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: #e1e5e9;
`;

const DividerText = styled.span`
  color: #666;
  font-size: 0.9rem;
  font-weight: 500;
`;

const GoogleLoginButton = styled.button`
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

const ToggleForm = styled.div`
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-top: 1rem;
`;

const ToggleLink = styled.button`
  background: none;
  border: none;
  color: #4ecdc4;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    color: #3db8af;
    text-decoration: underline;
  }
`;

// OTP Verification Styles
const OTPDescription = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 0.5rem;
`;

const EmailIcon = styled.span`
  font-size: 1.2rem;
  flex-shrink: 0;
`;

const OTPText = styled.p`
  margin: 0;
  color: #333;
  font-size: 0.9rem;
  line-height: 1.4;
`;

const OTPInput = styled(StyledInput)`
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.5rem;
  padding: 1rem;
  
  &::placeholder {
    letter-spacing: normal;
    color: #ccc;
  }
`;

const ResendContainer = styled.div`
  text-align: center;
  margin-top: -0.5rem;
`;

const ResendText = styled.span`
  color: #666;
  font-size: 0.85rem;
`;

const ResendLink = styled.button`
  background: none;
  border: none;
  color: #4ecdc4;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  
  &:hover {
    color: #3db8af;
    text-decoration: underline;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CancelButton = styled.button`
  flex: 1;
  padding: 0.875rem 1.5rem;
  background: white;
  color: #666;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    border-color: #ccc;
    background: #f8f9fa;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const VerifyButton = styled(LoginButton)`
  flex: 1;
`;

const OTPExpiryNote = styled.p`
  text-align: center;
  color: #666;
  font-size: 0.8rem;
  margin: -0.5rem 0 0 0;
`;

// Forgot Password Styles
const ResetDescription = styled(OTPDescription)`
  margin-bottom: 1rem;
`;

const ResetIcon = styled(EmailIcon)``;

const ResetText = styled(OTPText)``;