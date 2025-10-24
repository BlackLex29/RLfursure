"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/firebaseConfig";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%);
  padding: 1rem;
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
  border-radius: 20px;
  margin: 1rem;
  box-shadow: 0 20px 40px rgba(78, 205, 196, 0.2);
  
  @media (max-width: 768px) {
    display: none;
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
  opacity: 0.1;
`;

const PanelOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.95) 0%, rgba(68, 160, 141, 0.95) 100%);
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
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ClinicName = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ClinicSubtitle = styled.p`
  font-size: 1rem;
  margin: 0;
  opacity: 0.9;
  font-weight: 400;
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const Card = styled.div`
  background: white;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 2.5rem;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  animation: ${fadeIn} 0.5s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
  text-align: center;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Subtitle = styled.p`
  color: #666;
  text-align: center;
  margin: 0 0 2rem 0;
  font-size: 1rem;
  line-height: 1.5;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const InputLabel = styled.label`
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const RequiredStar = styled.span`
  color: #e74c3c;
  font-size: 1.2rem;
`;

const Input = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 1rem 1.25rem;
  border: 2px solid ${props => props.$hasError ? '#e74c3c' : '#e1e5e9'};
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #fafbfc;
  
  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? '#e74c3c' : '#4ecdc4'};
    box-shadow: 0 0 0 4px ${props => props.$hasError ? 'rgba(231, 76, 60, 0.1)' : 'rgba(78, 205, 196, 0.1)'};
    background: white;
  }
  
  &:disabled {
    background-color: #f8f9fa;
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  &::placeholder {
    color: #a0a0a0;
  }
`;

const PasswordStrength = styled.div`
  margin-top: 0.5rem;
`;

const StrengthBar = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 0.5rem;
`;

const StrengthSegment = styled.div<{ $active: boolean; $strength: number }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: ${props => {
    if (!props.$active) return '#e1e5e9';
    switch (props.$strength) {
      case 1: return '#e74c3c';
      case 2: return '#f39c12';
      case 3: return '#f1c40f';
      case 4: return '#2ecc71';
      default: return '#e1e5e9';
    }
  }};
  transition: all 0.3s ease;
`;

const StrengthText = styled.p<{ $strength: number }>`
  font-size: 0.8rem;
  margin: 0;
  color: ${props => {
    switch (props.$strength) {
      case 1: return '#e74c3c';
      case 2: return '#f39c12';
      case 3: return '#f1c40f';
      case 4: return '#2ecc71';
      default: return '#666';
    }
  }};
  font-weight: 600;
`;

const RequirementsList = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #4ecdc4;
`;

const RequirementItem = styled.div<{ $met: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: ${props => props.$met ? '#27ae60' : '#666'};
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &::before {
    content: '${props => props.$met ? '✓' : '○'}';
    font-weight: bold;
    color: ${props => props.$met ? '#27ae60' : '#95a5a6'};
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(78, 205, 196, 0.4);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: width 0.3s ease, height 0.3s ease;
  }
  
  &:hover:not(:disabled)::after {
    width: 300px;
    height: 300px;
  }
`;

const ErrorMessage = styled.div`
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.9rem;
  background: linear-gradient(135deg, #ffeaea 0%, #ffcccc 100%);
  color: #c0392b;
  border: 1px solid #ffb8b8;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '⚠';
    font-size: 1.2rem;
  }
`;

const SuccessMessage = styled.div`
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.9rem;
  background: linear-gradient(135deg, #e8f6ef 0%, #d4edda 100%);
  color: #27ae60;
  border: 1px solid #c3e6cb;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '✅';
    font-size: 1.2rem;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  font-size: 1.125rem;
  color: #666;
  padding: 2rem;
`;

const EmailDisplay = styled.div`
  background: linear-gradient(135deg, #e8f6f3 0%, #d1f2eb 100%);
  padding: 1rem;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 2rem;
  border: 1px solid #4ecdc4;
`;

const EmailText = styled.p`
  margin: 0;
  color: #2c3e50;
  font-weight: 600;
  
  strong {
    color: #4ecdc4;
  }
`;

interface PasswordRequirements {
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const oobCode = searchParams.get("oobCode");
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Password strength calculation
  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  // Check password requirements
  const checkPasswordRequirements = (password: string): PasswordRequirements => ({
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  });

  const passwordStrength = calculatePasswordStrength(newPassword);
  const requirements = checkPasswordRequirements(newPassword);
  const allRequirementsMet = Object.values(requirements).every(requirement => requirement);

  useEffect(() => {
    if (oobCode) {
      verifyPasswordResetCode(auth, oobCode)
        .then((userEmail) => {
          setEmail(userEmail);
          setStatus("valid");
        })
        .catch((err) => {
          console.error("❌ Reset code verification failed:", err);
          setStatus("invalid");
        });
    } else {
      setStatus("invalid");
    }
  }, [oobCode]);

  async function handleReset() {
    if (!oobCode || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    
    if (!allRequirementsMet) {
      setError("Please meet all password requirements.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("success");
      
      setTimeout(() => {
        router.push("/login?resetSuccess=true");
      }, 3000);
      
    } catch (err: unknown) {
      console.error("❌ Password reset error:", err);
      if (err && typeof err === 'object' && 'code' in err) {
        if (err.code === 'auth/invalid-action-code') {
          setError("This reset link has expired or has already been used. Please request a new one.");
        } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak. Please choose a stronger password that meets all requirements.");
      } else {
        setError("Error resetting password. Please try again or request a new link.");
      }
    }
    } finally {
      setLoading(false);
    }
  }

  if (status === "verifying") {
    return (
      <Container>
        <RightPanel>
          <Card>
            <LoadingMessage>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔐</div>
              Verifying reset link...
            </LoadingMessage>
          </Card>
        </RightPanel>
      </Container>
    );
  }

  if (status === "invalid") {
    return (
      <Container>
        <RightPanel>
          <Card>
            <ErrorMessage>
              Invalid or expired reset link
            </ErrorMessage>
            <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666', lineHeight: '1.5' }}>
              This password reset link is invalid or has expired. 
              Please request a new password reset link from the login page.
            </p>
            <Button onClick={() => router.push("/login")}>
              Back to Login
            </Button>
          </Card>
        </RightPanel>
      </Container>
    );
  }

  if (status === "success") {
    return (
      <Container>
        <RightPanel>
          <Card>
            <SuccessMessage>
              Password reset successful! Redirecting to login...
            </SuccessMessage>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <p style={{ color: '#666', marginBottom: '2rem' }}>
                Your password has been successfully reset. You will be redirected to the login page shortly.
              </p>
            </div>
          </Card>
        </RightPanel>
      </Container>
    );
  }

  return (
    <Container>
      <LeftPanel>
        <PetBackground 
          src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGV0JTIwY2FyZXxlbnwwfHwwfHx8MA%3D%3D" 
          alt="Pet care background"
        />
        <PanelOverlay />
        
        <CenteredLogoSection>
          <LogoImage 
            src="https://scontent.fmnl13-4.fna.fbcdn.net/v/t39.30808-1/308051699_1043145306431767_6902051210877649285_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=108&ccb=1-7&_nc_sid=2d3e12&_nc_eui2=AeH7C3PaObQLeqOOxA3pTYw1U6XSiAPBS_lTpdKIA8FL-aWJ6pOqX-tCsYAmdUOHVzzxg-T9gjpVH_1PkEO0urYZ&_nc_ohc=HDN02MpNKCUQ7kNvwFHDNEA&_nc_oc=Adkyj-8KGLXSyRtGZDYLXHDy0BAwHJkWJ_Dp6ZfVTK_TueLGn92_GWOIIzoZ2Qe73po&_nc_zt=24&_nc_ht=scontent.fmnl13-4.fna&_nc_gid=Qy8sBvTkAlBpHY2TPmskQA&oh=00_AfceD8P4qHoaFoZIybO2nZt10Jr_3D_Do-Qet1BlD0LBDQ&oe=68EA19DB"
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
        <Card>
          <Title>Reset Your Password</Title>
          <Subtitle>
            Create a new secure password for your account
          </Subtitle>

          <EmailDisplay>
            <EmailText>
              Resetting password for: <strong>{email}</strong>
            </EmailText>
          </EmailDisplay>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <InputGroup>
            <InputLabel>
              New Password <RequiredStar>*</RequiredStar>
            </InputLabel>
            <Input
              type="password"
              placeholder="Enter new password (min. 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              $hasError={!!error && newPassword.length > 0}
            />
            
            {newPassword && (
              <PasswordStrength>
                <StrengthBar>
                  {[1, 2, 3, 4].map((segment) => (
                    <StrengthSegment 
                      key={segment}
                      $active={segment <= passwordStrength}
                      $strength={passwordStrength}
                    />
                  ))}
                </StrengthBar>
                <StrengthText $strength={passwordStrength}>
                  {passwordStrength === 0 && 'Very Weak'}
                  {passwordStrength === 1 && 'Weak'}
                  {passwordStrength === 2 && 'Fair'}
                  {passwordStrength === 3 && 'Good'}
                  {passwordStrength === 4 && 'Strong'}
                </StrengthText>
              </PasswordStrength>
            )}

            {newPassword && (
              <RequirementsList>
                <RequirementItem $met={requirements.hasMinLength}>
                  At least 8 characters long
                </RequirementItem>
                <RequirementItem $met={requirements.hasUpperCase}>
                  At least one uppercase letter (A-Z)
                </RequirementItem>
                <RequirementItem $met={requirements.hasLowerCase}>
                  At least one lowercase letter (a-z)
                </RequirementItem>
                <RequirementItem $met={requirements.hasNumber}>
                  At least one number (0-9)
                </RequirementItem>
                <RequirementItem $met={requirements.hasSpecialChar}>
                  At least one special character (!@#$%^&* etc.)
                </RequirementItem>
              </RequirementsList>
            )}
          </InputGroup>

          <InputGroup>
            <InputLabel>
              Confirm New Password <RequiredStar>*</RequiredStar>
            </InputLabel>
            <Input
              type="password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              $hasError={!!error && confirmPassword.length > 0}
            />
            
            {confirmPassword && newPassword && (
              <div style={{ 
                color: confirmPassword === newPassword ? '#27ae60' : '#e74c3c', 
                fontSize: '0.8rem', 
                fontWeight: '600',
                marginTop: '0.5rem'
              }}>
                {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </div>
            )}
          </InputGroup>

          <Button 
            onClick={handleReset} 
            disabled={loading || !allRequirementsMet || newPassword !== confirmPassword}
            style={{
              opacity: (loading || !allRequirementsMet || newPassword !== confirmPassword) ? 0.6 : 1
            }}
          >
            {loading ? (
              <>
                <span style={{ opacity: 0.7 }}>Resetting Password...</span>
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </Card>
      </RightPanel>
    </Container>
  );
}