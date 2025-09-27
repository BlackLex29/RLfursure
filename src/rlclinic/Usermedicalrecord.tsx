'use client';

import React, { useState, useEffect, useCallback } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

/* ===== GLOBAL STYLES ===== */
const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #f0f9f7;
    color: #334155;
  }

  * {
    box-sizing: border-box;
  }
`;

/* ===== INTERFACES ===== */
interface MedicalRecord {
  id: string;
  petName: string;
  ownerName: string;
  ownerEmail: string;
  petType: string;
  diagnosis: string;
  treatment: string;
  date: string;
  notes: string;
  birthDate?: string;
  breed?: string;
  petAge?: string;
  gender?: string;
  color?: string;
  weight?: string;
  allergies?: string;
  existingConditions?: string;
  veterinarian?: string;
  createdAt?: Timestamp | string;
  updateType?: string;
}

/* ===== COMPONENT ===== */
const UserMedicalRecords: React.FC = () => {
  const router = useRouter();
  const auth = getAuth();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);

  /* Fetch user records */
  const fetchUserMedicalRecords = useCallback(async (userEmail?: string | null) => {
    if (!userEmail) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "medicalRecords"),
        where("ownerEmail", "==", userEmail),
        orderBy("date", "desc")
      );
      const snapshot = await getDocs(q);
      const userRecords: MedicalRecord[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<MedicalRecord, "id">;
        if (data.ownerEmail === userEmail) {
          userRecords.push({ 
            id: docSnap.id, 
            ...data,
            birthDate: data.birthDate || "",
            breed: data.breed || "",
            petAge: data.petAge || "",
            gender: data.gender || "",
            color: data.color || "",
            weight: data.weight || "",
            allergies: data.allergies || "",
            existingConditions: data.existingConditions || "",
            veterinarian: data.veterinarian || ""
          });
        }
      });
      
      setRecords(userRecords);
    } catch (error) {
      console.error("Error fetching user medical records:", error);
      alert("Failed to load medical records.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Subscribe to realtime updates */
  const subscribeToMedicalRecordUpdates = useCallback(
    (userEmail?: string | null) => {
      if (!userEmail) return;

      const q = query(
        collection(db, "medicalRecords"),
        where("ownerEmail", "==", userEmail),
        orderBy("date", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const updatedRecords: MedicalRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<MedicalRecord, "id">;
          if (data.ownerEmail === userEmail) {
            updatedRecords.push({ 
              id: docSnap.id, 
              ...data,
              birthDate: data.birthDate || "",
              breed: data.breed || "",
              petAge: data.petAge || "",
              gender: data.gender || "",
              color: data.color || "",
              weight: data.weight || "",
              allergies: data.allergies || "",
              existingConditions: data.existingConditions || "",
              veterinarian: data.veterinarian || ""
            });
          }
        });
        setRecords(updatedRecords);
        setLoading(false);
      });

      return unsubscribe;
    },
    []
  );

  /* Handle auth state */
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      const email = user?.email ?? null;
      
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      
      if (email && user) {
        await fetchUserMedicalRecords(email);
        unsubscribeSnapshot = subscribeToMedicalRecordUpdates(email);
      } else {
        setRecords([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [auth, fetchUserMedicalRecords, subscribeToMedicalRecordUpdates]);

  /* Format date */
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  /* Print as PDF */
  const downloadPDF = (record: MedicalRecord) => {
    if (!currentUser || record.ownerEmail !== currentUser.email) {
      alert("Access denied: You can only print your own medical records.");
      return;
    }

    const printableContent = `
      <html>
        <head>
          <title>Medical Record - ${record.petName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
            
            body {
              font-family: 'Roboto', sans-serif;
              line-height: 1.6;
              color: #2c3e50;
              max-width: 800px;
              margin: 0 auto;
              padding: 30px;
              background-color: #f8fafc;
            }
            
            .certificate-border {
              border: 20px solid #34B89C;
              border-radius: 15px;
              padding: 40px;
              background: white;
              position: relative;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            
            .watermark {
              position: absolute;
              opacity: 0.05;
              font-size: 120px;
              font-weight: bold;
              color: #34B89C;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              z-index: 0;
              pointer-events: none;
            }
            
            .header {
              text-align: center;
              margin-bottom: 40px;
              position: relative;
              z-index: 1;
            }
            
            .logo-container {
              display: flex;
              justify-content: center;
              align-items: center;
              margin-bottom: 20px;
            }
            
            .logo {
              width: 100px;
              height: 100px;
              background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 40px;
              color: white;
              margin-right: 15px;
            }
            
            .clinic-info {
              text-align: left;
            }
            
            .clinic-name {
              color: #34B89C;
              font-size: 32px;
              font-weight: bold;
              margin: 0;
              letter-spacing: 1px;
            }
            
            .tagline {
              color: #6BC1E1;
              font-size: 18px;
              margin: 5px 0 0 0;
              font-weight: 500;
            }
            
            .clinic-details {
              font-size: 14px;
              color: #7f8c8d;
              margin-top: 5px;
            }
            
            .document-title {
              text-align: center;
              color: #2c3e50;
              font-size: 28px;
              margin: 30px 0;
              padding-bottom: 15px;
              border-bottom: 2px solid #ecf0f1;
              font-weight: 700;
            }
            
            .record-details {
              margin-bottom: 30px;
              position: relative;
              z-index: 1;
            }
            
            .detail-section {
              margin-bottom: 25px;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 10px;
              border-left: 4px solid #34B89C;
            }
            
            .section-title {
              color: #34B89C;
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
            }
            
            .section-title::before {
              content: "•";
              margin-right: 10px;
              font-size: 24px;
            }
            
            .detail-row {
              display: flex;
              margin-bottom: 12px;
              padding: 0 10px;
            }
            
            .detail-label {
              font-weight: 600;
              min-width: 180px;
              color: #34495e;
            }
            
            .detail-value {
              color: #2c3e50;
              flex: 1;
            }
            
            .diagnosis {
              color: #e74c3c;
              font-weight: 600;
              background: #fdedec;
              padding: 4px 8px;
              border-radius: 4px;
            }
            
            .treatment {
              color: #27ae60;
              font-weight: 600;
              background: #eafaf1;
              padding: 4px 8px;
              border-radius: 4px;
            }
            
            .notes {
              font-style: italic;
              background: #fffaf2;
              padding: 15px;
              border-radius: 8px;
              border-left: 3px solid #f39c12;
              margin-top: 10px;
            }
            
            .footer {
              margin-top: 50px;
              font-size: 12px;
              color: #95a5a6;
              text-align: center;
              border-top: 1px solid #ecf0f1;
              padding-top: 20px;
              position: relative;
              z-index: 1;
            }
            
            .signature-area {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
            }
            
            .signature-line {
              border-top: 1px solid #7f8c8d;
              width: 250px;
              margin-top: 40px;
            }
            
            .signature-label {
              font-size: 12px;
              color: #7f8c8d;
              text-align: center;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-top: 10px;
            }
            
            .info-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px dashed #ecf0f1;
            }
            
            .info-label {
              font-weight: 600;
              color: #34495e;
            }
            
            .info-value {
              color: #2c3e50;
            }
            
            @media print {
              body {
                padding: 0;
                background: white;
              }
              
              .certificate-border {
                border: none;
                padding: 0;
                box-shadow: none;
              }
              
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate-border">
            <div class="watermark">RL CLINIC</div>
            
            <div class="header">
              <div class="logo-container">
                <div class="logo">🐾</div>
                <div class="clinic-info">
                  <h1 class="clinic-name">RL VETERINARY CLINIC</h1>
                  <p class="tagline">Compassionate Care for Your Beloved Pets</p>
                  <p class="clinic-details">123 Paws Street • Petville, PV 98765 • (555) 123-PAWS</p>
                </div>
              </div>
              
              <h2 class="document-title">OFFICIAL MEDICAL RECORD</h2>
            </div>
            
            <div class="record-details">
              <div class="detail-section">
                <div class="section-title">Patient Information</div>
                
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Pet Name:</span>
                    <span class="info-value">${record.petName}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Species:</span>
                    <span class="info-value">${record.petType === "dog" ? "Canine (Dog)" : "Feline (Cat)"}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Breed:</span>
                    <span class="info-value">${record.breed || 'Not specified'}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Age:</span>
                    <span class="info-value">${record.petAge || 'Not specified'}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Birth Date:</span>
                    <span class="info-value">${record.birthDate ? formatDate(record.birthDate) : 'Not specified'}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Gender:</span>
                    <span class="info-value">${record.gender || 'Not specified'}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Color/Markings:</span>
                    <span class="info-value">${record.color || 'Not specified'}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="info-label">Weight:</span>
                    <span class="info-value">${record.weight || 'Not specified'}</span>
                  </div>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Owner&apos;s Name:</span>
                  <span class="detail-value">${record.ownerName}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Date of Visit:</span>
                  <span class="detail-value">${formatDate(record.date)}</span>
                </div>
              </div>
              
              ${record.allergies ? `
              <div class="detail-section">
                <div class="section-title">Allergies</div>
                <div class="detail-value">${record.allergies}</div>
              </div>
              ` : ''}
              
              ${record.existingConditions ? `
              <div class="detail-section">
                <div class="section-title">Existing Conditions</div>
                <div class="detail-value">${record.existingConditions}</div>
              </div>
              ` : ''}
              
              <div class="detail-section">
                <div class="section-title">Medical Information</div>
                
                <div class="detail-row">
                  <span class="detail-label">Diagnosis:</span>
                  <span class="detail-value diagnosis">${record.diagnosis}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Treatment:</span>
                  <span class="detail-value treatment">${record.treatment}</span>
                </div>
                
                ${record.veterinarian ? `
                <div class="detail-row">
                  <span class="detail-label">Attending Veterinarian:</span>
                  <span class="detail-value">${record.veterinarian}</span>
                </div>
                ` : ''}
              </div>
              
              ${record.notes ? `
              <div class="detail-section">
                <div class="section-title">Additional Notes & Observations</div>
                <div class="notes">${record.notes}</div>
              </div>
              ` : ""}
            </div>
            
            <div class="signature-area">
              <div>
                <div class="signature-line"></div>
                <div class="signature-label">Veterinarian&apos;s Signature</div>
              </div>
              
              <div>
                <div class="signature-line"></div>
                <div class="signature-label">Date</div>
              </div>
            </div>
            
            <div class="footer">
              <p>This document is an official medical record from RL Veterinary Clinic.</p>
              <p>Generated electronically on: ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              <p>For questions or concerns, please contact our office at (555) 123-PAWS</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printableContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  };

  /* Render states */
  if (loading) {
    return (
      <>
        <GlobalStyle />
        <Container><Loading>Loading medical records...</Loading></Container>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <GlobalStyle />
        <Container><EmptyText>Please log in to view your medical records.</EmptyText></Container>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <ClinicLogo>🐾</ClinicLogo>
            <div>
              <ClinicName>RL Clinic</ClinicName>
              <Tagline>Fursure Care - My Medical Records</Tagline>
            </div>
          </BrandSection>
          <ButtonGroup>
            <BackButton onClick={() => router.push("/userdashboard")}>
              <Icon className="material-icons">arrow_back</Icon>
              Back
            </BackButton>
          </ButtonGroup>
        </HeaderBar>

        <Content>
          <WelcomeMessage>
            Welcome, {currentUser.displayName || currentUser.email}!
          </WelcomeMessage>

          <SectionTitle>My Pet Medical Records</SectionTitle>
          {records.length === 0 ? (
            <EmptyState>
              <EmptyIcon>📋</EmptyIcon>
              <EmptyText>No medical records found</EmptyText>
              <EmptySubtext>You don&apos;t have any medical records yet.</EmptySubtext>
            </EmptyState>
          ) : (
            <RecordsGrid>
              {records.map((record) => (
                <RecordCard key={record.id}>
                  <RecordHeader>
                    <div>
                      <PetName>{record.petName}</PetName>
                      <PetInfo>
                        <PetType $petType={record.petType}>
                          {record.petType === "dog" ? "🐶 Dog" : "🐱 Cat"}
                        </PetType>
                        {record.breed && <BreedInfo>• {record.breed}</BreedInfo>}
                      </PetInfo>
                    </div>
                    <RecordDate>{formatDate(record.date)}</RecordDate>
                  </RecordHeader>

                  <ViewDetailsButton
                    onClick={() => setOpenRecordId(openRecordId === record.id ? null : record.id)}
                  >
                    {openRecordId === record.id ? "Hide Details" : "View Full Details"}
                    <Icon className="material-icons">
                      {openRecordId === record.id ? "▲" : "▼"}
                    </Icon>
                  </ViewDetailsButton>

                  <RecordDetails $open={openRecordId === record.id}>
                    <DetailGrid>
                      <DetailItem>
                        <DetailLabel>Owner:</DetailLabel>
                        <DetailValue>{record.ownerName}</DetailValue>
                      </DetailItem>
                      
                      {record.birthDate && (
                        <DetailItem>
                          <DetailLabel>Birth Date:</DetailLabel>
                          <DetailValue>{formatDate(record.birthDate)}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.petAge && (
                        <DetailItem>
                          <DetailLabel>Age:</DetailLabel>
                          <DetailValue>{record.petAge}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.gender && (
                        <DetailItem>
                          <DetailLabel>Gender:</DetailLabel>
                          <DetailValue>{record.gender}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.color && (
                        <DetailItem>
                          <DetailLabel>Color:</DetailLabel>
                          <DetailValue>{record.color}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.weight && (
                        <DetailItem>
                          <DetailLabel>Weight:</DetailLabel>
                          <DetailValue>{record.weight}</DetailValue>
                        </DetailItem>
                      )}
                      
                      <DetailItem>
                        <DetailLabel>Diagnosis:</DetailLabel>
                        <DiagnosisValue>{record.diagnosis}</DiagnosisValue>
                      </DetailItem>
                      
                      <DetailItem>
                        <DetailLabel>Treatment:</DetailLabel>
                        <TreatmentValue>{record.treatment}</TreatmentValue>
                      </DetailItem>
                      
                      {record.allergies && (
                        <DetailItem>
                          <DetailLabel>Allergies:</DetailLabel>
                          <DetailValue>{record.allergies}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.existingConditions && (
                        <DetailItem>
                          <DetailLabel>Existing Conditions:</DetailLabel>
                          <DetailValue>{record.existingConditions}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.veterinarian && (
                        <DetailItem>
                          <DetailLabel>Veterinarian:</DetailLabel>
                          <DetailValue>{record.veterinarian}</DetailValue>
                        </DetailItem>
                      )}
                      
                      {record.notes && (
                        <DetailItem $fullWidth>
                          <DetailLabel>Notes:</DetailLabel>
                          <DetailValue>{record.notes}</DetailValue>
                        </DetailItem>
                      )}
                    </DetailGrid>
                    
                    <ButtonGroupHorizontal>
                      <PrintButton onClick={() => downloadPDF(record)}>
                        <Icon className="material-icons">print</Icon>
                        Print as PDF
                      </PrintButton>
                    </ButtonGroupHorizontal>
                  </RecordDetails>
                </RecordCard>
              ))}
            </RecordsGrid>
          )}
        </Content>
      </PageContainer>
    </>
  );
};

export default UserMedicalRecords;

/* ===== STYLED COMPONENTS ===== */
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const HeaderBar = styled.header`
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
`;

const BrandSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ClinicLogo = styled.div`
  font-size: 2.5rem;
`;

const ClinicName = styled.h1`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
`;

const Tagline = styled.p`
  margin: 0.25rem 0 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`;

const Icon = styled.span`
  font-size: 1.1rem;
  margin-right: 0.4rem;
  display: inline-flex;
  align-items: center;
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }
`;

const Content = styled.main`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
`;

const Loading = styled.div`
  font-size: 1.1rem;
  color: #64748b;
`;

const WelcomeMessage = styled.h2`
  font-size: 1.5rem;
  color: #1e293b;
  margin-bottom: 1.5rem;
  font-weight: 500;
  
  @media (max-width: 480px) {
    font-size: 1.25rem;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1.5rem;
  
  @media (max-width: 480px) {
    font-size: 1.25rem;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 480px) {
    padding: 2rem 1rem;
  }
`;

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const EmptyText = styled.p`
  font-size: 1.25rem;
  color: #1e293b;
  font-weight: 600;
  margin-bottom: 0.5rem;
  
  @media (max-width: 480px) {
    font-size: 1.1rem;
  }
`;

const EmptySubtext = styled.p`
  color: #64748b;
  font-size: 1rem;
  
  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

const RecordsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const RecordCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  height: fit-content;
  border-top: 4px solid #6BC1E1;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  @media (max-width: 480px) {
    padding: 1.25rem;
  }
`;

const RecordHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const PetName = styled.h4`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
`;

const PetInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const PetType = styled.span<{ $petType: string }>`
  font-size: 0.85rem;
  color: ${props => props.$petType === 'dog' ? '#1d4ed8' : '#be185d'};
  background: ${props => props.$petType === 'dog' ? '#dbeafe' : '#fce7f3'};
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-weight: 500;
`;

const BreedInfo = styled.span`
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
`;

const RecordDate = styled.span`
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 500;
`;

const ViewDetailsButton = styled.button`
  background: linear-gradient(90deg, #34B89C, #6BC1E1);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
`;

const RecordDetails = styled.div<{ $open: boolean }>`
  display: ${(props) => (props.$open ? 'flex' : 'none')};
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  transition: all 0.3s ease;
`;

const DetailGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

// FIXED: Changed fullWidth to $fullWidth to avoid DOM attribute warning
const DetailItem = styled.div<{ $fullWidth?: boolean }>`
  display: flex;
  gap: 0.75rem;
  ${props => props.$fullWidth && `
    flex-direction: column;
    gap: 0.25rem;
  `}
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.25rem;
  }
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: #374151;
  min-width: 150px;
  
  @media (max-width: 480px) {
    min-width: auto;
  }
`;

const DetailValue = styled.span`
  color: #475569;
  flex: 1;
`;

const DiagnosisValue = styled(DetailValue)`
  color: #dc2626;
  font-weight: 600;
  background: #fef2f2;
  padding: 2px 6px;
  border-radius: 4px;
`;

const TreatmentValue = styled(DetailValue)`
  color: #059669;
  font-weight: 600;
  background: #f0fdf4;
  padding: 2px 6px;
  border-radius: 4px;
`;

const ButtonGroupHorizontal = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const PrintButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #2a947c;
    transform: translateY(-2px);
  }
`;