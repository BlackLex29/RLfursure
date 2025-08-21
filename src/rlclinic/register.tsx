"use client";

import React, { useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 25px;
  color: #1a1a1a;
  font-weight: 700;
  font-size: 28px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #555;
`;

const Input = styled.input`
  padding: 12px 14px;
  font-size: 15px;
  border: 2px solid #bbb;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.25s ease;

  &:focus {
    border-color: #34b89c;
    box-shadow: 0 0 6px #34b89caa;
  }
`;

const ErrorMessage = styled.p`
  color: #c0392b;
  font-size: 13px;
  margin: -10px 0 8px 0;
  font-weight: 600;
`;

const Button = styled.button`
  background-color: #34b89c;
  color: white;
  font-weight: 700;
  font-size: 17px;
  padding: 14px;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover:not(:disabled) {
    background-color: #2a8a7d;
  }

  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
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

export const Register = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ✅ Firebase Auth create user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // ✅ Firestore user document
      await setDoc(doc(db, "users", user.uid), {
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        role: "user",
        createdAt: new Date().toISOString(),
      });

      router.push("/login");
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err);
        setError(err.message || "Failed to register. Please try again.");
      } else {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred. Please try again.");
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
          <Form onSubmit={handleSubmit}>
            <InputGroup>
              <Label htmlFor="firstname">First Name</Label>
              <Input
                id="firstname"
                name="firstname"
                type="text"
                required
                value={formData.firstname}
                onChange={handleChange}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="lastname">Last Name</Label>
              <Input
                id="lastname"
                name="lastname"
                type="text"
                required
                value={formData.lastname}
                onChange={handleChange}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
              />
            </InputGroup>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <Button type="submit" disabled={loading}>
              {loading ? "Creating Account..." : "Register"}
            </Button>
          </Form>

          <RedirectText>
            Already have an account?{" "}
            <span onClick={() => router.push("/login")}>Sign in here</span>
          </RedirectText>
        </Card>
      </Wrapper>
    </>
  );
};
