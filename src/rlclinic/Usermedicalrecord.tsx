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
  doc,
  setDoc,
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
        collection(db, "userMedicalRecord"),
        where("ownerEmail", "==", userEmail),
        orderBy("date", "desc")
      );
      const snapshot = await getDocs(q);
      const userRecords: MedicalRecord[] = [];
      snapshot.forEach((docSnap) => {
        userRecords.push({ id: docSnap.id, ...(docSnap.data() as Omit<MedicalRecord, "id">) });
      });
      setRecords(userRecords);
    } catch (error) {
      console.error("Error fetching user medical records:", error);
      alert("Failed to load medical records.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Update user medical record */
  const updateUserMedicalRecord = useCallback(
    async (record: MedicalRecord, userEmail?: string | null) => {
      if (!userEmail) return;
      if (record.ownerEmail !== userEmail) return;

      try {
        await setDoc(doc(db, "userMedicalRecord", record.id), record);
      } catch (error) {
        console.error("Error updating user medical record:", error);
      }
    },
    []
  );

  /* Subscribe to realtime updates */
  const subscribeToMedicalRecordUpdates = useCallback(
    (userEmail?: string | null) => {
      if (!userEmail) return;
      const q = query(collection(db, "medicalRecords"), orderBy("date", "desc"));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const recordData = { id: change.doc.id, ...(change.doc.data() as Omit<MedicalRecord, "id">) };
          await updateUserMedicalRecord(recordData, userEmail);
        }
        await fetchUserMedicalRecords(userEmail);
      });
      return unsubscribe;
    },
    [fetchUserMedicalRecords, updateUserMedicalRecord]
  );

  /* Handle auth state */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      const email = user?.email ?? null;
      if (email) {
        await fetchUserMedicalRecords(email);
        const unsubscribeSnapshot = subscribeToMedicalRecordUpdates(email);
        return () => unsubscribeSnapshot?.();
      } else {
        setRecords([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, fetchUserMedicalRecords, subscribeToMedicalRecordUpdates]);

  /* Format date */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  /* Print as PDF */
  const downloadPDF = (record: MedicalRecord) => {
    const printableContent = `
      <html>
        <head>
          <title>Medical Record - ${record.petName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #334155;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #34B89C;
              padding-bottom: 20px;
            }
            .clinic-name {
              color: #34B89C;
              font-size: 28px;
              font-weight: bold;
              margin: 0;
            }
            .tagline {
              color: #6BC1E1;
              font-size: 16px;
              margin: 5px 0 0 0;
            }
            .record-details {
              margin-bottom: 20px;
            }
            .detail-row {
              display: flex;
              margin-bottom: 10px;
            }
            .detail-label {
              font-weight: bold;
              min-width: 120px;
              color: #334155;
            }
            .footer {
              margin-top: 40px;
              font-size: 12px;
              color: #666;
              text-align: center;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="clinic-name">RL Clinic</h1>
            <p class="tagline">Fursure Care - Medical Record</p>
          </div>
          
          <div class="record-details">
            <div class="detail-row">
              <span class="detail-label">Pet Name:</span>
              <span>${record.petName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Pet Type:</span>
              <span>${record.petType === "dog" ? "Dog" : "Cat"}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Owner:</span>
              <span>${record.ownerName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${formatDate(record.date)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Diagnosis:</span>
              <span>${record.diagnosis}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Treatment:</span>
              <span>${record.treatment}</span>
            </div>
            ${record.notes ? `
            <div class="detail-row">
              <span class="detail-label">Notes:</span>
              <span>${record.notes}</span>
            </div>
            ` : ""}
          </div>
          
          <div class="footer">
            <p>This document is generated electronically and does not require a signature.</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printableContent);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
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
              <Icon className="material-icons"></Icon>
              Back to Home
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
              <EmptySubtext>You dont have any medical records yet.</EmptySubtext>
            </EmptyState>
          ) : (
            <RecordsGrid>
              {records.map((record) => (
                <RecordCard key={record.id}>
                  <RecordHeader>
                    <div>
                      <PetName>{record.petName}</PetName>
                      <PetType $petType={record.petType}>
                        {record.petType === "dog" ? "🐶 Dog" : "🐱 Cat"}
                      </PetType>
                    </div>
                    <RecordDate>{formatDate(record.date)}</RecordDate>
                  </RecordHeader>

                  <ViewDetailsButton
                    onClick={() => setOpenRecordId(openRecordId === record.id ? null : record.id)}
                  >
                    {openRecordId === record.id ? "Hide Details" : "View Details"}
                    <Icon className="material-icons">
                      {openRecordId === record.id ? "⬆" : "⬇"}
                    </Icon>
                  </ViewDetailsButton>

                  <RecordDetails $open={openRecordId === record.id}>
                    <DetailItem>
                      <DetailLabel>Owner:</DetailLabel>
                      <DetailValue>{record.ownerName}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Diagnosis:</DetailLabel>
                      <DiagnosisValue>{record.diagnosis}</DiagnosisValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Treatment:</DetailLabel>
                      <TreatmentValue>{record.treatment}</TreatmentValue>
                    </DetailItem>
                    {record.notes && (
                      <DetailItem>
                        <DetailLabel>Notes:</DetailLabel>
                        <DetailValue>{record.notes}</DetailValue>
                      </DetailItem>
                    )}
                    <ButtonGroupHorizontal>
                      <PrintButton onClick={() => downloadPDF(record)}>
                        <Icon className="material-icons"></Icon>
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
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
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
  height: 100%;
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

const PetType = styled.span<{ $petType: string }>`
  font-size: 0.85rem;
  color: ${props => props.$petType === 'dog' ? '#1d4ed8' : '#be185d'};
  background: ${props => props.$petType === 'dog' ? '#dbeafe' : '#fce7f3'};
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-weight: 500;
`;

const RecordDate = styled.span`
  font-size: 0.9rem;
  color: #64748b;
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
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  transition: all 0.3s ease;
`;

const DetailItem = styled.div`
  display: flex;
  gap: 0.75rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.25rem;
  }
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: #374151;
  min-width: 80px;
  
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
`;

const TreatmentValue = styled(DetailValue)`
  color: #059669;
  font-weight: 600;
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