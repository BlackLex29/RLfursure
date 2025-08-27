"use client";

import React from "react";
import styled from "styled-components";
import { useRouter } from "next/navigation";

const HomePage: React.FC = () => {
  const router = useRouter();

  return (
    <PageContainer>
      <Header>
        <Logo onClick={() => router.push("/")}>FurSureCare 🐾</Logo>
        <Nav>
          <NavItem onClick={() => router.push("/login")}>Login</NavItem>
          <NavItem onClick={() => router.push("/register")}>Register</NavItem>
        </Nav>
        <MobileMenuIcon>☰</MobileMenuIcon>
      </Header>

      <MainContent>
        <HeroSection>
          <HeroText>
            <h1>Caring for Pets, Caring for You</h1>
            <p>
              Track vaccinations, medical history, and more in one place.
            </p>
            <HeroButton onClick={() => router.push("/register")}>
              Get Started
            </HeroButton>
          </HeroText>
          <HeroImage src="https://cdn-icons-png.flaticon.com/512/616/616408.png" alt="Pet Care" />
        </HeroSection>

        <FeaturesSection>
          <SectionTitle>Our Features</SectionTitle>
          <FeaturesGrid>
            <FeatureCard>
              <FeatureIcon>📋</FeatureIcon>
              <h3>Easy Records</h3>
              <p>Track vaccinations, medical history, and more in one place.</p>
            </FeatureCard>
            
            <FeatureCard>
              <FeatureIcon>📅</FeatureIcon>
              <h3>Schedule Appointments</h3>
              <p>Schedule vet visits and never miss an important check-up.</p>
            </FeatureCard>
            
            <FeatureCard>
              <FeatureIcon>🔔</FeatureIcon>
              <h3>Pet Wellness</h3>
              <p>Stay updated on your pet&apos;s health and care reminders.</p>
            </FeatureCard>
          </FeaturesGrid>
        </FeaturesSection>

        <TestimonialSection>
          <SectionTitle>What Pet Owners Say</SectionTitle>
          <TestimonialGrid>
            <TestimonialCard>
              <TestimonialText>
                &quot;FurSureCare made managing my dog&apos;s medical records so much easier. The reminder system is a lifesaver!&quot;
              </TestimonialText>
              <TestimonialAuthor>- Maria S.</TestimonialAuthor>
            </TestimonialCard>
            <TestimonialCard>
              <TestimonialText>
                &quot;I love how I can access my cat&apos;s vaccination history from my phone during vet visits. Highly recommend!&quot;
              </TestimonialText>
              <TestimonialAuthor>- James T.</TestimonialAuthor>
            </TestimonialCard>
          </TestimonialGrid>
        </TestimonialSection>
      </MainContent>

      <Footer>
        <FooterContent>
          <FooterSection>
            <h4>FurSureCare</h4>
            <p>Comprehensive pet care management for your furry family members.</p>
          </FooterSection>
          <FooterSection>
            <h4>Quick Links</h4>
            <FooterLink onClick={() => router.push("/login")}>Login</FooterLink>
            <FooterLink onClick={() => router.push("/register")}>Register</FooterLink>
            <FooterLink onClick={() => router.push("/about")}>About Us</FooterLink>
          </FooterSection>
          <FooterSection>
            <h4>Contact Us</h4>
            <p>Email: info@fursurecare.com</p>
            <p>Phone: (123) 456-7890</p>
          </FooterSection>
        </FooterContent>
        <Copyright>
          <p>© 2025 FurSureCare Veterinary Clinic. All Rights Reserved.</p>
        </Copyright>
      </Footer>
    </PageContainer>
  );
};

export default HomePage;

/* 🎨 Enhanced Styled Components */
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #fefefe;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const Header = styled.header`
  width: 100%;
  padding: 1rem 2rem;
  background: #ff8c42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Logo = styled.h2`
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  margin: 0;

  @media (max-width: 480px) {
    font-size: 1.2rem;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 1.5rem;

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileMenuIcon = styled.div`
  display: none;
  font-size: 1.5rem;
  cursor: pointer;

  @media (max-width: 768px) {
    display: block;
  }
`;

const NavItem = styled.span`
  cursor: pointer;
  font-weight: 500;
  padding: 0.5rem;
  border-radius: 5px;
  transition: background-color 0.3s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const MainContent = styled.div`
  flex: 1;
`;

const HeroSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, #fff4e6 0%, #ffe4d1 100%);
  min-height: 80vh;

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    padding: 2rem 1rem;
    min-height: auto;
  }
`;

const HeroText = styled.div`
  max-width: 500px;

  h1 {
    font-size: 2.5rem;
    color: #333;
    margin-bottom: 1rem;
    line-height: 1.2;

    @media (max-width: 768px) {
      font-size: 2rem;
    }

    @media (max-width: 480px) {
      font-size: 1.8rem;
    }
  }

  p {
    margin: 1rem 0;
    font-size: 1.1rem;
    color: #555;
    line-height: 1.6;

    @media (max-width: 480px) {
      font-size: 1rem;
    }
  }
`;

const HeroButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  border: none;
  background: #ff8c42;
  color: white;
  border-radius: 30px;
  cursor: pointer;
  margin-top: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(255, 140, 66, 0.3);
  
  &:hover {
    background: #e6732f;
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(255, 140, 66, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const HeroImage = styled.img`
  width: 100%;
  max-width: 400px;
  height: auto;

  @media (max-width: 768px) {
    margin-top: 2rem;
    max-width: 300px;
  }

  @media (max-width: 480px) {
    max-width: 250px;
  }
`;

const SectionTitle = styled.h2`
  text-align: center;
  font-size: 2rem;
  color: #333;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    font-size: 1.8rem;
  }
`;

const FeaturesSection = styled.section`
  padding: 4rem 2rem;
  background: #fff;

  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const FeatureCard = styled.div`
  text-align: center;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  background: white;

  &:hover {
    transform: translateY(-10px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  }

  h3 {
    margin: 1rem 0;
    color: #333;
    font-size: 1.3rem;
  }

  p {
    color: #666;
    line-height: 1.6;
  }
`;

const FeatureIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const TestimonialSection = styled.section`
  padding: 4rem 2rem;
  background: #f8f9fa;

  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
`;

const TestimonialGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const TestimonialCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
`;

const TestimonialText = styled.p`
  font-style: italic;
  color: #555;
  line-height: 1.6;
  margin-bottom: 1rem;
`;

const TestimonialAuthor = styled.p`
  font-weight: 600;
  color: #ff8c42;
  text-align: right;
`;

const Footer = styled.footer`
  background: #ff8c42;
  color: white;
  padding: 2rem 0 0;
`;

const FooterContent = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  padding: 0 2rem;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 0 1rem;
  }
`;

const FooterSection = styled.div`
  h4 {
    margin-bottom: 1rem;
    font-size: 1.2rem;
  }

  p {
    line-height: 1.6;
  }
`;

const FooterLink = styled.p`
  cursor: pointer;
  margin-bottom: 0.5rem;
  transition: opacity 0.3s;

  &:hover {
    opacity: 0.8;
  }
`;

const Copyright = styled.div`
  text-align: center;
  padding: 1rem;
  margin-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);

  p {
    margin: 0;
  }
`;