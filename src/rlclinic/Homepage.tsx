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
        <Logo>
          <LogoIcon>🐾</LogoIcon>
          FurSureCare
        </Logo>
        <Nav>
          <NavItem onClick={() => router.push("/login")}>Login</NavItem>
          <NavItemPrimary onClick={() => router.push("/createaccount")}>
            Create Account
          </NavItemPrimary>
        </Nav>
        <MobileMenuIcon>☰</MobileMenuIcon>
      </Header>

      {/* 🔸 HERO SECTION */}
      <HeroSection>
        <HeroContent>
          <HeroBadge>Your Local Pet Care Solution</HeroBadge>
          <h1>
            Caring for Your <GradientText>Furry Friends</GradientText>, 
            Caring for You
          </h1>
          <p>
            FurSureCare helps you manage pet records, appointments, and health
            with ease. Because your pets deserve the best care possible. 🐶🐱
          </p>
          <ButtonGroup>
            <HeroButton onClick={() => router.push("/createaccount")}>
              Get Started Today
            </HeroButton>
            <SecondaryButton onClick={() => router.push("/login")}>
              Existing Account
            </SecondaryButton>
          </ButtonGroup>
          <FeatureList>
            <FeatureItem>✓ No credit card required</FeatureItem>
            <FeatureItem>✓ Easy to use</FeatureItem>
            <FeatureItem>✓ Cancel anytime</FeatureItem>
          </FeatureList>
        </HeroContent>

        {/* 🔸 CLINIC IMAGE */}
        <ImageContainer>
          <HeroImage
            src="https://images.unsplash.com/photo-1535930749574-1399327ce78f?auto=format&fit=crop&q=80&w=1000"
            alt="Happy vet with dog and cat"
          />
          <ImageOverlay>
            <OverlayText>24/7 Access to Pet Health Records</OverlayText>
          </ImageOverlay>
        </ImageContainer>
      </HeroSection>

      {/* 🔸 INFO SECTION */}
      <InfoSection>
        <SectionTitle>Why Choose FurSureCare?</SectionTitle>
        <SectionSubtitle>
          Everything you need to keep your pets healthy and happy
        </SectionSubtitle>
        <CardContainer>
          <Card>
            <CardIcon>📋</CardIcon>
            <h3>Easy Records Management</h3>
            <p>Track pet vaccinations, medical history, and more in one secure place.</p>
          </Card>
          <Card>
            <CardIcon>📅</CardIcon>
            <h3>Appointment Scheduling</h3>
            <p>Schedule vet visits and never miss an important check-up again.</p>
          </Card>
          <Card>
            <CardIcon>🔔</CardIcon>
            <h3>Smart Reminders</h3>
            <p>Get notifications for vaccinations, medications, and appointments.</p>
          </Card>
          <Card>
            <CardIcon>❤️</CardIcon>
            <h3>Pet Wellness Tracking</h3>
            <p>Monitor your pet&apos;s health trends and receive personalized insights.</p>
          </Card>
        </CardContainer>
      </InfoSection>

      {/* 🔸 TESTIMONIAL SECTION */}
      <TestimonialSection>
        <SectionTitle>What Pet Owners Say</SectionTitle>
        <SectionSubtitle>
          Join our community of satisfied pet parents
        </SectionSubtitle>
        <TestimonialContainer>
          <Testimonial>
            <Avatar>T</Avatar>
            <TestimonialText>
              &quot;FurSureCare made managing my two dogs&apos; health records so much easier. 
              The reminder system is fantastic! I never miss vaccination dates anymore.&quot;
            </TestimonialText>
            <TestimonialAuthor>
              <strong>Maria S.</strong>
              <span>Dog Owner</span>
            </TestimonialAuthor>
          </Testimonial>
          <Testimonial>
            <Avatar>J</Avatar>
            <TestimonialText>
              &quot;As a first-time pet owner, this platform helped me stay on top of 
              vaccinations and appointments. The vet can access records directly too!&quot;
            </TestimonialText>
            <TestimonialAuthor>
              <strong>James T.</strong>
              <span>Cat Owner</span>
            </TestimonialAuthor>
          </Testimonial>
          <Testimonial>
            <Avatar>R</Avatar>
            <TestimonialText>
              &quot;I run a small pet rescue and FurSureCare has revolutionized how we 
              track the health of our animals. It&apos;s been a game-changer for us!&quot;
            </TestimonialText>
            <TestimonialAuthor>
              <strong>Rachel M.</strong>
              <span>Rescue Owner</span>
            </TestimonialAuthor>
          </Testimonial>
        </TestimonialContainer>
      </TestimonialSection>

      {/* 🔸 FEATURES SECTION */}
      <FeaturesSection>
        <SectionTitle>Powerful Features</SectionTitle>
        <FeaturesGrid>
          <FeatureBlock>
            <FeatureNumber>01</FeatureNumber>
            <div>
              <h3>Digital Health Records</h3>
              <p>Store all your pet&apos;s medical history in one secure, accessible place.</p>
            </div>
          </FeatureBlock>
          <FeatureBlock>
            <FeatureNumber>02</FeatureNumber>
            <div>
              <h3>Medication Tracker</h3>
              <p>Never miss a dose with our smart medication reminders.</p>
            </div>
          </FeatureBlock>
          <FeatureBlock>
            <FeatureNumber>03</FeatureNumber>
            <div>
              <h3>Vet Communication</h3>
              <p>Share records directly with your veterinarian before appointments.</p>
            </div>
          </FeatureBlock>
          <FeatureBlock>
            <FeatureNumber>04</FeatureNumber>
            <div>
              <h3>Multi-Pet Support</h3>
              <p>Manage all your pets in one account, no matter how many you have.</p>
            </div>
          </FeatureBlock>
        </FeaturesGrid>
      </FeaturesSection>

      {/* 🔸 CTA SECTION */}
      <CTASection>
        <CTAContent>
          <h2>Ready to give your pet the best care?</h2>
          <p>Join pet owners who trust FurSureCare with their furry family members</p>
          <ButtonGroup>
            <CtaButton onClick={() => router.push("/register")}>
              Create Your Account
            </CtaButton>
            <SecondaryButton onClick={() => router.push("/login")}>
              Sign In
            </SecondaryButton>
          </ButtonGroup>
        </CTAContent>
      </CTASection>

      {/* 🔸 FOOTER */}
      <Footer>
        <FooterContent>
          <FooterSection>
            <Logo>
              <LogoIcon>🐾</LogoIcon>
              FurSureCare
            </Logo>
            <p>Providing exceptional care for your beloved pets since 2023.</p>
            <SocialLinks>
              <SocialLink>Facebook</SocialLink>
              <SocialLink>Instagram</SocialLink>
              <SocialLink>Twitter</SocialLink>
            </SocialLinks>
          </FooterSection>
          <FooterSection>
            <h4>Quick Links</h4>
            <FooterLink onClick={() => router.push("/login")}>Login</FooterLink>
            <FooterLink onClick={() => router.push("/register")}>Register</FooterLink>
            <FooterLink>Services</FooterLink>
            <FooterLink>Pricing</FooterLink>
          </FooterSection>
          <FooterSection>
            <h4>Resources</h4>
            <FooterLink>Blog</FooterLink>
            <FooterLink>FAQs</FooterLink>
            <FooterLink>Support Center</FooterLink>
            <FooterLink>Pet Health Tips</FooterLink>
          </FooterSection>
          <FooterSection>
            <h4>Contact Us</h4>
            <p>Email: info@fursurecare.com</p>
            <p>Phone: (123) 456-7890</p>
            <p>Address: 123 Pet Care Ave, City</p>
          </FooterSection>
        </FooterContent>
        <Copyright>
          <p>© 2023 FurSureCare Veterinary Clinic. All Rights Reserved.</p>
          <FooterLinks>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Cookie Policy</span>
          </FooterLinks>
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
  font-size: 18px;

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const Header = styled.header`
  width: 100%;
  padding: 1.2rem 5%;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #333;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1rem 5%;
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  font-size: 1.8rem;
  font-weight: bold;
  cursor: pointer;
  color: #20c997;

  @media (max-width: 480px) {
    font-size: 1.5rem;
  }
`;

