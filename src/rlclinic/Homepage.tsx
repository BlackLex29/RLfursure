"use client";

import React from "react";
import styled from "styled-components";
import { useRouter } from "next/navigation";

const HomePage: React.FC = () => {
  const router = useRouter();

  return (
    <PageContainer>
      <Header>
        <Logo>FurSureCare 🐾</Logo>
        <Nav>
          <NavItem onClick={() => router.push("/login")}>Login</NavItem>
          <NavItem onClick={() => router.push("/register")}>Register</NavItem>
        </Nav>
      </Header>

      <HeroSection>
        <HeroText>
          <h1>Welcome to FurSureCare</h1>
          <p>
            Your trusted companion in managing pet records, appointments, and
            care. 🐶🐱
          </p>
          <HeroButton onClick={() => router.push("/register")}>
            Get Started
          </HeroButton>
        </HeroText>
        <HeroImage src="https://cdn-icons-png.flaticon.com/512/616/616408.png" alt="Pet Care" />
      </HeroSection>

      <Footer>
        <p>© 2025 FurSureCare. All Rights Reserved.</p>
      </Footer>
    </PageContainer>
  );
};

export default HomePage;

/* 🎨 Styled Components */
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #fefefe;
`;

const Header = styled.header`
  width: 100%;
  padding: 1rem 2rem;
  background: #ff8c42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
`;

const Logo = styled.h2`
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
`;

const Nav = styled.nav`
  display: flex;
  gap: 1.5rem;
`;

const NavItem = styled.span`
  cursor: pointer;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
`;

const HeroSection = styled.section`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 2rem;
  background: #fff4e6;
`;

const HeroText = styled.div`
  max-width: 500px;

  h1 {
    font-size: 2.5rem;
    color: #333;
  }

  p {
    margin: 1rem 0;
    font-size: 1.1rem;
    color: #555;
  }
`;

const HeroButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  border: none;
  background: #ff8c42;
  color: white;
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    background: #e6732f;
  }
`;

const HeroImage = styled.img`
  width: 300px;
  height: auto;
`;

const Footer = styled.footer`
  background: #ff8c42;
  padding: 1rem;
  text-align: center;
  color: white;
`;
