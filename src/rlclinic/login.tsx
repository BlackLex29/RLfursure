'use client';

import React, { useState, useEffect } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  AuthError
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

// Global Styles
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #f7fdff 0%, #e6f7ff 100%);
    overflow-x: hidden;
    min-height: 100vh;
  }

  * {
    box-sizing: border-box;
  }
`;

const Container = styled.div`
  display: flex;
  min-height: 100vh;
  width: 100%;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const LeftPanel = styled.div`
  flex: 1;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: white;
  position: relative;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 20px;
    min-height: 300px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 20%),
      radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.15) 0%, transparent 25%);
    pointer-events: none;
  }
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const PetScene = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
  margin-bottom: 30px;
`;

const DogGraphic = styled.div`
  position: absolute;
  bottom: 0;
  left: 10%;
  width: 200px;
  height: 200px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='%23fff' d='M50 15 C60 5 80 10 85 25 C90 40 85 55 75 60 C65 65 35 65 25 60 C15 55 10 40 15 25 C20 10 40 5 50 15 Z'/%3E%3Ccircle cx='35' cy='30' r='5' fill='%23333'/%3E%3Ccircle cx='65' cy='30' r='5' fill='%23333'/%3E%3Cpath d='M40 45 Q50 55 60 45' stroke='%23333' stroke-width='2' fill='none'/%3E%3Cpath d='M25 20 C20 15 10 20 15 30' stroke='%23fff' stroke-width='3' fill='none'/%3E%3Cpath d='M75 20 C80 15 90 20 85 30' stroke='%23fff' stroke-width='3' fill='none'/%3E%3Cpath d='M20 70 C30 85 70 85 80 70' fill='%23fff'/%3E%3C/svg%3E") no-repeat center;
  background-size: contain;
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.2));
  
  @media (max-width: 480px) {
    width: 140px;
    height: 140px;
    left: 5%;
  }
`;

const CatGraphic = styled.div`
  position: absolute;
  bottom: 0;
  right: 15%;
  width: 170px;
  height: 170px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='%23fff' d='M50 20 C60 10 80 15 85 30 C90 45 85 60 75 65 C65 70 35 70 25 65 C15 60 10 45 15 30 C20 15 40 10 50 20 Z'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%23333'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%23333'/%3E%3Cpath d='M40 50 Q50 60 60 50' stroke='%23333' stroke-width='2' fill='none'/%3E%3Cpath d='M20 25 C15 20 5 25 10 35' stroke='%23fff' stroke-width='2.5' fill='none'/%3E%3Cpath d='M80 25 C85 20 95 25 90 35' stroke='%23fff' stroke-width='2.5' fill='none'/%3E%3Cpath d='M25 30 L15 20' stroke='%23fff' stroke-width='2'/%3E%3Cpath d='M75 30 L85 20' stroke='%23fff' stroke-width='2'/%3E%3Cpath d='M30 75 L25 90 L35 90' fill='%23fff'/%3E%3Cpath d='M70 75 L75 90 L65 90' fill='%23fff'/%3E%3C/svg%3E") no-repeat center;
  background-size: contain;
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.2));
  
  @media (max-width: 480px) {
    width: 120px;
    height: 120px;
    right: 10%;
  }
`;

const HeartGraphic = styled.div`
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 70px;
  height: 70px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='%23ff6b6b' d='M50 88 C20 68 0 48 0 30 C0 15 15 0 30 0 C40 0 50 5 50 15 C50 5 60 0 70 0 C85 0 100 15 100 30 C100 48 80 68 50 88 Z'/%3E%3C/svg%3E") no-repeat center;
  background-size: contain;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.2));
  
  @keyframes float {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-10px); }
  }
`;

const FloatingPaw = styled.div<{ $top?: string; $left?: string; $right?: string; $delay?: string }>`
  position: absolute;
  font-size: 24px;
  top: ${props => props.$top};
  left: ${props => props.$left};
  right: ${props => props.$right};
  opacity: 0.7;
  animation: floatAround 15s linear infinite;
  animation-delay: ${props => props.$delay || '0s'};
  
  @keyframes floatAround {
    0% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(20px, 15px) rotate(5deg); }
    50% { transform: translate(10px, 30px) rotate(10deg); }
    75% { transform: translate(-10px, 20px) rotate(5deg); }
    100% { transform: translate(0, 0) rotate(0deg); }
  }
`;

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 20px;
  z-index: 1;
`;

const Logo = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 48px;
  color: white;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);

  @media (max-width: 480px) {
    font-size: 36px;
  }
`;

const Tagline = styled.p`
  color: rgba(255, 255, 255, 0.95);
  font-size: 20px;
  margin: 0;
  font-weight: 500;
  max-width: 400px;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
`;

const Form = styled.form`
  width: 100%;
  max-width: 400px;
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-5px);
  }
`;

const Label = styled.label<{ $hasError?: boolean }>`
  position: relative;
  display: block;
  margin-bottom: 25px;

  .input {
    width: 100%;
    padding: 16px;
    padding-left: 45px;
    border: 2px solid ${props => props.$hasError ? '#e74c3c' : '#e0f2e9'};
    border-radius: 10px;
    outline: none;
    font-size: 16px;
    background: transparent;
    transition: all 0.3s ease;
  }

  .input:focus {
    border-color: ${props => props.$hasError ? '#e74c3c' : '#34B89C'};
    box-shadow: 0 0 0 3px ${props => props.$hasError ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 184, 156, 0.2)'};
  }

  span {
    position: absolute;
    left: 45px;
    top: 16px;
    font-size: 16px;
    color: ${props => props.$hasError ? '#e74c3c' : '#888'};
    background: #fff;
    padding: 0 6px;
    transition: 0.3s;
    pointer-events: none;
  }

  .input:focus + span,
  .input:not(:placeholder-shown) + span {
    top: -10px;
    left: 35px;
    font-size: 14px;
    color: ${props => props.$hasError ? '#e74c3c' : '#34B89C'};
    font-weight: 500;
  }
`;

