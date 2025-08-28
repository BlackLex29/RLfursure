"use client";

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { collection, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Rozha+One&display=swap');
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #eef2f7;
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
  paymentMethod?: string;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ManageAppointments: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateIndex, setDateIndex] = useState<number>(0);

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
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as Omit<AppointmentType, "id">;
        data.push({ id: docSnap.id, ...d });
      });
      data.sort((a, b) => a.date.localeCompare(b.date));
      setAppointments(data);
      
      // Set the first date as selected by default
      if (data.length > 0 && !selectedDate) {
        setSelectedDate(data[0].date);
      }
    });
    return () => unsub();
  }, [selectedDate]); // Added selectedDate to dependency array

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const docRef = doc(db, "appointments", id);
      await updateDoc(docRef, { status });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      alert("Appointment cancelled and removed.");
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  const groupedByDate: Record<string, AppointmentType[]> = appointments.reduce((acc, appt) => {
    if (!acc[appt.date]) acc[appt.date] = [];
    acc[appt.date].push(appt);
    return acc;
  }, {} as Record<string, AppointmentType[]>);

  // Get sorted unique dates
  const sortedDates = Object.keys(groupedByDate).sort();
  
  // Set selected date based on dateIndex
  useEffect(() => {
    if (sortedDates.length > 0) {
      if (dateIndex >= sortedDates.length) {
        setDateIndex(0);
      }
      setSelectedDate(sortedDates[dateIndex]);
    }
  }, [dateIndex, sortedDates]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Navigation handlers
  const handlePrevDate = () => {
    if (dateIndex > 0) {
      setDateIndex(dateIndex - 1);
    }
  };

  const handleNextDate = () => {
    if (dateIndex < sortedDates.length - 1) {
      setDateIndex(dateIndex + 1);
    }
  };

  return (
    <>
      <GlobalStyle />
      <MainWrapper>
        <HeaderBar>
          <BackButton onClick={() => router.push("/admindashboard")}>⬅ Back</BackButton>
          <DashboardTitle>RL CLINIC - Appointments</DashboardTitle>
          <HeaderActions>
            <ProfileIcon>🛡️</ProfileIcon>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </HeaderActions>
        </HeaderBar>

        {sortedDates.length > 0 ? (
          <>
            <DateNavigation>
              <NavButton onClick={handlePrevDate} disabled={dateIndex === 0}>
                ◀
              </NavButton>
              <SelectedDate>
                {selectedDate ? formatDate(selectedDate) : "No appointments"}
              </SelectedDate>
              <NavButton 
                onClick={handleNextDate} 
                disabled={dateIndex === sortedDates.length - 1}
              >
                ▶
              </NavButton>
            </DateNavigation>

            <DateIndicator>
              {dateIndex + 1} of {sortedDates.length} days with appointments
            </DateIndicator>

            <AppointmentsContainer>
              {selectedDate && groupedByDate[selectedDate].map((appt: AppointmentType) => {
                let statusColor = "#ffc107"; // Pending
                if (appt.status === "Confirmed") statusColor = "#28a745";
                if (appt.status === "Cancelled") statusColor = "#dc3545";

                let paymentColor = "#555";
                if (appt.paymentMethod === "Cash") paymentColor = "#ff7f50";
                if (appt.paymentMethod === "Online") paymentColor = "#0077ff";

                return (
                  <AppointmentCard key={appt.id} color={statusColor}>
                    <CardHeader>
                      <TimeSlot>{appt.timeSlot}</TimeSlot>
                      <StatusBadge bg={statusColor}>{appt.status || "Pending"}</StatusBadge>
                    </CardHeader>
                    
                    <CardContent>
                      <InfoItem>
                        <Icon>👤</Icon>
                        <InfoText>{appt.clientName || "Unknown Client"}</InfoText>
                      </InfoItem>
                      
                      <InfoItem>
                        <Icon>🐾</Icon>
                        <InfoText>{appt.petName || "Not Registered"}</InfoText>
                      </InfoItem>
                      
                      <InfoItem>
                        <Icon>💳</Icon>
                        <InfoText style={{ color: paymentColor }}>
                          {appt.paymentMethod || "Not Paid"}
                        </InfoText>
                      </InfoItem>
                    </CardContent>
                    
                    <ActionButtons>
                      <ActionButton
                        onClick={() => handleStatusUpdate(appt.id, "Confirmed")}
                        bg="#28a745"
                      >
                        ✅ Confirm
                      </ActionButton>
                      <ActionButton
                        onClick={() => handleDelete(appt.id)}
                        bg="#dc3545"
                      >
                        ❌ Cancel
                      </ActionButton>
                    </ActionButtons>
                  </AppointmentCard>
                );
              })}
            </AppointmentsContainer>
          </>
        ) : (
          <NoAppointments>
            <NoAppointmentsIcon>📅</NoAppointmentsIcon>
            <NoAppointmentsText>No appointments scheduled yet</NoAppointmentsText>
          </NoAppointments>
        )}
      </MainWrapper>
    </>
  );
};

