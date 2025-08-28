'use client';

import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { useRouter } from "next/navigation";
import { db } from "../firebaseConfig";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

// Define interfaces for our data structures
interface VaccineSuggestion {
  vaccineId: string;
  vaccineName: string;
  reason: string;
  recommendedDate: string;
}

interface PetRecord {
  id: string;
  email: string;
  petName?: string;
  ownerName?: string;
  // Add other known properties that might exist in your records
  date?: string;
  // Add more properties as needed based on your actual data structure
}

// 🔹 Default Vaccination Suggestions
const VACCINE_SUGGESTIONS: VaccineSuggestion[] = [
  {
    vaccineId: "dhpp1",
    vaccineName: "DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)",
    reason: "Core vaccine – protects against fatal diseases",
    recommendedDate: "2025-09-15",
  },
  {
    vaccineId: "rabies1",
    vaccineName: "Rabies",
    reason: "Legally required – protects against rabies virus",
    recommendedDate: "2025-09-22",
  },
  {
    vaccineId: "bordetella1",
    vaccineName: "Bordetella (Kennel Cough)",
    reason: "Recommended for dogs exposed to other pets",
    recommendedDate: "2025-09-29",
  },
  {
    vaccineId: "lepto1",
    vaccineName: "Leptospirosis",
    reason: "Prevents bacterial infection from contaminated water",
    recommendedDate: "2025-10-05",
  },
];

// --- Styled Components ---
const Container = styled.div`
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%);
  min-height: 100vh;
  
  @media (max-width: 768px) {
    padding: 15px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #5a6268;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const Title = styled.h1`
  color: #2c3e50;
  margin: 0;
  font-size: 2.2rem;
  text-align: center;
  flex: 1;
  
  @media (max-width: 768px) {
    font-size: 1.8rem;
    text-align: left;
  }
`;

const Section = styled.div`
  margin-bottom: 30px;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
`;

const SectionTitle = styled.h3`
  color: #3498db;
  margin-bottom: 15px;
  font-size: 1.4rem;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 8px;
  
  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

const UserGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const VaccineGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div<{ selected: boolean }>`
  display: flex;
  align-items: flex-start;
  padding: 15px;
  border-radius: 12px;
  background: ${(props) => (props.selected ? "#e8f5e9" : "#f9f9f9")};
  border: 2px solid ${(props) => (props.selected ? "#4caf50" : "#e0e0e0")};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    border-color: ${(props) => (props.selected ? "#4caf50" : "#ccc")};
  }
`;

const UserCard = styled(Card)`
  align-items: center;
`;

const VaccineCard = styled(Card)`
  flex-direction: column;
`;

const CheckboxContainer = styled.div`
  display: inline-block;
  vertical-align: middle;
  margin-right: 15px;
  flex-shrink: 0;
`;

const Icon = styled.svg`
  fill: none;
  stroke: white;
  stroke-width: 3px;
`;

const StyledCheckbox = styled.div<{ selected: boolean }>`
  display: inline-block;
  width: 24px;
  height: 24px;
  background: ${props => props.selected ? '#4caf50' : '#f0f0f0'};
  border-radius: 6px;
  transition: all 150ms;
  border: 2px solid ${props => props.selected ? '#4caf50' : '#ccc'};
  
  ${Icon} {
    visibility: ${props => props.selected ? 'visible' : 'hidden'};
  }
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  border: 0;
  clip: rect(0 0 0 0);
  clippath: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const UserName = styled.span`
  font-weight: bold;
  font-size: 1.1rem;
  color: #2c3e50;
  margin-bottom: 4px;
`;

const UserEmail = styled.span`
  color: #7f8c8d;
  font-size: 0.95rem;
  margin-bottom: 4px;
`;

const UserOwner = styled.span`
  color: #95a5a6;
  font-size: 0.85rem;
`;

const VaccineInfo = styled.div`
  flex: 1;
