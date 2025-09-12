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
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #E6F4F1;
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
        <head><title>Medical Record - ${record.petName}</title></head>
        <body>
          <h2>RL Clinic - Fursure Care</h2>
          <h3>Medical Record</h3>
          <p><b>Pet Name:</b> ${record.petName}</p>
          <p><b>Pet Type:</b> ${record.petType === "dog" ? "Dog" : "Cat"}</p>
          <p><b>Owner:</b> ${record.ownerName}</p>
          <p><b>Date:</b> ${formatDate(record.date)}</p>
          <p><b>Diagnosis:</b> ${record.diagnosis}</p>
          <p><b>Treatment:</b> ${record.treatment}</p>
          ${record.notes ? `<p><b>Notes:</b> ${record.notes}</p>` : ""}
          <p style="margin-top:30px;font-size:12px;color:#666;">
            This document is generated electronically and does not require a signature.<br/>
            Generated on: ${new Date().toLocaleDateString()}
          </p>
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
            <ClinicName>RL Clinic</ClinicName>
            <Tagline>Fursure Care - My Medical Records</Tagline>
          </BrandSection>
          <ButtonGroup>
            <BackButton onClick={() => router.push("/userdashboard")}>&larr; Back to Home</BackButton>
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
                      <PetType>{record.petType === "dog" ? "Dog" : "Cat"}</PetType>
                    </div>
                    <RecordDate>{formatDate(record.date)}</RecordDate>
                  </RecordHeader>

                  <ViewDetailsButton
                    onClick={() => setOpenRecordId(openRecordId === record.id ? null : record.id)}
                  >
                    {openRecordId === record.id ? "Hide Details" : "View Details"}
                  </ViewDetailsButton>

                  <RecordDetails $open={openRecordId === record.id}>
                    <DetailItem>
                      <DetailLabel>Owner:</DetailLabel>
                      <DetailValue>{record.ownerName}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Diagnosis:</DetailLabel>
                      <DetailValue>{record.diagnosis}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Treatment:</DetailLabel>
                      <DetailValue>{record.treatment}</DetailValue>
                    </DetailItem>
                    {record.notes && (
                      <DetailItem>
                        <DetailLabel>Notes:</DetailLabel>
                        <DetailValue>{record.notes}</DetailValue>
                      </DetailItem>
                    )}
                    <ButtonGroupHorizontal>
                      <PrintButton onClick={() => downloadPDF(record)}>Print as PDF</PrintButton>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: linear-gradient(135deg, #6bc1e1 0%, #34b89c 100%);
  color: white;
  box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
  gap: 20px;

  @media (max-width: 768px) {
    padding: 15px 20px;
    flex-direction: column;
    align-items: flex-start;
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
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);

  @media (max-width: 768px) {
    font-size: 28px;
  }
  
  @media (max-width: 480px) {
    font-size: 24px;
  }
`;

const Tagline = styled.p`
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  opacity: 0.9;
  letter-spacing: 1px;
  
  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  align-items: center;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  @media (max-width: 480px) {
    padding: 8px 16px;
    font-size: 13px;
  }
`;

const Content = styled.div`
  flex: 1;
  padding: 40px;
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 20px;
  }
  
  @media (max-width: 480px) {
    padding: 15px;
  }
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
`;

const Loading = styled.div`
  font-size: 18px;
  color: #666;
`;

const WelcomeMessage = styled.h2`
  font-size: 20px;
  color: #2c3e50;
  margin-bottom: 20px;
  font-weight: 500;
  
  @media (max-width: 480px) {
    font-size: 18px;
  }
`;

const SectionTitle = styled.h3`
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 25px;
  
  @media (max-width: 480px) {
    font-size: 20px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 480px) {
    padding: 40px 15px;
  }
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 20px;
`;

const EmptyText = styled.p`
  font-size: 20px;
  color: #2c3e50;
  font-weight: 600;
  margin-bottom: 10px;
  
  @media (max-width: 480px) {
    font-size: 18px;
  }
`;

const EmptySubtext = styled.p`
  color: #666;
  font-size: 16px;
  
  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

const RecordsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const RecordCard = styled.div`
  background: white;
  padding: 25px;
  border-radius: 16px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  border-left: 5px solid #6bc1e1;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  }
  
  @media (max-width: 480px) {
    padding: 20px;
  }
`;

const RecordHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 10px;
  }
`;

const PetName = styled.h4`
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 5px 0;
`;

const PetType = styled.span`
  font-size: 14px;
  color: #666;
  background: #f0f7ff;
  padding: 3px 8px;
  border-radius: 12px;
`;

const RecordDate = styled.span`
  font-size: 14px;
  color: #666;
`;

const ViewDetailsButton = styled.button`
  background: linear-gradient(90deg, #6bc1e1, #34b89c);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
  width: 100%;

  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
`;

const RecordDetails = styled.div<{ $open: boolean }>`
  display: ${(props) => (props.$open ? 'flex' : 'none')};
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  transition: all 0.3s ease;
`;

const DetailItem = styled.div`
  display: flex;
  gap: 10px;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 5px;
  }
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: #2c3e50;
  min-width: 80px;
  
  @media (max-width: 480px) {
    min-width: auto;
  }
`;

const DetailValue = styled.span`
  color: #666;
  flex: 1;
`;

const ButtonGroupHorizontal = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 15px;
`;

const PrintButton = styled.button`
  background: #2c3e50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #1a252f;
  }
`;