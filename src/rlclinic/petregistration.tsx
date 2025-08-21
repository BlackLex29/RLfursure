"use client";
import React, { useState } from "react";
import styled from "styled-components";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const Petregister: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  const [petName, setPetName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [color, setColor] = useState("");
  const [petType, setPetType] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");

  const petOwner = auth.currentUser?.email || "Unknown";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) {
      alert("No appointment linked!");
      return;
    }
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        petName,
        birthday,
        color,
        petType,
        petBreed,
        gender,
        petOwner,
        status: "Pet Registered",
      });
      alert("Pet registration completed!");
      
      // 🔹 Redirect to Payment page
      router.push(`/payment?appointmentId=${appointmentId}`);
    } catch (error) {
      console.error("Error updating appointment:", error);
      alert("Failed to update appointment.");
    }
  };

  return (
    <Wrapper>
      <Card>
        <Header>
          <Title>Pet Registration</Title>
        </Header>
        <form onSubmit={handleSubmit}>
          <Label>
            <Input type="text" value={petOwner} readOnly />
            <Span>Pet Owner</Span>
          </Label>

          <Label>
            <Input
              required
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
            />
            <Span>Pet Name</Span>
          </Label>

          <Label>
            <Input
              required
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
            <Span>Date of Birth</Span>
          </Label>

          <Label>
            <Input
              required
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <Span>Color</Span>
          </Label>

          <Label>
            <Input
              required
              type="text"
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
            />
            <Span>Pet Type</Span>
          </Label>

          <Label>
            <Input
              required
              type="text"
              value={petBreed}
              onChange={(e) => setPetBreed(e.target.value)}
            />
            <Span>Pet Breed</Span>
          </Label>

          <GenderWrapper>
            <GenderLabel>
              <Radio
                type="radio"
                name="gender"
                value="male"
                checked={gender === "male"}
                onChange={() => setGender("male")}
              />
              Male
            </GenderLabel>
            <GenderLabel>
              <Radio
                type="radio"
                name="gender"
                value="female"
                checked={gender === "female"}
                onChange={() => setGender("female")}
              />
              Female
            </GenderLabel>
          </GenderWrapper>

          <Button type="submit">Register Pet</Button>
        </form>
      </Card>
    </Wrapper>
  );
};

export default Petregister;

// 🔹 Styled Components
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: linear-gradient(160deg, #6bc1e1 0%, #34b89c 100%);
  padding: 60px 20px;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 500px;
  overflow: hidden;
  animation: slideIn 0.5s ease;
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(30px);}
    to { opacity: 1; transform: translateY(0);}
  }
`;

const Header = styled.div`
  background: linear-gradient(90deg, #0077ff, #00c6ff);
  padding: 25px 20px;
  text-align: center;
`;

const Title = styled.h2`
  color: white;
  font-size: 28px;
  font-weight: 700;
`;

const Label = styled.label`
  position: relative;
  display: block;
  margin: 18px 20px;
`;

const Input = styled.input`
  width: 100%;
  padding: 14px 12px;
  border-radius: 12px;
  border: 1px solid #ccc;
  outline: none;
  background: #f1f8ff;
  font-size: 15px;
  &:focus {
    border-color: #0077ff;
    background: #fff;
  }
  &:focus + span,
  &:not(:placeholder-shown) + span {
    top: -8px;
    left: 10px;
    font-size: 12px;
    color: #0077ff;
    font-weight: 600;
  }
`;

const Span = styled.span`
  position: absolute;
  left: 12px;
  top: 14px;
  color: #555;
  font-size: 14px;
  pointer-events: none;
  transition: all 0.3s ease;
`;

const GenderWrapper = styled.div`
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
`;

const GenderLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 15px;
`;

const Radio = styled.input`
  transform: scale(1.3);
  accent-color: #0077ff;
`;

const Button = styled.button`
  display: block;
  width: calc(100% - 40px);
  margin: 20px auto 30px auto;
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: #0077ff;
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background: #005ecc;
  }
`;
