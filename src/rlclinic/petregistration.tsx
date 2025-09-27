'use client';

import React, { useState, useEffect } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { collection, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #E6F7F4 0%, #F0F8FF 100%);
    min-height: 100vh;
  }
  
  * {
    box-sizing: border-box;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideUp = keyframes`
  from { 
    opacity: 0;
    transform: translateY(30px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
`;

const dogBreeds = [
  "Aspin (Asong Pinoy)",
  "Shih Tzu",
  "Siberian Husky",
  "Chihuahua",
  "Labrador Retriever",
  "Beagle",
  "Golden Retriever",
  "Poodle",
  "Dachshund",
  "Rottweiler",
  "Philippine Forest Dog (Asong Gubat)"
];

const catBreeds = [
  "British Shorthair",
  "Burmese",
  "Abyssinian",
  "Scottish Fold",
  "Siamese",
  "Sphynx",
  "Ragdoll",
  "American Shorthair",
  "Maine Coon",
  "Persian",
  "Putot Cat (Pusang Putot)"
];

const Petregister: React.FC = () => {
  const router = useRouter();

  const [petOwnerEmail, setPetOwnerEmail] = useState<string>("");
  const [petName, setPetName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [color, setColor] = useState("");
  const [petType, setPetType] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [breedOptions, setBreedOptions] = useState<string[]>([]);
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  useEffect(() => {
    if (petType === "Dog") {
      setBreedOptions(dogBreeds);
    } else if (petType === "Cat") {
      setBreedOptions(catBreeds);
    } else {
      setBreedOptions([]);
    }
    setPetBreed("");
  }, [petType]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        setPetOwnerEmail(user.email);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) {
      setModalMessage("Please enter your pet's name.");
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);

    try {
      const petId = doc(collection(db, "pets")).id;

      // Calculate age from birthday
      const age = birthday ? calculateAge(birthday) : "";

      // Save to pets collection
      await setDoc(doc(db, "pets", petId), {
        petId,
        petName: petName.trim(),
        birthday: birthday || null,
        color: color.trim(),
        petType: petType.trim(),
        petBreed: petBreed.trim(),
        gender,
        ownerEmail: petOwnerEmail,
        createdAt: new Date().toISOString(),
      });

      // Save to petRegistrations
      await setDoc(doc(db, "petRegistrations", petId), {
        petId,
        petName: petName.trim(),
        ownerEmail: petOwnerEmail,
        petType: petType.trim(),
        petBreed: petBreed.trim(),
        age: age,
        gender,
        color: color.trim(),
        createdAt: new Date().toISOString(),
      });

      // Initial medical record with ALL information
      await setDoc(doc(db, "medicalRecords", petId), {
        petId,
        petName: petName.trim(),
        ownerEmail: petOwnerEmail,
        ownerName: "", // Will be filled from user data
        birthDate: birthday || "", // ✅ Save birthday here
        breed: petBreed.trim(), // ✅ Save breed here
        petType: petType.toLowerCase(), // ✅ Convert to lowercase for consistency
        gender: gender,
        color: color.trim(),
        date: new Date().toISOString().split("T")[0],
        diagnosis: "Initial checkup",
        treatment: "Registration",
        notes: "Pet registration and initial medical record created",
        veterinarian: "System",
        createdAt: new Date().toISOString(),
        status: "Registered",
        petAge: age // ✅ Include calculated age
      });

      setModalMessage("Pet registered successfully! All information has been saved to medical records.");
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving pet:", error);
      setModalMessage("Failed to save pet. Please try again.");
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age <= 0) {
      const months = Math.max(0, today.getMonth() - birth.getMonth() + 
        (12 * (today.getFullYear() - birth.getFullYear())));
      return months <= 1 ? "1 month" : `${months} months`;
    }
    if (age === 1) return "1 year";
    return `${age} years`;
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    setShowErrorModal(false);
    if (showSuccessModal) {
      router.push("/userdashboard");
    }
  };

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <ClinicName>RL Clinic</ClinicName>
            <Tagline>Fursure Care - Pet Registration</Tagline>
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
                      required
                    />
                    <Span>Date of Birth *</Span>
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
                      required
                    />
                    <Span>Color/Markings *</Span>
                  </Label>
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Select 
                      value={petType} 
                      onChange={(e) => setPetType(e.target.value)} 
                      disabled={isLoading}
                      required
                    >
                      <option value="">Select Pet Type</option>
                      <option value="Dog">Dog</option>
                      <option value="Cat">Cat</option>
                    </Select>
                    <Span>Pet Type *</Span>
                  </Label>
                </FormGroup>

                <FormGroup style={{flex: 1}}>
                  <Label>
                    <Select 
                      value={petBreed} 
                      onChange={(e) => setPetBreed(e.target.value)} 
                      disabled={isLoading || !petType}
                      required
                    >
                      <option value="">Select Breed</option>
                      {breedOptions.map((breed) => (
                        <option key={breed} value={breed}>
                          {breed}
                        </option>
                      ))}
                    </Select>
                    <Span>Breed *</Span>
                  </Label>
                </FormGroup>
              </FormRow>

              <FormGroup>
                <GenderTitle>Gender *</GenderTitle>
                <GenderWrapper>
                  <RadioLabelStyled $selected={gender==="Male"} $disabled={isLoading}>
                    <RadioInput 
                      type="radio" 
                      name="gender" 
                      checked={gender === "Male"} 
                      onChange={() => setGender("Male")}
                      disabled={isLoading}
                    /> 
                    Male
                  </RadioLabelStyled>

                  <RadioLabelStyled $selected={gender==="Female"} $disabled={isLoading}>
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
                <Button type="submit" disabled={isLoading || !petName.trim() || !petType || !petBreed || !birthday || !color}>
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

        {/* Success Modal */}
        {showSuccessModal && (
          <ModalOverlay onClick={handleModalClose}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalIcon $variant="success">
                  <i className="fas fa-check-circle"></i>
                </ModalIcon>
                <ModalTitle>Success!</ModalTitle>
                <ModalClose onClick={handleModalClose}>
                  <i className="fas fa-times"></i>
                </ModalClose>
              </ModalHeader>
              <ModalContent>
                <p>{modalMessage}</p>
                <PetDetails>
                  <DetailItem>
                    <strong>Pet Name:</strong> {petName}
                  </DetailItem>
                  <DetailItem>
                    <strong>Type:</strong> {petType}
                  </DetailItem>
                  <DetailItem>
                    <strong>Breed:</strong> {petBreed}
                  </DetailItem>
                  <DetailItem>
                    <strong>Gender:</strong> {gender}
                  </DetailItem>
                </PetDetails>
              </ModalContent>
              <ModalActions>
                <ModalButton $variant="success" onClick={handleModalClose}>
                  Continue to Dashboard
                </ModalButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}

        {/* Error Modal */}
        {showErrorModal && (
          <ModalOverlay onClick={handleModalClose}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalIcon $variant="error">
                  <i className="fas fa-exclamation-circle"></i>
                </ModalIcon>
                <ModalTitle>Registration Error</ModalTitle>
                <ModalClose onClick={handleModalClose}>
                  <i className="fas fa-times"></i>
                </ModalClose>
              </ModalHeader>
              <ModalContent>
                <p>{modalMessage}</p>
              </ModalContent>
              <ModalActions>
                <ModalButton $variant="error" onClick={handleModalClose}>
                  Try Again
                </ModalButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}
      </PageContainer>
      
      {/* Font Awesome CSS */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
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

const Select = styled.select`
  width: 100%;
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #ddd;
  font-size: 16px;
  background: ${props => props.disabled ? '#f5f5f5' : '#fff'};
  color: ${props => props.disabled ? '#888' : '#333'};
  appearance: none;
  
  &:focus {
    outline: none;
    border-color: #34b89c;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.2);
  }
  
  &:not([value=""]) + span,
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

const RadioLabelStyled = styled.label<{$selected?: boolean, $disabled?: boolean}>`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  padding: 10px 15px;
  border-radius: 8px;
  background: ${props => {
    if (props.$disabled) return '#f8f9fa';
    return props.$selected ? 'linear-gradient(90deg, #6bc1e1, #34b89c)' : '#f8f9fa';
  }};
  color: ${props => {
    if (props.$disabled) return '#aaa';
    return props.$selected ? 'white' : '#2c3e50';
  }};
  transition: all 0.2s;
  flex: 1;
  justify-content: center;

  &:hover {
    background: ${props => {
      if (props.$disabled) return '#f8f9fa';
      return props.$selected 
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

/* ===== MODAL STYLES ===== */
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.3s ease-out;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: ${slideUp} 0.3s ease-out;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eaeaea;
  position: relative;
`;

const ModalIcon = styled.div<{$variant?: 'success' | 'error'}>`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 1rem;
  font-size: 1.8rem;
  background: ${props => 
    props.$variant === 'success' ? 'linear-gradient(135deg, #34b89c, #6bc1e1)' :
    props.$variant === 'error' ? 'linear-gradient(135deg, #ff6b6b, #ff8e8e)' :
    'linear-gradient(135deg, #6bc1e1, #34b89c)'
  };
  color: white;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
`;

const ModalClose = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  border-radius: 50%;
  width: 35px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

const ModalContent = styled.div`
  padding: 1.5rem;
  
  p {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    line-height: 1.6;
    color: #555;
    text-align: center;
  }
`;

const PetDetails = styled.div`
  background: linear-gradient(135deg, #f8fdfc 0%, #f0faf8 100%);
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 4px solid #34b89c;
`;

const DetailItem = styled.p`
  margin: 0.5rem 0;
  font-size: 0.95rem;
  color: #2c3e50;
  
  strong {
    color: #34b89c;
  }
`;

const ModalActions = styled.div`
  padding: 0 1.5rem 1.5rem;
  display: flex;
  justify-content: center;
`;

const ModalButton = styled.button<{$variant?: 'success' | 'error'}>`
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => 
    props.$variant === 'success' ? 'linear-gradient(135deg, #34b89c, #6bc1e1)' :
    props.$variant === 'error' ? 'linear-gradient(135deg, #ff6b6b, #ff8e8e)' :
    'linear-gradient(135deg, #6bc1e1, #34b89c)'
  };
  color: white;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52, 184, 156, 0.3);
  }
`;