// === Styled Components ===
const MainWrapper = styled.div`
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #f0f4f8, #ffffff);
  
  @media (min-width: 768px) {
    padding: 30px 40px;
  }
  
  @media (min-width: 1024px) {
    padding: 30px 60px;
  }
`;

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
`;

const DashboardTitle = styled.h2`
  font-size: 22px;
  color: #1f2937;
  font-weight: bold;
  font-family: "Rozha One", serif;
  margin: 0;
  
  @media (min-width: 768px) {
    font-size: 26px;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const ProfileIcon = styled.div`
  background: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  
  @media (min-width: 768px) {
    width: 48px;
    height: 48px;
    font-size: 22px;
  }
`;

const LogoutButton = styled.button`
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    opacity: 0.9;
  }
  
  @media (min-width: 768px) {
    padding: 10px 18px;
    font-size: 14px;
  }
`;

const BackButton = styled.button`
  background: #e5e7eb;
  border: none;
  border-radius: 8px;
  color: #374151;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  
  &:hover {
    background-color: #d1d5db;
  }
  
  @media (min-width: 768px) {
    font-size: 14px;
  }
`;

const DateNavigation = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 15px;
  padding: 15px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
`;

const NavButton = styled.button<{ disabled?: boolean }>`
  background: ${props => props.disabled ? '#f3f4f6' : '#3b82f6'};
  color: ${props => props.disabled ? '#9ca3af' : 'white'};
  border: none;
  border-radius: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  
  &:hover {
    background: ${props => props.disabled ? '#f3f4f6' : '#2563eb'};
  }
`;

const SelectedDate = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
  margin: 0;
  
  @media (min-width: 768px) {
    font-size: 22px;
  }
`;

const DateIndicator = styled.p`
  text-align: center;
  color: #6b7280;
  margin-bottom: 25px;
  font-size: 14px;
`;

const AppointmentsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  
  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  @media (min-width: 1280px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const AppointmentCard = styled.div<{ color: string }>`
  background-color: #fff;
  border-left: 6px solid ${(props) => props.color};
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 15px;
  animation: ${fadeIn} 0.4s ease forwards;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TimeSlot = styled.strong`
  font-size: 16px;
  font-weight: 700;
  color: #111827;
`;

const StatusBadge = styled.span<{ bg: string }>`
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  color: #fff;
  background-color: ${(props) => props.bg};
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Icon = styled.span`
  font-size: 16px;
`;

const InfoText = styled.span`
  font-size: 14px;
  color: #374151;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 5px;
`;

const ActionButton = styled.button<{ bg: string }>`
  flex: 1;
  padding: 8px 0;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background-color: ${(props) => props.bg};
  color: #fff;
  transition: opacity 0.3s ease;
  
  &:hover {
    opacity: 0.85;
  }
`;

const NoAppointments = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
`;

const NoAppointmentsIcon = styled.div`
  font-size: 60px;
  margin-bottom: 20px;
`;

const NoAppointmentsText = styled.p`
  font-size: 18px;
  color: #6b7280;
  margin: 0;
`;

export default ManageAppointments;