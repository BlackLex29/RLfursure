"use client";

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, deleteDoc, query, where } from "firebase/firestore";

// 🌍 Global Style
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Rozha+One&display=swap');
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #E6F4F1;
    scroll-behavior: smooth;
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

const UserDashboard: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const userEmail = auth.currentUser?.email;

  // 🔹 Fetch user appointments in real-time
  useEffect(() => {
    if (!userEmail) return;
    const q = query(collection(db, "appointments"), where("petOwner", "==", userEmail));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...(doc.data() as any) });
      });
      data.sort((a, b) => a.date.localeCompare(b.date));
      setAppointments(data);
    });
    return () => unsub();
  }, [userEmail]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      alert("Appointment deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to delete appointment.");
    }
  };

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <DashboardTitle>Welcome to RL Clinic</DashboardTitle>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <ProfileIcon>👤</ProfileIcon>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </div>
        </HeaderBar>

        <Content>
          <Card onClick={() => router.push("/schedule")}>
            <CardTitle>📅 Appointments</CardTitle>
            <CardText>Schedule, check, and manage your vet visits.</CardText>
          </Card>

          <Card onClick={() => router.push("/medicalrecord")}>
            <CardTitle>📑 Medical Records</CardTitle>
            <CardText>Keep track of your pet’s health history in one place.</CardText>
          </Card>

          <Card onClick={() => router.push("/vaccination")}>
            <CardTitle>💉 Vaccination Records</CardTitle>
            <CardText>View your pet’s vaccination history and reminders.</CardText>
          </Card>

          <AppointmentsSection>
            <SectionTitle>Your Appointments</SectionTitle>
            {appointments.length === 0 ? (
              <NoAppointments>No appointments yet.</NoAppointments>
            ) : (
              appointments.map((appt) => (
                <AppointmentCard key={appt.id}>
                  <div>
                    <strong>{appt.date}</strong> at <strong>{appt.timeSlot}</strong>
                  </div>
                  <div>Pet: {appt.petName || "Not Registered"}</div>
                  <div>Status: {appt.status || "Pending"}</div>
                  <div>Payment: {appt.paymentMethod || "N/A"}</div>
                  <CancelButton onClick={() => handleDelete(appt.id)}>Delete</CancelButton>
                </AppointmentCard>
              ))
            )}
          </AppointmentsSection>
        </Content>
      </PageContainer>
    </>
  );
};

export default UserDashboard;

// 🔹 Styled Components
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const HeaderBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px 40px;
  background: #ffffff;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 10;
`;

const DashboardTitle = styled.h2`
  font-size: 30px;
  font-weight: bold;
  font-family: "Rozha One", serif;
  background: linear-gradient(to right, #6bc1e1, #34b89c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;

  @media(max-width: 768px) {
    font-size: 24px;
  }
`;

const ProfileIcon = styled.div`
  font-size: 26px;
`;

const LogoutButton = styled.button`
  background: #34b89c;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover {
    background: #2a8f78;
  }
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding: 40px 60px;
  overflow-y: auto;

  @media(max-width: 768px) {
    padding: 20px 20px;
  }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 18px;
  padding: 35px;
  box-shadow: 0px 6px 20px rgba(0, 0, 0, 0.1);
  text-align: left;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0px 8px 25px rgba(0, 0, 0, 0.15);
  }

  @media(max-width: 768px) {
    padding: 25px;
  }
`;

const CardTitle = styled.h3`
  font-size: 22px;
  font-weight: 600;
  color: #34b89c;
  margin-bottom: 10px;
`;

const CardText = styled.p`
  font-size: 15px;
  color: #555;
`;

const AppointmentsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 40px;
`;

const SectionTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: #0077ff;
`;

const AppointmentCard = styled.div`
  background: #ffffff;
  padding: 18px 22px;
  border-radius: 14px;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const NoAppointments = styled.p`
  font-size: 15px;
  color: #555;
`;

const CancelButton = styled.button`
  align-self: flex-start;
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  margin-top: 6px;
  transition: background 0.2s;

  &:hover {
    background: #b02a37;
  }
`;
