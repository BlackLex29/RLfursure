"use client";

import React from "react";
import styled from "styled-components";
import { useRouter } from "next/navigation";

const HomePage: React.FC = () => {
  const router = useRouter();

  return (
    <PageContainer>
      {/* 🔸 HEADER */}
      <Header>
        <Logo>🐾 FurSureCare</Logo>
        <Nav>
          <NavItem onClick={() => router.push("/login")}>Login</NavItem>
          <NavItem onClick={() => router.push("/register")}>Register</NavItem>
        </Nav>
      </Header>

      {/* 🔸 HERO SECTION */}
      <HeroSection>
        <HeroContent>
          <h1>Caring for Pets, Caring for You</h1>
          <p>
            FurSureCare helps you manage pet records, appointments, and health
            with ease. Because your pets deserve the best. 🐶🐱
          </p>
          <HeroButton onClick={() => router.push("/register")}>
            Get Started   
          </HeroButton>
        </HeroContent>

        {/* 🔸 CLINIC IMAGE */}
        <HeroImage
          src="https://scontent.fmnl8-1.fna.fbcdn.net/v/t39.30808-1/308051699_1043145306431767_6902051210877649285_n.jpg?stp=dst-jpg_s200x200_tt6&_nc_cat=108&ccb=1-7&_nc_sid=2d3e12&_nc_eui2=AeH7C3PaObQLeqOOxA3pTYw1U6XSiAPBS_lTpdKIA8FL-aWJ6pOqX-tCsYAmdUOHVzzxg-T9gjpVH_1PkEO0urYZ&_nc_ohc=p4CUMMcyVlMQ7kNvwHiikDY&_nc_oc=AdnPzJ3JDHpSe07jtsiwsYvYwYvymuX8WMRdq-ip91wsuoP6O_8YwwRaYvGrUKCZvLs&_nc_zt=24&_nc_ht=scontent.fmnl8-1.fna&_nc_gid=a9hod7DgRMOAkMadWZ2krw&oh=00_AfVc5rGqwtssY008DrPlZTLfwRITL0Td2QaofcDbdtovzA&oe=68B017DB"
          alt="Vet Clinic"
        />
      </HeroSection>

      {/* 🔸 INFO SECTION */}
      <InfoSection>
        <Card>
          <h3>📋 Easy Records</h3>
          <p>Track pet vaccinations, medical history, and more in one place.</p>
        </Card>
        <Card>
          <h3>📅 Quick Appointments</h3>
          <p>Schedule vet visits and never miss an important check-up.</p>
        </Card>
        <Card>
          <h3>❤️ Pet Wellness</h3>
          <p>Stay updated on your pet’s health and care reminders.</p>
        </Card>
      </InfoSection>

      {/* 🔸 FOOTER */}
      <Footer>
        <p>© 2025 FurSureCare Veterinary Clinic. All Rights Reserved.</p>
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
  background: #f7f7f7; /* light gray background tulad ng login */
`;

const Header = styled.header`
  width: 100%;
  padding: 1rem 2rem;
  background: #20c997; /* teal color */
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  box-shadow: 0 3px 6px rgba(0,0,0,0.1);
`;

const Logo = styled.h2`
  font-size: 1.6rem;
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-around;
  padding: 3rem 2rem;
  background: #e6f7f4; /* light teal background */
`;

const HeroContent = styled.div`
  max-width: 480px;

  h1 {
    font-size: 2.8rem;
    color: #20c997;
  }

  p {
    margin: 1.2rem 0;
    font-size: 1.1rem;
    color: #444;
  }
`;

const HeroButton = styled.button`
  padding: 0.9rem 1.6rem;
  font-size: 1rem;
  border: none;
  background: #20c997;
  color: white;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  &:hover {
    background: #17a589;
    transform: scale(1.05);
  }
`;

const HeroImage = styled.img`
  width: 420px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
`;

const InfoSection = styled.section`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  padding: 3rem 2rem;
  background: #fff;
`;

const Card = styled.div`
  background: #f9fdfd;
  border-radius: 16px;
  padding: 1.5rem;
  width: 280px;
  text-align: center;
  box-shadow: 0 3px 8px rgba(0,0,0,0.1);

  h3 {
    margin-bottom: 0.8rem;
    color: #20c997;
  }

  p {
    color: #444;
    font-size: 0.95rem;
  }
`;

const Footer = styled.footer`
  background: #20c997;
  padding: 1rem;
  text-align: center;
  color: white;
  font-size: 0.9rem;
`;