`;

const VaccineName = styled.div`
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8px;
  font-size: 1.1rem;
`;

const VaccineReason = styled.div`
  color: #7f8c8d;
  margin-bottom: 8px;
  line-height: 1.4;
`;

const VaccineDate = styled.div`
  color: #27ae60;
  font-weight: 500;
  font-size: 0.9rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
  resize: none;
  font-family: inherit;
  font-size: 1rem;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 30px;
  gap: 15px;
`;

const Button = styled.button<{ disabled: boolean }>`
  padding: 14px 28px;
  background: ${props => props.disabled ? '#cccccc' : '#3498db'};
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  min-width: 200px;

  &:hover {
    background: ${props => props.disabled ? '#cccccc' : '#2980b9'};
    transform: ${props => props.disabled ? 'none' : 'translateY(-2px)'};
    box-shadow: ${props => props.disabled ? 'none' : '0 4px 8px rgba(0, 0, 0, 0.1)'};
  }
  
  &:active {
    transform: ${props => props.disabled ? 'none' : 'translateY(0)'};
  }
`;

const ErrorMsg = styled.p`
  color: #e74c3c;
  font-size: 1rem;
  padding: 10px;
  background: #fadbd8;
  border-radius: 8px;
  text-align: center;
  margin: 20px 0;
`;

const LoadingText = styled.p`
  text-align: center;
  color: #7f8c8d;
  font-style: italic;
  padding: 20px;
`;

const NoDataText = styled.p`
  text-align: center;
  color: #95a5a6;
  padding: 20px;
