"use client";

import React, { useState } from "react";
import styled from "styled-components";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const PaymentForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!appointmentId) {
      alert("No appointment linked!");
      return;
    }
    if (!paymentMethod) {
      alert("Please select a payment method.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        paymentMethod,
        status: "Payment Completed",
      });

      alert(`Payment method ${paymentMethod} saved successfully!`);

      if (paymentMethod === "Cash") {
        router.push("/userdashboard");
      } else {
        router.push("/online-payment");
      }
    } catch (error) {
      console.error("Error saving payment method:", error);
      alert("Failed to save payment method.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Header>
          <HeaderIcon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
              <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
            </svg>
          </HeaderIcon>
          <Title>Choose Payment Method</Title>
          <Subtitle>Please select your preferred option</Subtitle>
        </Header>
        
        <Form onSubmit={handlePaymentSubmit}>
          <OptionWrapper>
            <RadioLabel selected={paymentMethod === "Cash"}>
              <RadioInput
                type="radio"
                name="payment"
                value="Cash"
                checked={paymentMethod === "Cash"}
                onChange={() => setPaymentMethod("Cash")}
              />
              <PaymentOption>
                <PaymentIcon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                    <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 14.625v-9.75zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM18.75 9a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V9.75a.75.75 0 00-.75-.75h-.008zM4.5 9.75A.75.75 0 015.25 9h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" clipRule="evenodd" />
                  </svg>
                </PaymentIcon>
                <PaymentText>
                  <PaymentTitle>Cash Payment</PaymentTitle>
                  <PaymentDescription>Pay with cash at the clinic</PaymentDescription>
                </PaymentText>
              </PaymentOption>
            </RadioLabel>

            <RadioLabel selected={paymentMethod === "Online"}>
              <RadioInput
                type="radio"
                name="payment"
                value="Online"
                checked={paymentMethod === "Online"}
                onChange={() => setPaymentMethod("Online")}
              />
              <PaymentOption>
                <PaymentIcon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1.5a.75.75 0 01.75.75V4.5a.75.75 0 01-1.5 0V2.25A.75.75 0 0112 1.5zM5.636 4.136a.75.75 0 011.06 0l1.592 1.591a.75.75 0 01-1.061 1.06l-1.591-1.59a.75.75 0 010-1.061zm12.728 0a.75.75 0 010 1.06l-1.591 1.592a.75.75 0 01-1.06-1.061l1.59-1.591a.75.75 0 011.061 0zm-6.816 4.496a.75.75 0 01.82.311l5.228 7.917a.75.75 0 01-.777 1.148l-2.097-.43 1.045 3.9a.75.75 0 01-1.45.388l-1.044-3.899-1.601 1.42a.75.75 0 01-1.247-.606l.569-9.47a.75.75 0 01.554-.68zM3 10.5a.75.75 0 01.75-.75H6a.75.75 0 010 1.5H3.75A.75.75 0 013 10.5zm14.25 0a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H18a.75.75 0 01-.75-.75zm-8.962 3.712a.75.75 0 010 1.061l-1.592 1.591a.75.75 0 01-1.061-1.06l1.591-1.592a.75.75 0 011.06 0z" />
                  </svg>
                </PaymentIcon>
                <PaymentText>
                  <PaymentTitle>Online Payment</PaymentTitle>
                  <PaymentDescription>Pay securely with your card</PaymentDescription>
                </PaymentText>
              </PaymentOption>
            </RadioLabel>
          </OptionWrapper>

          <ButtonGroup>
            <CancelButton 
              type="button" 
              onClick={() => router.back()}
            >
              Go Back
            </CancelButton>
            <SubmitButton 
              type="submit" 
              disabled={!paymentMethod || isSubmitting}
            >
              {isSubmitting ? "Processing..." : "Proceed"}
            </SubmitButton>
          </ButtonGroup>
        </Form>
      </Card>
    </Wrapper>
  );
};

export default PaymentForm;

// 🌈 Styled Components
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(160deg, #36d1dc 0%, #5b86e5 100%);
  padding: 20px;

  @media (max-width: 768px) {
    padding: 16px;
    align-items: flex-start;
  }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 500px;
  overflow: hidden;
  animation: fadeIn 0.5s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 768px) {
    border-radius: 20px;
    max-width: 100%;
  }
`;

const Header = styled.div`
  background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
  padding: 32px 20px;
  text-align: center;
  position: relative;

  @media (max-width: 768px) {
    padding: 28px 16px;
  }
`;

const HeaderIcon = styled.div`
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    margin-bottom: 12px;
  }
`;

const Title = styled.h2`
  color: white;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;

  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const Form = styled.form`
  padding: 10px 0;
`;

const OptionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 32px 24px;

  @media (max-width: 768px) {
    margin: 24px 16px;
    gap: 12px;
  }
`;

const RadioLabel = styled.label<{ selected: boolean }>`
  display: block;
  padding: 20px;
  border-radius: 16px;
  border: 2px solid ${props => props.selected ? '#5b86e5' : '#e2e8f0'};
  background: ${props => props.selected ? '#f0f9ff' : '#ffffff'};
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;

  &:hover {
    border-color: #5b86e5;
    background: #f7fbfe;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(91, 134, 229, 0.15);
  }

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const RadioInput = styled.input`
  position: absolute;
  opacity: 0;
  cursor: pointer;
`;

const PaymentOption = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const PaymentIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

const PaymentText = styled.div`
  flex: 1;
`;

const PaymentTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const PaymentDescription = styled.div`
  font-size: 14px;
  color: #718096;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  margin: 32px 24px 24px;

  @media (max-width: 768px) {
    flex-direction: column-reverse;
    margin: 24px 16px 20px;
    gap: 12px;
  }
`;

const CancelButton = styled.button`
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  border: 2px solid #5b86e5;
  background: white;
  color: #5b86e5;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #f7f9ff;
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    padding: 14px;
  }
`;

const SubmitButton = styled.button`
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(54, 209, 220, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 14px;
  }
`;