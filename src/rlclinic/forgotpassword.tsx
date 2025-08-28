"use client";
import React, { useState } from "react";
import styled, { keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebaseConfig";

const ForgotPassword: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!email) {
      setMessage({ text: "Please enter your email.", success: false });
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage({ 
        text: `Password reset link sent to ${email}. Check your inbox and spam folder.`, 
        success: true 
      });
      
      // Clear the form
      setEmail("");
      
      // Redirect after delay
      setTimeout(() => {
        router.push("/login");
      }, 4000);
    } catch (err: unknown) {
      let errorMessage = "Something went wrong. Please try again.";
      
      if (err instanceof Error) {
        // Handle specific Firebase error codes
        if (err.message.includes("auth/user-not-found")) {
          errorMessage = "No account found with this email address.";
        } else if (err.message.includes("auth/invalid-email")) {
          errorMessage = "Invalid email address format.";
        } else if (err.message.includes("auth/too-many-requests")) {
          errorMessage = "Too many attempts. Please try again later.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setMessage({ text: errorMessage, success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Logo>
          <i className="fas fa-lock"></i>
        </Logo>
        <Title>Forgot Password</Title>
        <Subtitle>Enter your email to reset your password</Subtitle>
        
        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Icon className="fas fa-envelope"></Icon>
          </InputGroup>
          
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </Form>
        
        {message && (
          <Message success={message.success}>
            <i className={message.success ? "fas fa-check-circle" : "fas fa-exclamation-circle"}></i>
            {message.text}
          </Message>
        )}
        
        <BackLink onClick={() => router.push("/login")}>
          <i className="fas fa-arrow-left"></i> Back to Login
        </BackLink>
      </Card>
    </Wrapper>
  );
};

export default ForgotPassword;

// Styled Components with animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f4f7fb 0%, #e3e6f0 100%);
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  padding: 40px;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  animation: ${fadeIn} 0.5s ease;
`;

const Logo = styled.div`
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, royalblue 0%, dodgerblue 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  
  i {
    font-size: 28px;
    color: white;
  }
`;

const Title = styled.h2`
  margin-bottom: 8px;
  color: #333;
  font-weight: 600;
`;

const Subtitle = styled.p`
  color: #666;
  margin-bottom: 25px;
  font-size: 14px;
`;

const Form = styled.form`
  width: 100%;
`;

const InputGroup = styled.div`
  position: relative;
  margin-bottom: 20px;
`;

const Input = styled.input`
  width: 100%;
  padding: 14px 14px 14px 40px;
  border-radius: 10px;
  border: 1px solid #ddd;
  font-size: 14px;
  transition: all 0.3s;
  
  &:focus {
    outline: none;
    border-color: royalblue;
    box-shadow: 0 0 0 3px rgba(65, 105, 225, 0.1);
  }
  
  &:disabled {
    background-color: #f9f9f9;
    cursor: not-allowed;
  }
`;

const Icon = styled.i`
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 14px;
`;

const Button = styled.button`
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, royalblue 0%, dodgerblue 100%);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s;
  
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #4a69d9 0%, #1e90ff 100%);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(65, 105, 225, 0.3);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: ${spin} 0.8s ease infinite;
`;

const Message = styled.div<{ success?: boolean }>`
  margin-top: 20px;
  padding: 12px;
  border-radius: 10px;
  background: ${props => props.success ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)'};
  color: ${props => props.success ? '#27ae60' : '#e74c3c'};
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: left;
  
  i {
    font-size: 16px;
    flex-shrink: 0;
  }
`;

const BackLink = styled.div`
  margin-top: 20px;
  color: royalblue;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.3s;
  
  &:hover {
    color: #4a69d9;
  }
`;