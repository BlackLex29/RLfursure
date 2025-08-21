"use client";

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Rozha+One&display=swap');
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f0f4f8;
    margin: 0;
    padding: 0;
  }
`;

interface AppointmentType {
  id: string;
  clientName: string;
  petName: string;
  date: string;
  timeSlot: string;
  status?: string;
  paymentMethod?: string; // 💡 Add paymentMethod
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ManageAppointments: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      alert("Logout failed: " + (error as Error).message);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "appointments"), (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...(doc.data() as any) }));
      data.sort((a, b) => a.date.localeCompare(b.date));
      setAppointments(data);
    });
    return () => unsub();
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const docRef = doc(db, "appointments", id);
      await updateDoc(docRef, { status });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const groupedByDate = appointments.reduce((acc: any, appt) => {
    acc[appt.date] = acc[appt.date] ? [...acc[appt.date], appt] : [appt];
    return acc;
  }, {});

  return (
    <>
      <GlobalStyle />
      <MainWrapper>
        <HeaderBar>
          <DashboardTitle>RL CLINIC - Appointments</DashboardTitle>
          <HeaderActions>
            <ProfileIcon>🛡️</ProfileIcon>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </HeaderActions>
        </HeaderBar>

        <CalendarContainer>
          {Object.keys(groupedByDate).length === 0 ? (
            <NoAppointments>No appointments yet.</NoAppointments>
          ) : (
            Object.keys(groupedByDate).map((date) => (
              <DateSection key={date}>
                <DateHeader>{date}</DateHeader>
                <SlotsRow>
                  {groupedByDate[date].map((appt: AppointmentType) => {
                    // Status color
                    let statusColor = "#ffc107"; // Pending
                    if (appt.status === "Confirmed") statusColor = "#28a745";
                    if (appt.status === "Cancelled") statusColor = "#dc3545";

                    // Payment color
                    let paymentColor = "#555"; // Default gray
                    if (appt.paymentMethod === "Cash") paymentColor = "#ff7f50"; // Coral
                    if (appt.paymentMethod === "Online") paymentColor = "#0077ff"; // Blue

                    return (
                      <SlotCard key={appt.id} color={statusColor}>
                        <SlotTime>{appt.timeSlot}</SlotTime>
                        <ClientName>Client: {appt.clientName || "Unknown"}</ClientName>
                        <PetName>Pet: {appt.petName || "Not Registered"}</PetName>
                        <PaymentMethod style={{ color: paymentColor }}>
                          Payment: {appt.paymentMethod || "Not Paid"}
                        </PaymentMethod>
                        <ButtonGroup>
                          <SmallButton
                            onClick={() => handleStatusUpdate(appt.id, "Confirmed")}
                            bg="#28a745"
                          >
                            Confirm
                          </SmallButton>
                          <SmallButton
                            onClick={() => handleStatusUpdate(appt.id, "Cancelled")}
                            bg="#dc3545"
                          >
                            Cancel
                          </SmallButton>
                        </ButtonGroup>
                      </SlotCard>
                    );
                  })}
                </SlotsRow>
              </DateSection>
            ))
          )}
        </CalendarContainer>
      </MainWrapper>
    </>
  );
};

// Styled Components
const MainWrapper = styled.div`
  min-height: 100vh;
  padding: 40px;
`;

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
`;

const DashboardTitle = styled.h2`
  font-size: 28px;
  color: #ff5e62;
  font-weight: bold;
  font-family: "Rozha One", serif;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const ProfileIcon = styled.div`
  background-color: #ffffff;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  cursor: pointer;
`;

const LogoutButton = styled.button`
  background-color: #d9534f;
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: bold;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
  &:hover {
    background-color: #c9302c;
  }
`;

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const DateSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DateHeader = styled.h3`
  font-size: 18px;
  font-weight: bold;
  color: #333;
  border-bottom: 2px solid #ff5e62;
  padding-bottom: 6px;
`;

const SlotsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
`;

const SlotCard = styled.div<{ color: string }>`
  background-color: #f8f9fa;
  border-left: 6px solid ${(props) => props.color};
  padding: 20px;
  border-radius: 12px;
  max-width: 220px;
  width: 100%;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: ${fadeIn} 0.5s ease forwards;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
`;

const SlotTime = styled.strong`
  font-size: 16px;
  font-weight: bold;
`;

const ClientName = styled.div`
  font-size: 14px;
`;

const PetName = styled.div`
  font-size: 14px;
`;

const PaymentMethod = styled.div`
  font-size: 13px;
  font-weight: 500;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
`;

const SmallButton = styled.button<{ bg: string }>`
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  background-color: ${(props) => props.bg};
  color: #fff;
  transition: opacity 0.3s ease;
  &:hover {
    opacity: 0.85;
  }
`;

const NoAppointments = styled.p`
  font-size: 16px;
  color: #555;
  text-align: center;
`;

export default ManageAppointments;