const InputIcon = styled.div`
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: #9e9e9e;
  font-size: 20px;
`;

const Button = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(to right, #34B89C, #6BC1E1);
  color: #fff;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
  margin-top: 10px;
  box-shadow: 0 4px 10px rgba(52, 184, 156, 0.3);

  &:hover:not(:disabled) {
    background: linear-gradient(to right, #2DA58A, #5BB0D5);
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(52, 184, 156, 0.4);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorText = styled.p`
  color: #e74c3c;
  font-size: 14px;
  margin: -10px 0 15px 0;
  text-align: center;
  padding: 8px 12px;
  background: rgba(231, 76, 60, 0.1);
  border-radius: 6px;
  border-left: 3px solid #e74c3c;
`;

const SuccessText = styled.p`
  color: #27ae60;
  font-size: 14px;
  margin: -10px 0 15px 0;
  text-align: center;
  padding: 8px 12px;
  background: rgba(39, 174, 96, 0.1);
  border-radius: 6px;
  border-left: 3px solid #27ae60;
`;

const AdditionalOptions = styled.div`
  margin-top: 30px;
  text-align: center;
  width: 100%;
  max-width: 400px;
`;

const SignUpPrompt = styled.p`
  font-size: 15px;
  color: #555;

  a {
    color: #34B89C;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
    cursor: pointer;

    &:hover {
      color: #2DA58A;
      text-decoration: underline;
    }
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;
  vertical-align: middle;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const RememberMe = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  
  input {
    margin-right: 8px;
    accent-color: #34B89C;
  }
  
  label {
    font-size: 14px;
    color: #555;
  }
`;

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

const GoogleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: white;
  color: #374151;
  border: 2px solid #E5E7EB;
  padding: 12px 24px;
  border-radius: 10px;
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

export default function LoginPage() {
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle Email/Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let role = "user";
      if (userDoc.exists()) {
        role = userDoc.data().role || "user";
      }

      setSuccess("Login successful!");
      // Redirect based on role
      if (role === "admin") {
        router.push("/admindashboard");
      } else if (role === "veterinarian") {
        router.push("/vetdashboard");
      } else {
        router.push("/userdashboard");
      }
    } catch (err: unknown) {
      const authErr = err as AuthError;
      // Show user-friendly error messages
      if (authErr.code === "auth/invalid-credential" || authErr.code === "auth/wrong-password") {
        setError("Wrong password. Please try again.");
      } else if (authErr.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (authErr.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // For new users, set their role to 'user' by default
        await setDoc(userRef, {
          email: user.email,
          role: "user",
          createdAt: new Date()
        });
      }

      // Get user role from Firestore
      const updatedUserDoc = await getDoc(userRef);
      let role = "user";
      if (updatedUserDoc.exists()) {
        role = updatedUserDoc.data().role || "user";
      }

      setSuccess("Login successful!");
      // Redirect based on role
      if (role === "admin") {
        router.push("/admindashboard");
      } else if (role === "veterinarian") {
        router.push("/vetdashboard");
      } else {
        router.push("/userdashboard");
      }
    } catch (err: unknown) {
      console.error("Google login error:", err);
      setError("Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything until we're on the client
  if (!isClient) {
    return null;
  }

  return (
    <>
      <GlobalStyle />
      <Container>
        {/* Left Panel */}
        <LeftPanel>
          <LogoContainer>
            <Logo>FurSureCare</Logo>
            <Tagline>Caring for your pets, always by your side</Tagline>
          </LogoContainer>

          <PetScene>
            <DogGraphic />
            <CatGraphic />
            <HeartGraphic />
            <FloatingPaw $top="10%" $left="20%" $delay="0s">🐾</FloatingPaw>
            <FloatingPaw $top="30%" $right="25%" $delay="3s">🐾</FloatingPaw>
            <FloatingPaw $top="60%" $left="40%" $delay="6s">🐾</FloatingPaw>
          </PetScene>
        </LeftPanel>

        {/* Right Panel */}
        <RightPanel>
          <Form onSubmit={handleLogin}>
            {error && <ErrorText>{error}</ErrorText>}
            {success && <SuccessText>{success}</SuccessText>}

            {/* Email */}
            <Label>
              <InputIcon><Mail size={20} /></InputIcon>
              <input
                type="email"
                className="input"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span>Email</span>
            </Label>

            {/* Password */}
            <Label>
              <InputIcon><Lock size={20} /></InputIcon>
              <input
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span>Password</span>
              <div
                style={{
                  position: "absolute",
                  right: "15px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer"
                }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
            </Label>

            <RememberMe>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label>Remember me</label>
            </RememberMe>

            <Button type="submit" disabled={loading}>
              {loading && <LoadingSpinner />}
              {loading ? "Logging in..." : "Login"}
            </Button>
          </Form>

          <AdditionalOptions>
            <Divider>
              <DividerLine />
              <DividerText>OR</DividerText>
              <DividerLine />
            </Divider>

            <GoogleButton onClick={handleGoogleLogin} disabled={loading}>
              <GoogleIcon>G</GoogleIcon> Continue with Google
            </GoogleButton>

            <SignUpPrompt>
              Don&apos;t have an account? <a onClick={() => router.push("/createaccount")}>Sign up</a>
            </SignUpPrompt>
          </AdditionalOptions>
        </RightPanel>
      </Container>
    </>
  );
}