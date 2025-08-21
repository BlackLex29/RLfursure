"use client";

import React, { useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

// 🌍 Global style
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Rozha+One&display=swap');
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Rozha One', serif;
    background-color: #f9f9f9;
  }
`;

// 🎨 Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
`;

const Logo = styled.h1`
  font-family: 'Rozha One', serif;
  font-size: 40px;
  color: #34B89C;
  margin-bottom: 20px;
`;

const Form = styled.form`
  background: #fff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
  width: 320px;
  max-width: 90%;
`;

const Label = styled.label`
  position: relative;
  display: block;
  margin-bottom: 20px;

  .input {
    width: 100%;
    padding: 14px;
    border: 2px solid #34B89C;
    border-radius: 10px;
    outline: none;
    font-size: 15px;
    background: transparent;
    transition: border-color 0.2s ease;
  }

  .input:focus {
    border-color: #2a8f78;
  }

  span {
    position: absolute;
    left: 14px;
    top: 14px;
    font-size: 14px;
    color: #888;
    background: #fff;
    padding: 0 4px;
    transition: 0.2s;
  }

  .input:focus + span,
  .input:not(:placeholder-shown) + span {
    top: -8px;
    left: 10px;
    font-size: 12px;
    color: #34B89C;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 14px;
  background-color: #34B89C;
  color: #fff;
  font-weight: bold;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s ease;
  margin-top: 10px;

  &:hover {
    background-color: #2a8f78;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.p`
  color: #ff3333;
  font-size: 14px;
  margin-top: -10px;
  margin-bottom: 10px;
`;

// 🛠️ Login Component
const LoginPage: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
        role = userData.role || "user"; // fallback to "user"
      }

      // 🚀 Route base sa role
      if (role === "admin") {
        router.push("/admindashboard");
      } else if (role === "user") {
        router.push("/userdashboard");
      } else {
        setError("No role assigned. Contact support.");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <Container>
        <Logo>FurSureCare</Logo>
        <Form onSubmit={handleSubmit}>
          {error && <ErrorText>{error}</ErrorText>}

          <Label>
            <input
              type="email"
              name="email"
              className="input"
              placeholder=" "
              value={formData.email}
              onChange={handleChange}
              required
            />
            <span>Email</span>
          </Label>

          <Label>
            <input
              type="password"
              name="password"
              className="input"
              placeholder=" "
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
            <span>Password</span>
          </Label>

          <Button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </Form>
      </Container>
    </>
  );
};

export default LoginPage;
