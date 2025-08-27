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

          <CalendarContainer>
            {Object.keys(groupedByDate).length === 0 ? (
              <NoAppointments>No appointments yet.</NoAppointments>
            ) : (
              Object.keys(groupedByDate).map((date) => (
                <DateSection key={date}>
                  <DateHeader>{date}</DateHeader>
                  <SlotsRow>
                    {groupedByDate[date].map((appt: AppointmentType) => {
                      let statusColor = "#ffc107"; // Pending
                      if (appt.status === "Confirmed") statusColor = "#28a745";
                      if (appt.status === "Cancelled") statusColor = "#dc3545";

                      let paymentColor = "#555";
                      if (appt.paymentMethod === "Cash") paymentColor = "#ff7f50";
                      if (appt.paymentMethod === "Online") paymentColor = "#0077ff";

                      return (
                        <SlotCard key={appt.id} color={statusColor}>
                          <TopRow>
                            <SlotTime>{appt.timeSlot}</SlotTime>
                            <StatusBadge bg={statusColor}>{appt.status || "Pending"}</StatusBadge>
                          </TopRow>
                          <Divider />
                          <ClientName>👤 {appt.clientName || "Unknown Client"}</ClientName>
                          <PetName>🐾 {appt.petName || "Not Registered"}</PetName>
                          <PaymentMethod style={{ color: paymentColor }}>
                            💳 {appt.paymentMethod || "Not Paid"}
                          </PaymentMethod>
                          <ButtonGroup>
                            <SmallButton
                              onClick={() => handleStatusUpdate(appt.id, "Confirmed")}
                              bg="#28a745"
                            >
                              ✅ Confirm
                            </SmallButton>
                            <SmallButton
                              onClick={() => handleDelete(appt.id)}
                              bg="#dc3545"
                            >
                              ❌ Cancel
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

  // === Styled Components ===
  const MainWrapper = styled.div`
    min-height: 100vh;
    padding: 30px 60px;
    background: linear-gradient(135deg, #f0f4f8, #ffffff);
  `;

  const HeaderBar = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  `;

  const DashboardTitle = styled.h2`
    font-size: 26px;
    color: #1f2937;
    font-weight: bold;
    font-family: "Rozha One", serif;
  `;

  const HeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: 15px;
  `;

  const ProfileIcon = styled.div`
    background: #fff;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 22px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    cursor: pointer;
  `;

  const LogoutButton = styled.button`
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    padding: 10px 18px;
    cursor: pointer;
    font-size: 14px;
    &:hover {
      opacity: 0.9;
    }
  `;

  const BackButton = styled.button`
    background: #e5e7eb;
    border: none;
    border-radius: 8px;
    color: #374151;
    padding: 8px 14px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    &:hover {
      background-color: #d1d5db;
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
    gap: 16px;
  `;

  const DateHeader = styled.h3`
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    border-bottom: 2px solid #ff5e62;
    padding-bottom: 6px;
  `;

  const SlotsRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  `;

  const SlotCard = styled.div<{ color: string }>`
    background-color: #fff;
    border-left: 6px solid ${(props) => props.color};
    padding: 20px;
    border-radius: 12px;
    width: 260px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: ${fadeIn} 0.4s ease forwards;
    transition: transform 0.2s ease;
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }
  `;

  const TopRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const Divider = styled.div`
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  `;

  const SlotTime = styled.strong`
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

  const ClientName = styled.div`
    font-size: 14px;
    color: #374151;
  `;

  const PetName = styled.div`
    font-size: 14px;
    color: #374151;
  `;

  const PaymentMethod = styled.div`
    font-size: 13px;
    font-weight: 500;
  `;

  const ButtonGroup = styled.div`
    display: flex;
    gap: 10px;
    margin-top: 8px;
  `;

  const SmallButton = styled.button<{ bg: string }>`
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

  const NoAppointments = styled.p`
    font-size: 16px;
    color: #6b7280;
    text-align: center;
  `;

  export default ManageAppointments;
