'use client';

import React, { useState, useEffect } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #E6F4F1;
  }
  
  * {
    box-sizing: border-box;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Petregister: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [petOwnerEmail, setPetOwnerEmail] = useState<string>("");
  const [ownerFirstName, setOwnerFirstName] = useState<string>("");
  const [ownerLastName, setOwnerLastName] = useState<string>("");

  const [petName, setPetName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [color, setColor] = useState("");
  const [petType, setPetType] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [isLoading, setIsLoading] = useState(false);

  // Get current user info and check URL params
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        setPetOwnerEmail(user.email);

        // ✅ Check if there are query parameters from registration
        const urlFirstName = searchParams.get('firstname');
        const urlLastName = searchParams.get('lastname');
        const urlEmail = searchParams.get('email');
        
        if (urlFirstName && urlLastName && urlEmail) {
          // Use data from URL parameters (from registration)
          setOwnerFirstName(urlFirstName);
          setOwnerLastName(urlLastName);
          setPetOwnerEmail(urlEmail);
        } else {
          // ✅ Kunin ang pangalan mula sa `users` collection (for existing users)
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setOwnerFirstName(userData.firstname || "");
            setOwnerLastName(userData.lastname || "");
          }
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) {
      alert("Please enter your pet's name.");
      return;
    }

    setIsLoading(true);

    try {
      const petId = doc(collection(db, "pets")).id;

      // Save to pets
      await setDoc(doc(db, "pets", petId), {
        petId,
        petName: petName.trim(),
        birthday: birthday || null,
        color: color.trim(),
        petType: petType.trim(),
        petBreed: petBreed.trim(),
        gender,
        ownerEmail: petOwnerEmail,
        ownerFirstName,
        ownerLastName,
        createdAt: new Date().toISOString(),
      });

      // Save to petRegistrations
      await setDoc(doc(db, "petRegistrations", petId), {
        petId,
        petName: petName.trim(),
        ownerEmail: petOwnerEmail,
        ownerFirstName,
        ownerLastName,
        petType: petType.trim(),
        petBreed: petBreed.trim(),
        age: birthday ? calculateAge(birthday) : "",
        gender,
        color: color.trim(),
        createdAt: new Date().toISOString(),
      });

      // Initial medical record
      await setDoc(doc(db, "medicalRecords", petId), {
        petId,
        petName: petName.trim(),
        ownerEmail: petOwnerEmail,
        ownerFirstName,
        ownerLastName,
        date: new Date().toISOString().split("T")[0],
        diagnosis: "",
        treatment: "",
        notes: "Initial registration",
        createdAt: new Date().toISOString(),
        status: "Registered",
      });

      alert("Pet registered successfully!");
      router.push("/userdashboard");
    } catch (error) {
      console.error("Error saving pet:", error);
      alert("Failed to save pet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: calculate age
  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age <= 0) return "Puppy/Kitten (0-1 year)";
    if (age <= 3) return "Young (1-3 years)";
    if (age <= 7) return "Adult (3-7 years)";
    return "Senior (7+ years)";
  };

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <ClinicName>RL Clinic</ClinicName>
            <Tagline>Fursure Care</Tagline>
          </BrandSection>
        </HeaderBar>

        <Content>
          <Card>
            <Header>
              <PetIcon>🐾</PetIcon>
              Pet Registration
            </Header>
            
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label>
                  <Input 
                    type="text" 
                    value={petOwnerEmail} 
                    readOnly 
                    disabled 
                    className="disabled-input"
                  />
                  <Span>Pet Owner Email</Span>
                </Label>
              </FormGroup>

              <FormRow>
                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Input 
                      type="text" 
                      value={ownerFirstName} 
                      readOnly 
                      disabled 
                      className="disabled-input"
                    />
                    <Span>First Name</Span>
                  </Label>
                </FormGroup>

                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Input 
                      type="text" 
                      value={ownerLastName} 
                      readOnly 
                      disabled 
                      className="disabled-input"
                    />
                    <Span>Last Name</Span>
                  </Label>
                </FormGroup>
              </FormRow>

              {/* Pet Info */}
              <FormGroup>
                <Label>
                  <Input 
                    type="text" 
                    value={petName} 
                    onChange={(e) => setPetName(e.target.value)} 
                    placeholder=" " 
                    required
                    disabled={isLoading}
                  />
                  <Span>Pet Name *</Span>
                </Label>
              </FormGroup>

              <FormRow>
                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Input 
                      type="date" 
                      value={birthday} 
                      onChange={(e) => setBirthday(e.target.value)} 
                      max={new Date().toISOString().split('T')[0]}
                      disabled={isLoading}
                    />
                    <Span>Date of Birth</Span>
                  </Label>
                </FormGroup>

                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Input 
                      type="text" 
                      value={color} 
                      onChange={(e) => setColor(e.target.value)} 
                      placeholder=" " 
                      disabled={isLoading}
                    />
                    <Span>Color/Markings</Span>
                  </Label>
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Input 
                      type="text" 
                      value={petType} 
                      onChange={(e) => setPetType(e.target.value)} 
                      placeholder=" " 
                      disabled={isLoading}
                    />
                    <Span>Pet Type</Span>
                  </Label>
                </FormGroup>

                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Input 
                      type="text" 
                      value={petBreed} 
                      onChange={(e) => setPetBreed(e.target.value)} 
                      placeholder=" " 
                      disabled={isLoading}
                    />
                    <Span>Breed</Span>
                  </Label>
                </FormGroup>
              </FormRow>

              <FormGroup>
                <GenderTitle>Gender *</GenderTitle>
                <GenderWrapper>
                  <RadioLabelStyled selected={gender==="Male"} disabled={isLoading}>
                    <RadioInput 
                      type="radio" 
                      name="gender" 
                      checked={gender === "Male"} 
                      onChange={() => setGender("Male")}
                      disabled={isLoading}
                    /> 
                    Male
                  </RadioLabelStyled>

                  <RadioLabelStyled selected={gender==="Female"} disabled={isLoading}>
                    <RadioInput 
                      type="radio" 
                      name="gender" 
                      checked={gender === "Female"} 
                      onChange={() => setGender("Female")}
                      disabled={isLoading}
                    /> 
                    Female
                  </RadioLabelStyled>
                </GenderWrapper>
              </FormGroup>

              <ButtonGroup>
                <Button type="submit" disabled={isLoading || !petName.trim()}>
                  {isLoading ? (
                    <>
                      <Spinner />
                      Registering...
                    </>
                  ) : "Register Pet"}
                </Button>
                <CancelButton 
                  type="button" 
                  onClick={() => router.push("/userdashboard")} 
                  disabled={isLoading}
                >
                  Cancel
                </CancelButton>
              </ButtonGroup>
            </Form>
          </Card>
        </Content>
      </PageContainer>
    </>
  );
};

