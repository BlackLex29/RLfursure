"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styled from "styled-components";
import { db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const PaymentForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online" | "">("");

  // Auto redirect kung walang appointmentId
  useEffect(() => {
    if (!appointmentId) {
      alert("No appointment selected.");
      router.push("/userdashboard");
    }
  }, [appointmentId, router]);

  if (!appointmentId) return null; // Avoid render flicker

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod) {
      alert("Please select a payment method.");
      return;
    }

    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        paymentMethod,
        status: "Payment Completed",
      });

      alert(`Payment method ${paymentMethod} saved!`);

      if (paymentMethod === "Cash") router.push("/userdashboard");
      else router.push("/online-payment");
    } catch (err) {
      console.error(err);
      alert("Failed to save payment method.");
    }
  };

  return (
    <Wrapper>
      <Card>
        <Header>Payment Method</Header>
        <Form onSubmit={handleSubmit}>
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
`;

const Header = styled.h2`
  text-align: center;
  color: #ffffff;
  background: linear-gradient(90deg, #ff5e62, #ff9966);
  padding: 25px 0;
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
  &:hover {
    opacity: 0.85;
  }
`;