const LogoIcon = styled.span`
  margin-right: 0.5rem;
  font-size: 1.8rem;
`;

const Nav = styled.nav`
  display: flex;
  gap: 1.5rem;
  align-items: center;

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileMenuIcon = styled.div`
  display: none;
  font-size: 1.8rem;
  cursor: pointer;

  @media (max-width: 768px) {
    display: block;
  }
`;

const NavItem = styled.span`
  cursor: pointer;
  font-weight: 500;
  padding: 0.7rem 1.5rem;
  border-radius: 50px;
  transition: all 0.3s ease;
  font-size: 1.1rem;
  color: #555;
  
  &:hover {
    color: #20c997;
  }
`;

const NavItemPrimary = styled(NavItem)`
  background: #20c997;
  color: white;
  
  &:hover {
    background: #17a589;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(32, 201, 151, 0.3);
    color: white;
  }
`;

const HeroSection = styled.section`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 4rem 5%;
  background: linear-gradient(135deg, #e6f7f4 0%, #f0fdf9 100%);
  min-height: 85vh;

  @media (max-width: 1024px) {
    justify-content: center;
    text-align: center;
    padding: 3rem 5%;
    min-height: auto;
  }
`;

const HeroContent = styled.div`
  flex: 1;
  max-width: 600px;
  margin-right: 2rem;

  h1 {
    font-size: 3.5rem;
    color: #333;
    margin-bottom: 1.5rem;
    line-height: 1.2;
    font-weight: 800;

    @media (max-width: 1024px) {
      font-size: 3rem;
    }

    @media (max-width: 768px) {
      font-size: 2.5rem;
    }

    @media (max-width: 480px) {
      font-size: 2.2rem;
    }
  }

  p {
    margin: 1.8rem 0;
    font-size: 1.4rem;
    color: #555;
    line-height: 1.6;

    @media (max-width: 768px) {
      font-size: 1.2rem;
    }
  }

  @media (max-width: 1024px) {
    margin: 0 0 3rem 0;
    text-align: center;
  }
`;

const HeroBadge = styled.span`
  display: inline-block;
  background: rgba(32, 201, 151, 0.1);
  color: #20c997;
  padding: 0.5rem 1.2rem;
  border-radius: 50px;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
`;

const GradientText = styled.span`
  background: linear-gradient(135deg, #20c997 0%, #2d9cdb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin: 2rem 0;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const HeroButton = styled.button`
  padding: 1.2rem 2.5rem;
  font-size: 1.2rem;
  border: none;
  background: #20c997;
  color: white;
  border-radius: 50px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(32, 201, 151, 0.4);

  &:hover {
    background: #17a589;
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(32, 201, 151, 0.5);
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 1.1rem;
  }
`;

const SecondaryButton = styled(HeroButton)`
  background: transparent;
  color: #20c997;
  border: 2px solid #20c997;
  box-shadow: none;

  &:hover {
    background: rgba(32, 201, 151, 0.1);
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(32, 201, 151, 0.2);
  }
`;

const FeatureList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
`;

const FeatureItem = styled.span`
  font-size: 1rem;
  color: #666;
  background: rgba(32, 201, 151, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 50px;
`;

const ImageContainer = styled.div`
  flex: 1;
  max-width: 500px;
  position: relative;

  @media (max-width: 1024px) {
    max-width: 100%;
  }
`;

const HeroImage = styled.img`
  width: 100%;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
`;

const ImageOverlay = styled.div`
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 1rem 2rem;
  border-radius: 50px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
`;

const OverlayText = styled.span`
  font-weight: 600;
  color: #20c997;
  font-size: 1rem;
`;

const SectionTitle = styled.h2`
  text-align: center;
  font-size: 2.8rem;
  color: #333;
  margin-bottom: 1rem;
  font-weight: 800;

  @media (max-width: 768px) {
    font-size: 2.3rem;
  }

  @media (max-width: 480px) {
    font-size: 2rem;
  }
`;

const SectionSubtitle = styled.p`
  text-align: center;
  font-size: 1.3rem;
  color: #666;
  margin-bottom: 3rem;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const InfoSection = styled.section`
  padding: 6rem 5%;
  background: #fff;

  @media (max-width: 768px) {
    padding: 4rem 5%;
  }
`;

const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2.5rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 20px;
  padding: 2.5rem;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;

  h3 {
    margin: 1.5rem 0;
    color: #333;
    font-size: 1.6rem;
    font-weight: 700;
  }

  p {
    color: #666;
    font-size: 1.1rem;
    line-height: 1.6;
  }

  &:hover {
    transform: translateY(-10px);
    box-shadow: 0 15px 40px rgba(0,0,0,0.12);
  }
`;

const CardIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
`;

const TestimonialSection = styled.section`
  padding: 6rem 5%;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);

  @media (max-width: 768px) {
    padding: 4rem 5%;
  }
`;

const TestimonialContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2.5rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Testimonial = styled.div`
  background: white;
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  position: relative;
`;

const Avatar = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #20c997;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
`;

const TestimonialText = styled.p`
  font-style: italic;
  color: #555;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
`;

const TestimonialAuthor = styled.div`
  display: flex;
  flex-direction: column;

  strong {
    color: #333;
    font-size: 1.1rem;
  }

  span {
    color: #666;
    font-size: 0.9rem;
  }
`;

const FeaturesSection = styled.section`
  padding: 6rem 5%;
  background: #fff;

  @media (max-width: 768px) {
    padding: 4rem 5%;
  }
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
`;

const FeatureBlock = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  padding: 2rem;
  border-radius: 15px;
  background: #f8f9fa;
  transition: all 0.3s ease;

  &:hover {
    background: #e9ecef;
    transform: translateY(-5px);
  }

  h3 {
    color: #333;
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
  }

  p {
    color: #666;
    font-size: 1rem;
    line-height: 1.5;
  }
`;

const FeatureNumber = styled.span`
  font-size: 2.5rem;
  font-weight: 800;
  color: #20c997;
  opacity: 0.3;
`;

const CTASection = styled.section`
  padding: 6rem 5%;
  background: linear-gradient(135deg, #20c997 0%, #2d9cdb 100%);
  color: white;
  text-align: center;

  @media (max-width: 768px) {
    padding: 4rem 5%;
  }
`;

const CTAContent = styled.div`
  max-width: 800px;
  margin: 0 auto;

  h2 {
    font-size: 3rem;
    margin-bottom: 1.5rem;
    font-weight: 800;

    @media (max-width: 768px) {
      font-size: 2.5rem;
    }

    @media (max-width: 480px) {
      font-size: 2.2rem;
    }
  }

  p {
    font-size: 1.4rem;
    margin-bottom: 2.5rem;
    opacity: 0.9;

    @media (max-width: 480px) {
      font-size: 1.2rem;
    }
  }
`;

const CtaButton = styled(HeroButton)`
  background: white;
  color: #20c997;
  
  &:hover {
    background: #f7f7f7;
    color: #17a589;
  }
`;

const Footer = styled.footer`
  background: #1a1a1a;
  color: white;
  padding: 4rem 0 0;

  @media (max-width: 768px) {
    padding: 3rem 0 0;
  }
`;

const FooterContent = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 3rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 5% 3rem;

  @media (max-width: 768px) {
    gap: 2rem;
  }
`;

const FooterSection = styled.div`
  h4 {
    margin-bottom: 1.5rem;
    color: #20c997;
    font-size: 1.3rem;
  }

  p {
    line-height: 1.6;
    color: #ccc;
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }
`;

const FooterLink = styled.p`
  cursor: pointer;
  margin: 0.8rem 0;
  color: #ccc;
  transition: color 0.3s ease;
  font-size: 1.1rem;

  &:hover {
    color: #20c997;
  }
`;

const SocialLinks = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
`;

const SocialLink = styled.span`
  cursor: pointer;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  transition: all 0.3s ease;
  font-size: 0.9rem;

  &:hover {
    background: #20c997;
  }
`;

const Copyright = styled.div`
  text-align: center;
  padding: 1.8rem;
  border-top: 1px solid #333;
  background: #151515;

  p {
    color: #999;
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
`;

const FooterLinks = styled.div`
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  
  span {
    cursor: pointer;
    color: #999;
    font-size: 0.9rem;
    transition: color 0.3s ease;
    
    &:hover {
      color: #20c997;
    }
  }
`;