export default Petregister;

/* ===== STYLED COMPONENTS ===== */
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const HeaderBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: linear-gradient(135deg, #6bc1e1 0%, #34b89c 100%);
  color: white;
  box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    padding: 15px 20px;
  }
`;

const BrandSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const ClinicName = styled.h1`
  font-size: 32px;
  font-weight: bold;
  font-family: "Rozha One", serif;
  margin: 0;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const Tagline = styled.p`
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  opacity: 0.9;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 20px;
  
  @media (max-width: 768px) {
    padding: 20px 15px;
  }
`;

const Card = styled.div`
  background: #fff;
  padding: 40px;
  border-radius: 20px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  animation: ${fadeIn} 0.5s ease;
  
  @media (max-width: 768px) {
    padding: 25px 20px;
    border-radius: 15px;
  }
`;

const Header = styled.h2`
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  font-family: 'Rozha One', serif;
  font-size: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  
  @media (max-width: 768px) {
    font-size: 24px;
    margin-bottom: 20px;
  }
`;

const PetIcon = styled.span`
  font-size: 40px;
  
  @media (max-width: 768px) {
    font-size: 32px;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
`;

const FormRow = styled.div`
  display: flex;
  gap: 15px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  width: 100%;
`;

const Label = styled.label`
  position: relative;
  display: block;
`;

const Input = styled.input`
  width: 100%;
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #ddd;
  font-size: 16px;
  background: ${props => props.disabled ? '#f5f5f5' : '#fff'};
  color: ${props => props.disabled ? '#888' : '#333'};
  
  &:focus {
    outline: none;
    border-color: #34b89c;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.2);
  }
  
  &:not(:placeholder-shown) + span,
  &:focus + span {
    top: -10px;
    left: 10px;
    font-size: 12px;
    background: white;
    padding: 0 5px;
    color: #34b89c;
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    font-size: 14px;
  }
`;

const Span = styled.span`
  position: absolute;
  top: 15px;
  left: 15px;
  font-size: 16px;
  color: #888;
  pointer-events: none;
  transition: all 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 14px;
    top: 12px;
  }
`;

const GenderTitle = styled.p`
  margin-bottom: 10px;
  font-weight: 600;
  color: #2c3e50;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const GenderWrapper = styled.div`
  display: flex;
  gap: 20px;
  
  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const RadioLabelStyled = styled.label<{selected?: boolean, disabled?: boolean}>`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  padding: 10px 15px;
  border-radius: 8px;
  background: ${props => {
    if (props.disabled) return '#f8f9fa';
    return props.selected ? 'linear-gradient(90deg, #6bc1e1, #34b89c)' : '#f8f9fa';
  }};
  color: ${props => {
    if (props.disabled) return '#aaa';
    return props.selected ? 'white' : '#2c3e50';
  }};
  transition: all 0.2s;
  flex: 1;
  justify-content: center;

  &:hover {
    background: ${props => {
      if (props.disabled) return '#f8f9fa';
      return props.selected 
        ? 'linear-gradient(90deg, #5aa7c8, #2f9b85)' 
        : '#e9ecef';
    }};
  }
  
  @media (max-width: 768px) {
    padding: 8px 12px;
    font-size: 14px;
  }
`;

const RadioInput = styled.input`
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
`;

const Button = styled.button`
  width: 100%;
  padding: 15px;
  background: ${props => props.disabled ? '#ccc' : 'linear-gradient(90deg, #6bc1e1, #34b89c)'};
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52,184,156,0.3);
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    font-size: 14px;
  }
`;

const CancelButton = styled.button`
  width: 100%;
  padding: 15px;
  background: #e0e0e0;
  color: #2c3e50;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #d5d5d5;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    font-size: 14px;
  }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;