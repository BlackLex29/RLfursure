"use client";
import React, { useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
  const router = useRouter();

  // Generate 6-digit OTP
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOtpRequired(false);

    try {
      console.log("Attempting login with:", email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Firebase auth success, user ID:", user.uid);
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      console.log("User document exists:", userDoc.exists());
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserRole;
        console.log("User data:", userData);
        console.log("2FA enabled:", userData.twoFactorEnabled);
        
        if (userData.twoFactorEnabled) {
          console.log("2FA required, generating OTP...");
          const otp = generateOTP();
          const expiresAt = Date.now() + 10 * 60 * 1000;
          
          const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email;
          console.log("Sending OTP to:", userData.email);
          
          const emailResponse = await fetch('/api/send-email-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userData.email,
              otp: otp,
              name: userName
            }),
          });

          const emailData = await emailResponse.json();
          console.log("Email API response:", emailData);
          
          if (!emailResponse.ok) {
            throw new Error(emailData.error || "Failed to send verification code. Please try again.");
          }

          console.log("Storing verification code in Firestore...");
          await setDoc(doc(db, "verificationCodes", user.uid), {
            code: otp,
            otpHash: emailData.otpHash,
            email: userData.email.toLowerCase(),
            createdAt: Date.now(),
            expiresAt: expiresAt,
            verified: false
          });

          console.log("Signing out for OTP verification...");
          await auth.signOut();
          
          setUserId(user.uid);
          setUserRole(userData.role);
          setOtpRequired(true);
          setError("A verification code has been sent to your email.");
        } else {
          console.log("No 2FA required, navigating to:", userData.role);
          navigateBasedOnRole(userData.role);
        }
      } else {
        console.log("No user document found, defaulting to user role");
        navigateBasedOnRole('user');
      }
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("Login error:", firebaseError);
      console.error("Error code:", firebaseError?.code);
      console.error("Error message:", firebaseError?.message);
      
      if (firebaseError?.code === "auth/invalid-credential" || firebaseError?.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (firebaseError?.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (firebaseError?.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else if (firebaseError?.code === "permission-denied") {
        setError("Database permission denied. Please check Firestore rules.");
      } else {
        setError(firebaseError?.message || "An error occurred during authentication.");
      }
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
      console.log("Verifying OTP for user:", userId);
      const otpDoc = await getDoc(doc(db, "verificationCodes", userId));
      console.log("OTP document exists:", otpDoc.exists());
      
      if (!otpDoc.exists()) {
        throw new Error("Verification code has expired. Please login again.");
      }

      const otpData = otpDoc.data();
      console.log("OTP data:", otpData);

      if (Date.now() > otpData.expiresAt) {
        await deleteDoc(doc(db, "verificationCodes", userId));
        throw new Error("Verification code has expired. Please request a new one.");
      }

      let verificationSuccessful = false;

      if (otpData.code && otpData.code === otpCode) {
        console.log("OTP verification successful via direct code");
        verificationSuccessful = true;
      } else if (otpData.otpHash) {
        console.log("Verifying OTP via API...");
        const response = await fetch('/api/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            otp: otpCode,
            otpHash: otpData.otpHash,
            expiresAt: otpData.expiresAt
          }),
        });

        const data = await response.json();
        console.log("OTP verification API response:", data);
        if (response.ok && data.success) {
          verificationSuccessful = true;
        } else {
          throw new Error(data.error || 'Invalid verification code');
        }
      } else {
        throw new Error("Invalid verification code. Please try again.");
      }

      if (verificationSuccessful) {
        console.log("OTP verification successful, signing in...");
        await deleteDoc(doc(db, "verificationCodes", userId));
        
        // Check if user used Google sign-in (no password)
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          // Try to re-authenticate (will work for both email/password and Google)
          try {
            // For Google users, we need to use signInWithPopup again
            const currentUser = auth.currentUser;
            if (!currentUser) {
              // User is not signed in, try Google sign-in
              const provider = new GoogleAuthProvider();
              await signInWithPopup(auth, provider);
            }
          } catch {
            // If re-auth fails, try email/password
            if (password) {
              await signInWithEmailAndPassword(auth, email, password);
            } else {
              throw new Error("Unable to re-authenticate. Please login again.");
            }
          }
          
          navigateBasedOnRole(userRole);
        }
      }
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("OTP verification error:", firebaseError);
      setError(firebaseError?.message || "Verification failed. Please try again.");
      setOtpCode("");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

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
      console.log("Resending OTP for user:", userId);
      const userDoc = await getDoc(doc(db, "users", userId));
      const userData = userDoc.data() as UserRole;
      const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || email;
      
      const newOtp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      console.log("Sending new OTP to:", email);
      const response = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          otp: newOtp,
          name: userName
        }),
      });

      const data = await response.json();
      console.log("Resend OTP API response:", data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      console.log("Storing new verification code...");
      await setDoc(doc(db, "verificationCodes", userId), {
        code: newOtp,
        otpHash: data.otpHash,
        email: email.toLowerCase(),
        createdAt: Date.now(),
        expiresAt: expiresAt,
        verified: false
      });
      
      setError("A new verification code has been sent to your email.");
      setOtpCode("");
    } catch (error) {
      const firebaseError = error as FirebaseError;
      console.error("Resend OTP error:", firebaseError);
      setError("Failed to resend code. Please try again.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setError("Please enter your email address.");
      return;
    }

    setResetLoading(true);
    setError("");

    try {
      console.log("Processing forgot password for:", resetEmail);
      
      const userName = resetEmail;
      
      console.log("Looking up user data...");

      // Send password reset email via Brevo
      console.log("Sending password reset email...");
      const response = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resetEmail,
          name: userName
        }),
      });

      const data = await response.json();
      console.log("Password reset API response:", data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      // Also use Firebase's built-in reset (as backup)
      console.log("Sending Firebase reset email...");
      await sendPasswordResetEmail(auth, resetEmail);

      setResetSuccess(true);
      setError("Password reset link has been sent to your email!");
      
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail("");
        setResetSuccess(false);
        setError("");
      }, 3000);
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("Forgot password error:", firebaseError);
      if (firebaseError?.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (firebaseError?.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError(firebaseError?.message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
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
    setError("");
    setEmail("");
    setPassword("");
  };

  const handleSignUpRedirect = () => {
    router.push("/createaccount");
  };

  const handleGoogleLogin = async () => {
    console.log("Google login clicked");
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      console.log("Initiating Google sign-in...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Google sign-in successful, user ID:", user.uid);
      
      // Check if user document exists
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        // Existing user - proceed to their dashboard
        const userData = userDoc.data() as UserRole;
        console.log("Existing user data:", userData);
        
        // Check if 2FA is enabled
        if (userData.twoFactorEnabled) {
          console.log("2FA required for Google user, generating OTP...");
          const otp = generateOTP();
          const expiresAt = Date.now() + 10 * 60 * 1000;
          
          const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email;
          console.log("Sending OTP to:", userData.email);
          
          const emailResponse = await fetch('/api/send-email-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userData.email,
              otp: otp,
              name: userName
            }),
          });

          const emailData = await emailResponse.json();
          console.log("Email API response:", emailData);
          
          if (!emailResponse.ok) {
            throw new Error(emailData.error || "Failed to send verification code. Please try again.");
          }

          console.log("Storing verification code in Firestore...");
          await setDoc(doc(db, "verificationCodes", user.uid), {
            code: otp,
            otpHash: emailData.otpHash,
            email: userData.email.toLowerCase(),
            createdAt: Date.now(),
            expiresAt: expiresAt,
            verified: false
          });

          console.log("Signing out for OTP verification...");
          await auth.signOut();
          
          setUserId(user.uid);
          setUserRole(userData.role);
          setEmail(userData.email);
          setOtpRequired(true);
          setError("A verification code has been sent to your email.");
        } else {
          console.log("No 2FA required, navigating to:", userData.role);
          navigateBasedOnRole(userData.role);
        }
      } else {
        // New user - create user document with default role
        console.log("New Google user, creating user document...");
        const newUserData: UserRole = {
          role: 'user',
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          email: user.email || '',
          twoFactorEnabled: false
        };
        
        await setDoc(doc(db, "users", user.uid), newUserData);
        console.log("User document created, navigating to user dashboard");
        navigateBasedOnRole('user');
      }
    } catch (err) {
      const firebaseError = err as FirebaseError;
      console.error("Google login error:", firebaseError);
      console.error("Error code:", firebaseError?.code);
      console.error("Error message:", firebaseError?.message);
      
      if (firebaseError?.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. Please try again.");
      } else if (firebaseError?.code === "auth/popup-blocked") {
        setError("Pop-up was blocked. Please allow pop-ups for this site.");
      } else if (firebaseError?.code === "auth/cancelled-popup-request") {
        setError("Sign-in cancelled. Please try again.");
      } else if (firebaseError?.code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with this email using a different sign-in method.");
      } else {
        setError(firebaseError?.message || "Failed to sign in with Google. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <LoginContainer>
        <LeftPanel>
          {/* Dog and Cat Background Image */}
          <PetBackground 
            src="https://images.unsplash.com/photo-1509205477838-a534e43a849f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8ZG9nJTIwYW5kJTIwY2F0JTIwYmFja2dyb3VuZHxlbnwwfHwwfHx8MA%3D%3D" 
            alt="Dog and cat together"
          />
          <PanelOverlay />
          
          {/* Centered Logo Section */}
          <CenteredLogoSection>
            <LogoImage 
              src="https://scontent.fmnl13-4.fna.fbcdn.net/v/t39.30808-6/308051699_1043145306431767_6902051210877649285_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeH7C3PaObQLeqOOxA3pTYw1U6XSiAPBS_lTpdKIA8FL-aWJ6pOqX-tCsYAmdUOHVzzxg-T9gjpVH_1PkEO0urYZ&_nc_ohc=3_gksc7umd8Q7kNvwE8kw4f&_nc_oc=AdksPU1-IYknvVnbsUBFqwptHteRYCP_PZn3FhrXlzKYXRxbGktf0tBn7_3RxG8YGC4&_nc_zt=23&_nc_ht=scontent.fmnl13-4.fna&_nc_gid=q3FDuc18TAuorB9FSdcKOg&oh=00_AfZjHSvgCC4OrheNQ_1fcJ-tSSO25UyXXAOD_RVFYk6nWA&oe=68E03759"
              alt="FurSureCare Logo" 
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
                <StyledForm onSubmit={handleForgotPassword}>
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
                      Back to Login
                    </CancelButton>
                    <VerifyButton 
                      type="submit" 
                      disabled={resetLoading || resetSuccess}
                    >
                      {resetLoading ? "Sending..." : resetSuccess ? "Sent!" : "Send Reset Link"}
                    </VerifyButton>
                  </ButtonRow>
                </StyledForm>
              ) : (
                <StyledForm onSubmit={handleSubmit}>
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
                        {showPassword ? "🙈" : "👁"}
                      </PasswordToggle>
                    </PasswordContainer>
                  </InputGroup>

                  <ForgotPasswordLink onClick={() => setShowForgotPassword(true)}>
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
                </StyledForm>
              )
            ) : (
              <StyledForm onSubmit={handleOTPVerification}>
                <OTPDescription>
                  <EmailIcon>📧</EmailIcon>
                  <OTPText>
                    We&apos;ve sent a 6-digit verification code to <strong>{email}</strong>
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
              </StyledForm>
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

// Updated Styled Components with Centered Logo
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

// Centered Logo Section
const CenteredLogoSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1.5rem;
  margin: auto;
  z-index: 2;
  position: relative;
  width: 100%;
`;

const LogoImage = styled.img`
  width: 350px;
  height: 350px;
  object-fit: cover;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    width: 100px;
    height: 100px;
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
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const ClinicSubtitle = styled.span`
  font-size: 1.2rem;
  opacity: 0.95;
  font-weight: 500;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const RightPanel = styled.div`
  flex: 1;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 400px;
`;

const FormHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const FormTitle = styled.h2`
  font-size: 1.8rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
`;

const FormSubtitle = styled.p`
  color: #6c757d;
  margin: 0;
  font-size: 0.95rem;
`;

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const InputLabel = styled.label`
  font-size: 0.9rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const StyledInput = styled.input`
  padding: 0.8rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  width: 100%;
  height: 48px;
  
  &:focus {
    outline: none;
    border-color: #4ECDC4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }
  
  &::placeholder {
    color: #adb5bd;
  }
`;

const PasswordContainer = styled.div`
  position: relative;
  width: 100%;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  opacity: 0.6;
  padding: 0.2rem;
  border-radius: 4px;
  height: 32px;
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }
`;

const ForgotPasswordLink = styled.span`
  color: #4ECDC4;
  text-decoration: none;
  font-size: 0.9rem;
  text-align: right;
  cursor: pointer;
  display: block;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div<{ $success?: boolean }>`
  background: ${props => props.$success ? '#d4edda' : '#f8d7da'};
  color: ${props => props.$success ? '#155724' : '#721c24'};
  padding: 0.8rem;
  border-radius: 8px;
  font-size: 0.9rem;
  border: 1px solid ${props => props.$success ? '#c3e6cb' : '#f5c6cb'};
`;

const LoginButton = styled.button`
  background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
  color: white;
  border: none;
  padding: 0.9rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 1rem 0;
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: #e0e0e0;
`;

const DividerText = styled.span`
  padding: 0 1rem;
  color: #6c757d;
  font-size: 0.9rem;
`;

const GoogleLoginButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.8rem;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 48px;
  
  &:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #4285f4;
    box-shadow: 0 2px 4px rgba(66, 133, 244, 0.2);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const GoogleIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const OTPDescription = styled.div`
  text-align: center;
  background: #e8f5e9;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #c8e6c9;
`;

const EmailIcon = styled.div`
  font-size: 2rem;
`;

const OTPText = styled.p`
  margin: 0;
  color: #2c3e50;
  font-size: 0.9rem;
  line-height: 1.4;
  
  strong {
    color: #4ECDC4;
  }
`;

const OTPInput = styled(StyledInput)`
  text-align: center;
  font-size: 1.8rem;
  letter-spacing: 0.8rem;
  font-weight: 600;
  padding: 1rem;
  height: 60px;
`;

const ResendContainer = styled.div`
  text-align: center;
`;

const ResendLink = styled.span`
  color: #4ECDC4;
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
  
  &:hover {
    color: #44A08D;
  }
`;

const ResendText = styled.span`
  color: #6c757d;
  font-size: 0.9rem;
`;

const ButtonRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.9rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s ease;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover:not(:disabled) {
    background: #5a6268;
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const VerifyButton = styled(LoginButton)`
  height: 48px;
`;

const OTPExpiryNote = styled.div`
  text-align: center;
  font-size: 0.85rem;
  color: #6c757d;
`;

const ToggleForm = styled.div`
  text-align: center;
  margin-top: 2rem;
  color: #6c757d;
  font-size: 0.9rem;
`;

const ToggleLink = styled.span`
  color: #4ECDC4;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ResetDescription = styled.div`
  text-align: center;
  background: #fff3cd;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #ffeaa7;
`;

const ResetIcon = styled.div`
  font-size: 2rem;
`;

const ResetText = styled.p`
  margin: 0;
  color: #2c3e50;
  font-size: 0.9rem;
  line-height: 1.4;
`;