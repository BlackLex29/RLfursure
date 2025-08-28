'use client';

import React, { useState, useEffect } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  AuthError 
} from "firebase/auth";
import { db, auth } from "../firebaseConfig";

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Poppins", sans-serif;
    background-color: #dff7f1;
  }
`;

const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 40px 30px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  text-align: center;
`;

const Title = styled.h1`
  margin-bottom: 25px;
  color: #1a1a1a;
  font-weight: 700;
  font-size: 28px;
`;

const Subtitle = styled.p`
  color: #555;
  margin-bottom: 30px;
  font-size: 16px;
`;

const GoogleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  background-color: white;
  color: #555;
  font-weight: 600;
  font-size: 16px;
  padding: 14px;
  border: 2px solid #ddd;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 20px;

  &:hover:not(:disabled) {
    border-color: #34b89c;
    box-shadow: 0 2px 8px rgba(52, 184, 156, 0.3);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const GoogleIcon = styled.div`
  width: 20px;
  height: 20px;
  background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PHBhdGggZD0iTTE3LjYgOS4ybC0uMS0xLjhIOXYzLjRoNC44QzEzLjYgMTIgMTMgMTMgMTIgMTMuNnYyLjJoM2E4LjggOC44IDAgMCAwIDIuNi02LjZ6IiBmaWxsPSIjNDI4NUY0IiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNOSAxOGMyLjQgMCA0LjUtLjggNi0yLjJsLTMtMi4yYTUuNCA1LjQgMCAwIDEtOC0yLjlIMVYxM2E5IDkgMCAwIDAgOCA1eiIgZmlsbD0iIzM0QTg1MyIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTQgMTAuN2E1LjQgNS40IDAgMCAxIDAtMy40VjVIMWE5IDkgMCAwIDAgMCA4bDMtMi4zeiIgZmlsbD0iI0ZCQkMwNSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTkgMy42YzEuMyAwIDIuNS40IDMuNCAxLjNMMTUgMi4zQTkgOSAwIDAgMCAxIDVsMyAyLjRhNS40IDUuNCAwIDAgMSA1LTMuN3oiIGZpbGw9IiNFQTQzMzUiIGZpbGwtcnVsZT0ibm9uemVybyIvPjxwYXRoIGQ9Ik0wIDBoMTh2MThIMHoiLz48L2c+PC9zdmc+') center no-repeat;
`;

const ErrorMessage = styled.p`
  color: #c0392b;
  font-size: 14px;
  margin: 10px 0;
  font-weight: 600;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 6px;
`;

const SuccessMessage = styled.p`
  color: #27ae60;
  font-size: 14px;
  margin: 10px 0;
  font-weight: 600;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 6px;
`;

const RedirectText = styled.p`
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: #555;

  span {
    color: #34b89c;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
  }

  span:hover {
    text-decoration: underline;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 20px 0;
  
  &:before, &:after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #ddd;
  }
`;

const DividerText = styled.span`
  padding: 0 10px;
  color: #777;
  font-size: 14px;
`;

const DeviceWarning = styled.div`
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: left;
  font-size: 14px;
`;

const MobileIcon = styled.div`
  font-size: 48px;
  margin-bottom: 15px;
  color: #34b89c;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(85, 85, 85, 0.3);
  border-radius: 50%;
  border-top-color: #555;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Type guard to check if an error is an AuthError
function isAuthError(error: unknown): error is AuthError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// Device detection function
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor;
  
  // Check for common mobile device indicators
  return (
    /android/i.test(userAgent) ||
    /iPad|iPhone|iPod/.test(userAgent) ||
    /windows phone/i.test(userAgent) ||
    /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
    (typeof window.orientation !== "undefined") ||
    navigator.maxTouchPoints > 1
  );
};

export const Register = () => {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user is on a mobile device
    setIsMobile(isMobileDevice());
  }, []);

  const handleGoogleSignUp = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Double check device type before proceeding
      if (!isMobileDevice()) {
        setError("Registration is only available on mobile devices. Please use your phone or tablet to sign up.");
        setLoading(false);
        return;
      }

      const provider = new GoogleAuthProvider();
      // Request additional profile information
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user already exists in Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        // Extract first and last name from displayName
        const displayName = user.displayName || "";
        const nameParts = displayName.split(" ");
        const firstname = nameParts[0] || "";
        const lastname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
          firstname,
          lastname,
          email: user.email,
          role: "user",
          createdAt: new Date().toISOString(),
          provider: "google",
          device: "mobile", // Track that this user registered from a mobile device
          lastLogin: new Date().toISOString()
        });
        
        setSuccess("Account created successfully!");
        
        // Redirect to pet registration with user data as query params
        router.push(`/petregister?firstname=${encodeURIComponent(firstname)}&lastname=${encodeURIComponent(lastname)}&email=${encodeURIComponent(user.email || "")}`);
      } else {
        // User already exists, check if they registered from mobile
        const userData = userDoc.data();
        if (userData.device !== "mobile") {
          setError("Your account was not created from a mobile device. Please contact support.");
          await signOut(auth);
          return;
        }
        
        // Update last login time
        await setDoc(doc(db, "users", user.uid), {
          ...userData,
          lastLogin: new Date().toISOString()
        }, { merge: true });
        
        // User already exists and registered from mobile, redirect to dashboard
        setSuccess("Signed in successfully!");
        router.push("/userdashboard");
      }
    } catch (err: unknown) {
      console.error("Google sign up error:", err);
      
      // Handle specific error cases with proper type checking
      if (isAuthError(err)) {
        if (err.code === 'auth/popup-closed-by-user') {
          setError("Sign up was canceled. Please try again.");
        } else if (err.code === 'auth/account-exists-with-different-credential') {
          setError("An account already exists with the same email address but different sign-in credentials.");
        } else if (err.code === 'auth/popup-blocked') {
          setError("Popup was blocked by your browser. Please allow popups for this site.");
        } else {
          setError(err.message || "Failed to sign up with Google. Please try again.");
        }
      } else if (err instanceof Error) {
        setError(err.message || "Failed to sign up with Google. Please try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      
      // Sign out if there was an error during the process
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Error signing out:", signOutError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <Card>
          <Title>Create an Account</Title>
          <Subtitle>Sign up with your Google account to get started</Subtitle>
          
          {!isMobile ? (
            <>
              <MobileIcon>📱</MobileIcon>
              <DeviceWarning>
                <strong>Mobile Device Required</strong>
                <p>For security reasons, registration is only available on mobile devices. Please open this page on your smartphone or tablet to continue.</p>
              </DeviceWarning>
              <GoogleButton disabled={true}>
                <GoogleIcon />
                Use Mobile Device to Register
              </GoogleButton>
            </>
          ) : (
            <GoogleButton onClick={handleGoogleSignUp} disabled={loading}>
              {loading && <LoadingSpinner />}
              <GoogleIcon />
              {loading ? "Processing..." : "Sign up with Google"}
            </GoogleButton>
          )}

          <Divider>
            <DividerText>Why Google only?</DividerText>
          </Divider>
          
          <p style={{ fontSize: '14px', color: '#666', textAlign: 'left' }}>
            We use Google authentication to ensure better security and a simpler registration process. 
            This helps protect your account and personal information.
          </p>

          {error && <ErrorMessage>{error}</ErrorMessage>}
          {success && <SuccessMessage>{success}</SuccessMessage>}

          <RedirectText>
            Already have an account?{" "}
            <span onClick={() => router.push("/login")}>Sign in here</span>
          </RedirectText>
        </Card>
      </Wrapper>
    </>
  );
};
export default Register;