`;

// Main Component
const Page = () => {
  const router = useRouter();

  const [records, setRecords] = useState<PetRecord[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailMessage, setEmailMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 🔹 Load Pet Records
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const recordsQuery = query(
      collection(db, "petRecords"),
      orderBy("date", "desc")
    );
    const unsubscribe = onSnapshot(recordsQuery, (snapshot) => {
      const recordsData: PetRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as PetRecord);
      });
      setRecords(recordsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading records:", error);
      setError("Failed to load user records");
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 Toggle vaccine selection
  const toggleSuggestionSelection = (vaccineId: string) => {
    setSelectedSuggestions((prev) =>
      prev.includes(vaccineId)
        ? prev.filter((id) => id !== vaccineId)
        : [...prev, vaccineId]
    );
  };

  // 🔹 Toggle email selection
  const toggleEmailSelection = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  // 🔹 Calculate weeks until recommendedDate
  const getWeeksUntil = (recommendedDate: string) => {
    const today = new Date();
    const recDate = new Date(recommendedDate);
    const diffTime = recDate.getTime() - today.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks > 0 ? `${diffWeeks} week(s)` : "Due now!";
  };

  // 🔹 Send email with selected suggestions
  const sendRecordsToEmails = useCallback(() => {
    try {
      if (selectedEmails.length === 0) {
        setError("⚠️ Please select at least one email to send to");
        return;
      }
      if (selectedSuggestions.length === 0) {
        setError("⚠️ Please select at least one vaccination to send");
        return;
      }

      const suggestionText = VACCINE_SUGGESTIONS
        .filter((s) => selectedSuggestions.includes(s.vaccineId))
        .map(
          (s) =>
            `• ${s.vaccineName} → ${s.reason} (Recommended: ${s.recommendedDate}, in ${getWeeksUntil(
              s.recommendedDate
            )})`
        )
        .join("\n");

      const emailContent = `
      Vaccination Suggestions for your pet:\n\n
      ${suggestionText}
      \n\nMessage from Vet: ${emailMessage || "N/A"}
      `;

      alert(
        `📩 Sending suggestions:\n${emailContent}\n\nTo: ${selectedEmails.join(
          ", "
        )}`
      );

      setSelectedSuggestions([]);
      setSelectedEmails([]);
      setEmailMessage("");
      setError("");
    } catch (err) {
      setError("❌ Failed to send suggestions");
      console.error(err);
    }
  }, [selectedEmails, selectedSuggestions, emailMessage]);

  // Don't render anything until we're on the client to prevent hydration mismatch
  if (!isClient) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => router.push("/admindashboard")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </BackButton>
          <Title>🐾 Vaccination Suggestions</Title>
          <div style={{width: "100px"}}></div> {/* Spacer for alignment */}
        </Header>
        <LoadingText>Loading...</LoadingText>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => router.push("/admindashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="only" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </BackButton>
        <Title>🐾 Vaccination Suggestions</Title>
        <div style={{width: "100px"}}></div> {/* Spacer for alignment */}
      </Header>

      {/* Email Selection */}
      <Section>
        <SectionTitle>Select User Emails:</SectionTitle>
        {isLoading ? (
          <LoadingText>Loading users...</LoadingText>
        ) : records.length === 0 ? (
          <NoDataText>No registered users found.</NoDataText>
        ) : (
          <UserGrid>
            {records.map((r) => (
              <UserCard
                key={r.id}
                selected={selectedEmails.includes(r.email)}
                onClick={() => toggleEmailSelection(r.email)}
              >
                <CheckboxContainer>
                  <HiddenCheckbox 
                    checked={selectedEmails.includes(r.email)} 
                    readOnly 
                  />
                  <StyledCheckbox selected={selectedEmails.includes(r.email)}>
                    <Icon viewBox="0 0 24 24" width="18" height="18">
                      <polyline points="20 6 9 17 4 12" />
                    </Icon>
                  </StyledCheckbox>
                </CheckboxContainer>
                <UserInfo>
                  <UserName>{r.petName || "Unknown Pet"}</UserName>
                  <UserEmail>{r.email}</UserEmail>
                  {r.ownerName && <UserOwner>Owner: {r.ownerName}</UserOwner>}
                </UserInfo>
              </UserCard>
            ))}
          </UserGrid>
        )}
      </Section>

      {/* Vaccination Suggestions */}
      <Section>
        <SectionTitle>Available Vaccinations:</SectionTitle>
        <VaccineGrid>
          {VACCINE_SUGGESTIONS.map((s) => (
            <VaccineCard
              key={s.vaccineId}
              selected={selectedSuggestions.includes(s.vaccineId)}
              onClick={() => toggleSuggestionSelection(s.vaccineId)}
            >
              <CheckboxContainer>
                <HiddenCheckbox 
                  checked={selectedSuggestions.includes(s.vaccineId)} 
                  readOnly 
                />
                <StyledCheckbox selected={selectedSuggestions.includes(s.vaccineId)}>
                  <Icon viewBox="0 0 24 24" width="18" height="18">
                    <polyline points="20 6 9 17 4 12" />
                  </Icon>
                </StyledCheckbox>
              </CheckboxContainer>
              <VaccineInfo>
                <VaccineName>{s.vaccineName}</VaccineName>
                <VaccineReason>{s.reason}</VaccineReason>
                <VaccineDate>
                  Recommended: {s.recommendedDate} (in {getWeeksUntil(s.recommendedDate)})
                </VaccineDate>
              </VaccineInfo>
            </VaccineCard>
          ))}
        </VaccineGrid>
      </Section>

      {/* Message box */}
      <Section>
        <SectionTitle>Custom Message:</SectionTitle>
        <TextArea
          value={emailMessage}
          onChange={(e) => setEmailMessage(e.target.value)}
          placeholder="Add your message to the user..."
          rows={4}
        />
      </Section>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <ButtonContainer>
        <BackButton onClick={() => router.push("/admindashboard")} style={{background: "#95a5a6"}}>
          Cancel
        </BackButton>
        <Button onClick={sendRecordsToEmails} disabled={selectedEmails.length === 0 || selectedSuggestions.length === 0}>
          Send Suggestions
        </Button>
      </ButtonContainer>
    </Container>
  );
};

export default Page;