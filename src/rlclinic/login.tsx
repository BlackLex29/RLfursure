'use client';

import React, { useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

// 🌍 Global style
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Rozha+One&display=swap');
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #f9f9f9 0%, #e3f2fd 100%);
    overflow-x: hidden;
    min-height: 100vh;
  }

  * {
    box-sizing: border-box;
  }
`;

// 🎨 Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  width: 100%;
`;

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 30px;
`;

const Logo = styled.h1`
  font-family: 'Rozha One', serif;
  font-size: 42px;
  color: #34B89C;
  margin-bottom: 10px;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.1);

  @media (max-width: 480px) {
    font-size: 36px;
  }
`;

const Tagline = styled.p`
  color: #666;
  font-size: 16px;
  margin: 0;
`;

const Form = styled.form`
  background: #fff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
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
    border: 2px solid ${props => props.$hasError ? '#e74c3c' : '#e0e0e0'};
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
    left: 16px;
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
    left: 12px;
    font-size: 14px;
    color: ${props => props.$hasError ? '#e74c3c' : '#34B89C'};
    font-weight: 500;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(to right, #34B89C, #2a8f78);
  color: #fff;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
  margin-top: 10px;
  box-shadow: 0 4px 10px rgba(52, 184, 156, 0.3);

  &:hover {
    background: linear-gradient(to right, #2a8f78, #217a65);
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

const ForgotPassword = styled.p`
  font-size: 14px;
  color: #34B89C;
  text-align: center;
  margin-top: 20px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #2a8f78;
    text-decoration: underline;
  }
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

    &:hover {
      color: #2a8f78;
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

// Firebase error interface
interface FirebaseError extends Error {
  code: string;
  message: string;
}

// Type guard to check if error is FirebaseError
function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 🛠️ Login Component
const LoginPage: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: ""
  });

  const validateForm = () => {
    const errors = {
      email: "",
      password: ""
    };
    
    let isValid = true;
    
    // Email validation
    if (!formData.email) {
      errors.email = "Email is required";
      isValid = false;
    } else if (!EMAIL_REGEX.test(formData.email)) {
      errors.email = "Please enter a valid email address";
      isValid = false;
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
      isValid = false;
    }
    
    setFieldErrors(errors);
    return isValid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Clear specific field error when user starts typing
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: ""
      });
    }
    
    // Clear general error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      // 🔑 Firebase Auth login
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // 🔍 Get role from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let role = "user"; // default role

      if (userDoc.exists()) {
        const userData = userDoc.data();
        role = (userData.role as string) || "user"; // fallback to "user"
      }

      // 🚀 Route base sa role
      if (role === "admin") {
        router.push("/admindashboard");
      } else if (role === "user") {
        router.push("/userdashboard");
      } else {
        setError("No role assigned. Contact support.");
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      
      // Handle specific error cases
      if (isFirebaseError(err)) {
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          setError("Wrong password. Please try again.");
          setFieldErrors({
            ...fieldErrors,
            password: "Incorrect password"
          });
        } else if (err.code === "auth/user-not-found") {
          setError("No account found with this email.");
          setFieldErrors({
            ...fieldErrors,
            email: "Email not found"
          });
        } else if (err.code === "auth/invalid-email") {
          setError("Invalid email address format.");
          setFieldErrors({
            ...fieldErrors,
            email: "Invalid email format"
          });
        } else if (err.code === "auth/too-many-requests") {
          setError("Too many failed attempts. Please try again later.");
        } else {
          setError("An error occurred during login. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError("Please enter your email first.");
      setFieldErrors({
        ...fieldErrors,
        email: "Email is required to reset password"
      });
      return;
    }
    
    // Validate email format
    if (!EMAIL_REGEX.test(formData.email)) {
      setError("Please enter a valid email address.");
      setFieldErrors({
        ...fieldErrors,
        email: "Invalid email format"
      });
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setMessage("Password reset email sent! Please check your inbox.");
      setError("");
      setFieldErrors({
        email: "",
        password: ""
      });
    } catch (err: unknown) {
      if (isFirebaseError(err) && err.code === "auth/user-not-found") {
        setError("No account found with this email.");
        setFieldErrors({
          ...fieldErrors,
          email: "Email not found"
        });
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    }
  };

  return (
    <>
      <GlobalStyle />
      <Container>
        <LogoContainer>
          <Logo>FurSureCare</Logo>
          <Tagline>Pet care made simple and reliable</Tagline>
        </LogoContainer>
        
        <Form onSubmit={handleSubmit}>
          {error && <ErrorText>{error}</ErrorText>}
          {message && <SuccessText>{message}</SuccessText>}

          <Label $hasError={!!fieldErrors.email}>
            <input
              type="email"
              name="email"
              className="input"
              placeholder=" "
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
            <span>Email</span>
            {fieldErrors.email && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '5px' }}>
                {fieldErrors.email}
              </div>
            )}
          </Label>

          <Label $hasError={!!fieldErrors.password}>
            <input
              type="password"
              name="password"
              className="input"
              placeholder=" "
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              disabled={loading}
            />
            <span>Password</span>
            {fieldErrors.password && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '5px' }}>
                {fieldErrors.password}
              </div>
            )}
          </Label>

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <LoadingSpinner /> Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>

          <ForgotPassword onClick={handleForgotPassword} role="button">
            Forgot Password?
          </ForgotPassword>
        </Form>
        
        <AdditionalOptions>
          <SignUpPrompt>
            Don&apos;t have an account? <a href="/createaccount">Sign up</a>
          </SignUpPrompt>
        </AdditionalOptions>
      </Container>
    </>
  );
};

export default LoginPage;