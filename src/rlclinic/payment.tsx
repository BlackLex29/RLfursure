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
          <Title>Choose Payment Method</Title>
          <Subtitle>Please select your preferred option</Subtitle>
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

export default PaymentForm;

// 🌈 Styled Components – pang USER design
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: linear-gradient(160deg, #36d1dc 0%, #5b86e5 100%);
  padding: 60px 20px;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 22px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
  overflow: hidden;
  animation: fadeIn 0.5s ease;
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const Header = styled.div`
  background: linear-gradient(90deg, #36d1dc, #5b86e5);
  padding: 25px 20px;
  text-align: center;
`;

const Title = styled.h2`
  color: white;
  font-size: 26px;
  font-weight: 700;
  margin: 0;
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  margin-top: 6px;
`;

const Form = styled.form``;

const OptionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 40px 20px;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 500;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid #dfe6f0;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: #f3f7fc;
  }

  input {
    transform: scale(1.4);
    accent-color: #5b86e5;
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
  background: linear-gradient(90deg, #36d1dc, #5b86e5);
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
`;
