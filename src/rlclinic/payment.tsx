"use client";

import React, { useState } from "react";
import styled from "styled-components";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const PaymentPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online" | "">("");

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
    }
  };

  return (
    <Wrapper>
      <Card>
        <Header>
          <Title>Payment Method</Title>
        </Header>
        <Form onSubmit={handlePaymentSubmit}>
          <OptionWrapper>
            <RadioLabel>
              <input
                type="radio"
                name="payment"
                value="Cash"
                checked={paymentMethod === "Cash"}
                onChange={() => setPaymentMethod("Cash")}
              />
              Cash
            </RadioLabel>

            <RadioLabel>
              <input
                type="radio"
                name="payment"
                value="Online"
                checked={paymentMethod === "Online"}
                onChange={() => setPaymentMethod("Online")}
              />
              Online Payment
            </RadioLabel>
          </OptionWrapper>

          <Button type="submit">Proceed</Button>
        </Form>
      </Card>
    </Wrapper>
  );
};

export default PaymentPage;

// Styled Components
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: linear-gradient(160deg, #ff5e62 0%, #ff9966 100%);
  padding: 60px 20px;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  animation: slideIn 0.5s ease;
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Header = styled.div`
  background: linear-gradient(90deg, #ff5e62, #ff9966);
  padding: 25px 20px;
  text-align: center;
`;

const Title = styled.h2`
  color: white;
  font-size: 28px;
  font-weight: 700;
`;

const Form = styled.form``;

const OptionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 40px 20px;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 500;
  input {
    transform: scale(1.4);
    accent-color: #ff5e62;
    cursor: pointer;
  }
`;

const Button = styled.button`
  display: block;
  width: calc(100% - 40px);
  margin: 20px auto 30px auto;
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(90deg, #ff5e62, #ff9966);
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    opacity: 0.85;
  }
`;
