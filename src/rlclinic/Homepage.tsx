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
          <NavItem onClick={() => router.push("/createaccount")}>Create Account</NavItem>
        </Nav>
        <MobileMenuIcon>☰</MobileMenuIcon>
      </Header>

      {/* 🔸 HERO SECTION */}
      <HeroSection>
        <HeroContent>
          <h1>Caring for Pets, Caring for You</h1>
          <p>
            FurSureCare helps you manage pet records, appointments, and health
            with ease. Because your pets deserve the best. 🐶🐱
          </p>
          <HeroButton onClick={() => router.push("/createaccount")}>
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
        <SectionTitle>Why Choose FurSureCare?</SectionTitle>
        <CardContainer>
          <Card>
            <CardIcon>📋</CardIcon>
            <h3>Easy Records</h3>
            <p>Track pet vaccinations, medical history, and more in one place.</p>
          </Card>
          <Card>
            <CardIcon>📅</CardIcon>
            <h3>Quick Appointments</h3>
            <p>Schedule vet visits and never miss an important check-up.</p>
          </Card>
          <Card>
            <CardIcon>❤️</CardIcon>
            <h3>Pet Wellness</h3>
            <p>Stay updated on your pet&apos;s health and care reminders.</p>
          </Card>
        </CardContainer>
      </InfoSection>

      {/* 🔸 TESTIMONIAL SECTION */}
      <TestimonialSection>
        <SectionTitle>What Pet Owners Say</SectionTitle>
        <TestimonialContainer>
          <Testimonial>
            <TestimonialText>
              &quot;FurSureCare made managing my two dogs&apos; health records so much easier. The reminder system is fantastic!&quot;
            </TestimonialText>
            <TestimonialAuthor>- Maria S.</TestimonialAuthor>
          </Testimonial>
          <Testimonial>
            <TestimonialText>
              &quot;As a first-time pet owner, this platform helped me stay on top of vaccinations and appointments. Highly recommend!&quot;
            </TestimonialText>
            <TestimonialAuthor>- James T.</TestimonialAuthor>
          </Testimonial>
        </TestimonialContainer>
      </TestimonialSection>

      {/* 🔸 CTA SECTION */}
      <CTASection>
        <CTAContent>
          <h2>Ready to give your pet the best care?</h2>
          <p>Join thousands of pet owners who trust FurSureCare</p>
          <CtaButton onClick={() => router.push("/register")}>
            Create Account
          </CtaButton>
        </CTAContent>
      </CTASection>

      {/* 🔸 FOOTER */}
      <Footer>
        <FooterContent>
          <FooterSection>
            <h3>FurSureCare</h3>
            <p>Providing exceptional care for your beloved pets since 2025.</p>
          </FooterSection>
          <FooterSection>
            <h4>Quick Links</h4>
            <FooterLink onClick={() => router.push("/login")}>Login</FooterLink>
            <FooterLink onClick={() => router.push("/register")}>Register</FooterLink>
            <FooterLink>Services</FooterLink>
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

/* 🎨 Styled Components */
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f7f7f7;
`;

const Header = styled.header`
  width: 100%;
  padding: 1rem 2rem;
  background: #20c997;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  box-shadow: 0 3px 6px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Logo = styled.h2`
  font-size: 1.6rem;
  font-weight: bold;
  cursor: pointer;

  @media (max-width: 480px) {
    font-size: 1.4rem;
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
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const HeroSection = styled.section`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-around;
  padding: 4rem 2rem;
  background: #e6f7f4;
  min-height: 80vh;

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    padding: 2rem 1rem;
    min-height: auto;
  }
`;

const HeroContent = styled.div`
  max-width: 550px;
  margin: 0 2rem;

  h1 {
    font-size: 3rem;
    color: #20c997;
    margin-bottom: 1.5rem;

    @media (max-width: 1024px) {
      font-size: 2.5rem;
    }

    @media (max-width: 768px) {
      font-size: 2rem;
    }

    @media (max-width: 480px) {
      font-size: 1.8rem;
    }
  }

  p {
    margin: 1.5rem 0;
    font-size: 1.2rem;
    color: #444;
    line-height: 1.6;

    @media (max-width: 768px) {
      font-size: 1.1rem;
    }
  }

  @media (max-width: 768px) {
    margin: 0 1rem 2rem 1rem;
  }
`;

const HeroButton = styled.button`
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border: none;
  background: #20c997;
  color: white;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  margin-top: 1rem;

  &:hover {
    background: #17a589;
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 0.9rem;
  }
`;

const HeroImage = styled.img`
  width: 100%;
  max-width: 500px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  margin: 0 1rem;

  @media (max-width: 768px) {
    max-width: 90%;
    margin-top: 2rem;
  }
`;

const SectionTitle = styled.h2`
  text-align: center;
  font-size: 2.5rem;
  color: #20c997;
  margin-bottom: 3rem;

  @media (max-width: 768px) {
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  @media (max-width: 480px) {
    font-size: 1.8rem;
  }
`;

const InfoSection = styled.section`
  padding: 5rem 2rem;
  background: #fff;

  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
`;

const CardContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #f9fdfd;
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  max-width: 350px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0,0,0,0.08);
  transition: transform 0.3s ease;

  h3 {
    margin: 1rem 0;
    color: #20c997;
    font-size: 1.4rem;
  }

  p {
    color: #555;
    font-size: 1rem;
    line-height: 1.5;
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
  }

  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const CardIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const TestimonialSection = styled.section`
  padding: 5rem 2rem;
  background: #e6f7f4;

  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
`;

const TestimonialContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Testimonial = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.08);
`;

const TestimonialText = styled.p`
  font-style: italic;
  color: #555;
  line-height: 1.6;
  margin-bottom: 1rem;
`;

const TestimonialAuthor = styled.p`
  font-weight: 600;
  color: #20c997;
  text-align: right;
`;

const CTASection = styled.section`
  padding: 5rem 2rem;
  background: #20c997;
  color: white;
  text-align: center;

  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
`;

const CTAContent = styled.div`
  max-width: 800px;
  margin: 0 auto;

  h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;

    @media (max-width: 768px) {
      font-size: 2rem;
    }

    @media (max-width: 480px) {
      font-size: 1.8rem;
    }
  }

  p {
    font-size: 1.2rem;
    margin-bottom: 2rem;

    @media (max-width: 480px) {
      font-size: 1.1rem;
    }
  }
`;

const CtaButton = styled.button`
  padding: 1rem 2.5rem;
  font-size: 1.2rem;
  border: 2px solid white;
  background: transparent;
  color: white;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    background: white;
    color: #20c997;
    transform: scale(1.05);
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 0.9rem;
  }
`;

const Footer = styled.footer`
  background: #1a1a1a;
  color: white;
  padding: 2rem 0 0;
`;

const FooterContent = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem 2rem;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 2rem;
  }
`;

const FooterSection = styled.div`
  max-width: 300px;

  h3, h4 {
    margin-bottom: 1rem;
    color: #20c997;
  }

  p {
    line-height: 1.6;
    color: #ccc;
  }
`;

const FooterLink = styled.p`
  cursor: pointer;
  margin: 0.5rem 0;
  color: #ccc;
  transition: color 0.3s ease;

  &:hover {
    color: #20c997;
  }
`;

const Copyright = styled.div`
  text-align: center;
  padding: 1.5rem;
  border-top: 1px solid #333;
  background: #151515;

  p {
    color: #999;
    font-size: 0.9rem;
  }
`;