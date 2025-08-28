'use client';

import React, { useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  AuthError,
  updateProfile
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

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  gap: 12px;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const InputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const Input = styled.input`
  padding: 14px;
  border: 2px solid #ddd;
  border-radius: 9px;
  font-size: 16px;
  transition: all 0.3s ease;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #34b89c;
    box-shadow: 0 2px 8px rgba(52, 184, 156, 0.3);
  }
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #777;
  font-size: 14px;
`;

const Button = styled.button`
  width: 100%;
  background-color: #34b89c;
  color: white;
  font-weight: 600;
  font-size: 16px;
  padding: 14px;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;

  &:hover:not(:disabled) {
    background-color: #2a9d84;
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
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
  background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZ�lsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMTcuNiA5LjJsLS4xLTEuOEg5djMuNGg0LjhDMTMuNiAxMiAxMyAxMyAxMiAxMy42djIuMmgtM2E4LjggOC44IDAgMCAwIDIuNi02LjZ6IiBmaWxsPSIjNDI4NUY0IiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNOSAxOGMyLjQgMCA0LjUtLjggNi0yLjJsLTMtMi4yYTUuNCA1LjQgMCAwIDEtOC0yLjlIMVYxM2E5IDkgMCAwIDAgOCA1eiIgZmlsbD0iIzM0QTg1MyIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTQgMTAuN2E1LjQgNS40IDAgMCAxIDAtMy40VjVIMWE5IDkgMCAwIDAgMCA4bDMtMi4zeiIgZmlsbD0iI0ZCQkMwNSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTkgMy42YzEuMyAwIDIuNS40IDMuNCAxLjNMMTUgMi4zQTkgOSAwIDAgMCAxIDVsMyAyLjRhNS40IDUuNCAwIDAgMSA1LTMuN3oiIGZpbGw9IiNFQTQzMzUiIGZpbGwtcnVsZT0ibm9uemVybyIvPjxwYXRoIGQ9Ik0wIDBoMTh2MThIMHoiLz48L2c+PC9zdmc+') center no-repeat;
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

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
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

export const Create = () => {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Validation
    if (!formData.firstname || !formData.lastname || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("All fields are required");
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (formData.password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }
    
    setLoading(true);
    
    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      const user = userCredential.user;
      
      // Update user profile with first and last name
      await updateProfile(user, {
        displayName: `${formData.firstname} ${formData.lastname}`
      });
      
      // Check if user already exists in Firestore (just in case)
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
          firstname: formData.firstname,
          lastname: formData.lastname,
          email: formData.email,
          role: "user",
          createdAt: new Date().toISOString(),
          provider: "email",
          lastLogin: new Date().toISOString()
        });
      }
      
      setSuccess("Account created successfully!");
      
      // Redirect to pet registration with user data as query params
      router.push(`/petregister?firstname=${encodeURIComponent(formData.firstname)}&lastname=${encodeURIComponent(formData.lastname)}&email=${encodeURIComponent(formData.email)}`);
    } catch (err: unknown) {
      console.error("Email sign up error:", err);
      
      // Handle specific error cases with proper type checking
      if (isAuthError(err)) {
        if (err.code === 'auth/email-already-in-use') {
          setError("This email is already registered. Please sign in instead.");
        } else if (err.code === 'auth/invalid-email') {
          setError("Invalid email address format.");
        } else if (err.code === 'auth/weak-password') {
          setError("Password is too weak. Please choose a stronger password.");
        } else {
          setError(err.message || "Failed to create account. Please try again.");
        }
      } else if (err instanceof Error) {
        setError(err.message || "Failed to create account. Please try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
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
          lastLogin: new Date().toISOString()
        });
        
        setSuccess("Account created successfully!");
        
        // Redirect to pet registration with user data as query params
        router.push(`/petregister?firstname=${encodeURIComponent(firstname)}&lastname=${encodeURIComponent(lastname)}&email=${encodeURIComponent(user.email || "")}`);
      } else {
        // User already exists, redirect to dashboard
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
          <Subtitle>Sign up to get started with our services</Subtitle>
          
          <Form onSubmit={handleEmailSignUp}>
            <InputGroup>
              <InputContainer>
                <Input
                  type="text"
                  name="firstname"
                  placeholder="First Name"
                  value={formData.firstname}
                  onChange={handleInputChange}
                  required
                />
              </InputContainer>
              <InputContainer>
                <Input
                  type="text"
                  name="lastname"
                  placeholder="Last Name"
                  value={formData.lastname}
                  onChange={handleInputChange}
                  required
                />
              </InputContainer>
            </InputGroup>
            
            <InputContainer>
              <Input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </InputContainer>
            
            <InputContainer>
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              <PasswordToggle type="button" onClick={togglePasswordVisibility}>
                {showPassword ? "Hide" : "Show"}
              </PasswordToggle>
            </InputContainer>
            
            <InputContainer>
              <Input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
              <PasswordToggle type="button" onClick={toggleConfirmPasswordVisibility}>
                {showConfirmPassword ? "Hide" : "Show"}
              </PasswordToggle>
            </InputContainer>
            
            <Button type="submit" disabled={loading}>
              {loading && <LoadingSpinner />}
              {loading ? "Creating Account..." : "Register"}
            </Button>
          </Form>

          <Divider>
            <DividerText>Or</DividerText>
          </Divider>
          
          <GoogleButton onClick={handleGoogleSignUp} disabled={loading}>
            {loading && <LoadingSpinner />}
            <GoogleIcon />
            {loading ? "Processing..." : "Sign up with Google"}
          </GoogleButton>

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
export default Create;