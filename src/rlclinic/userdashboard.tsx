'use client';

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, deleteDoc, query, where, updateDoc, getDoc } from "firebase/firestore";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f8fafc;
    scroll-behavior: smooth;
  }
  
  * {
    box-sizing: border-box;
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

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
}

const timeSlots = [
  "8:00 AM–8:30 AM",
  "9:00 AM–9:30 AM",
  "10:00 AM–10:30 AM",
  "11:00 AM–11:30 AM",
  "1:00 PM–1:30 PM",
  "2:00 PM–2:30 PM",
  "3:00 PM–3:30 PM",
  "4:00 PM–4:30 PM",
  "5:00 PM–5:30 PM"
];

const UserDashboard: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Fix for hydration: Wait for component to mount on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fix for hydration: Use the same initial value on server and client
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().split("T")[0]);
  }, []);

  const userEmail = auth.currentUser?.email;
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userEmail || !userId) return;

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          setUserProfile({
            firstName: userEmail.split('@')[0],
            lastName: "",
            email: userEmail
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile({
          firstName: userEmail.split('@')[0],
          lastName: "",
          email: userEmail
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    const q = query(
      collection(db, "appointments"),
      where("clientName", "==", userEmail)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...(doc.data() as Omit<AppointmentType, 'id'>) });
      });
      data.sort((a, b) => a.date.localeCompare(b.date));
      setAppointments(data);
    });

    return () => unsub();
  }, [userEmail, userId]);

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

  const startEditing = (appt: AppointmentType) => {
    setEditingId(appt.id);
    setEditDate(appt.date || today);
    setEditSlot(appt.timeSlot);
  };

  const saveEdit = async (id: string) => {
    if (!editDate || !editSlot) return alert("Please select date and time slot.");

    const isTaken = appointments.some(a =>
      a.id !== id &&
      a.date === editDate &&
      a.timeSlot === editSlot &&
      a.status !== "Cancelled"
    );
    if (isTaken) return alert("This time slot is already taken.");

    try {
      await updateDoc(doc(db, "appointments", id), {
        date: editDate,
        timeSlot: editSlot
      });
      setEditingId(null);
      alert("Appointment updated successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to update appointment.");
    }
  };

  const cancelEdit = () => setEditingId(null);

  // Prevent rendering until client-side to avoid hydration mismatch
  if (!isClient) {
    return (
      <>
        <GlobalStyle />
        <PageContainer>
          <HeaderBar>
            <HeaderLeft>
              <WelcomeSection>
                <WelcomeTitle>Loading...</WelcomeTitle>
              </WelcomeSection>
            </HeaderLeft>
          </HeaderBar>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        {/* Header with mobile hamburger menu */}
        <HeaderBar>
          <HeaderLeft>
            <MobileMenuButton onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <HamburgerIcon className={isMenuOpen ? "open" : ""}>
                <span></span>
                <span></span>
                <span></span>
              </HamburgerIcon>
            </MobileMenuButton>
            <WelcomeSection>
              {loading ? (
                <WelcomeTitle>Loading...</WelcomeTitle>
              ) : (
                <WelcomeTitle>
                  Welcome back, {userProfile?.firstName} {userProfile?.lastName}!
                </WelcomeTitle>
              )}
              <WelcomeSubtitle>How can we help your pet today?</WelcomeSubtitle>
            </WelcomeSection>
          </HeaderLeft>
          
          <HeaderRight className={isMenuOpen ? "open" : ""}>
            <ProfileSection>
              <ProfileIcon>👤</ProfileIcon>
              {loading ? (
                <ProfileName>Loading...</ProfileName>
              ) : (
                <ProfileName>
                  {userProfile?.firstName} {userProfile?.lastName}
                </ProfileName>
              )}
            </ProfileSection>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </HeaderRight>
        </HeaderBar>

        {/* Main content */}
        <Content>
          {/* Navigation cards */}
          <CardsGrid>
            <Card onClick={() => router.push("/petregistration")}>
              <CardIcon>🐾</CardIcon>
              <CardTitle>Register Pet</CardTitle>
              <CardText>Add your pet to get started with appointments</CardText>
            </Card>

            <Card onClick={() => router.push("/appointment")}>
              <CardIcon>📅</CardIcon>
              <CardTitle>Book Appointment</CardTitle>
              <CardText>Schedule a new vet visit for your pet</CardText>
            </Card>

            <Card onClick={() => router.push("/usermedicalrecord")}>
              <CardIcon>📑</CardIcon>
              <CardTitle>Medical Records</CardTitle>
              <CardText>View your pet&apos;s health history</CardText>
            </Card>

            <Card onClick={() => router.push("/uservaccination")}>
              <CardIcon>💉</CardIcon>
              <CardTitle>Vaccinations</CardTitle>
              <CardText>Track vaccination history and reminders</CardText>
            </Card>
          </CardsGrid>

          {/* Appointments section */}
          <AppointmentsSection>
            <SectionHeader>
              <SectionTitle>Your Appointments</SectionTitle>
              <AppointmentCount>{appointments.length} scheduled</AppointmentCount>
            </SectionHeader>

            {appointments.length === 0 ? (
              <NoAppointments>
                <NoAppointmentsIcon>📅</NoAppointmentsIcon>
                <NoAppointmentsText>No appointments scheduled yet</NoAppointmentsText>
                <ScheduleButton onClick={() => router.push("/appointment")}>
                  Schedule an Appointment
                </ScheduleButton>
              </NoAppointments>
            ) : (
              <AppointmentsList>
                {appointments
                  .filter(a => a.petName)
                  .map((appt) => (
                    <AppointmentCard key={appt.id}>
                      {editingId === appt.id ? (
                        <EditForm>
                          <EditTitle>Edit Appointment</EditTitle>
                          <FormGroup>
                            <Label>Date:</Label>
                            <DateInput
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              min={today}
                            />
                          </FormGroup>
                          <FormGroup>
                            <Label>Time Slot:</Label>
                            <SelectInput
                              value={editSlot}
                              onChange={(e) => setEditSlot(e.target.value)}
                            >
                              <option value="">Select a time slot</option>
                              {timeSlots.map(slot => {
                                const isTaken = appointments.some(a =>
                                  a.id !== appt.id &&
                                  a.date === editDate &&
                                  a.timeSlot === slot &&
                                  a.status !== "Cancelled"
                                );
                                return (
                                  <option key={slot} value={slot} disabled={isTaken}>
                                    {slot} {isTaken ? "(Taken)" : ""}
                                  </option>
                                );
                              })}
                            </SelectInput>
                          </FormGroup>
                          <EditButtonRow>
                            <SaveButton onClick={() => saveEdit(appt.id)}>Save Changes</SaveButton>
                            <CancelEditButton onClick={cancelEdit}>Cancel</CancelEditButton>
                          </EditButtonRow>
                        </EditForm>
                      ) : (
                        <>
                          <AppointmentHeader>
                            <AppointmentInfo>
                              <AppointmentDate>{appt.date || today}</AppointmentDate>
                              <AppointmentTime>{appt.timeSlot}</AppointmentTime>
                            </AppointmentInfo>
                            <StatusBadge status={appt.status || "Pending"}>
                              {appt.status || "Pending"}
                            </StatusBadge>
                          </AppointmentHeader>

                          <AppointmentDetails>
                            <DetailItem>
                              <DetailLabel>Pet:</DetailLabel>
                              <DetailValue>{appt.petName}</DetailValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Payment:</DetailLabel>
                              <DetailValue>{appt.paymentMethod || "Not specified"}</DetailValue>
                            </DetailItem>
                          </AppointmentDetails>

                          <ButtonRow>
                            <EditButton onClick={() => startEditing(appt)}>Reschedule</EditButton>
                            <CancelButton onClick={() => handleDelete(appt.id)}>Cancel</CancelButton>
                          </ButtonRow>
                        </>
                      )}
                    </AppointmentCard>
                  ))}
              </AppointmentsList>
            )}
          </AppointmentsSection>
        </Content>
      </PageContainer>
    </>
  );
};

export default UserDashboard;

/* ================== RESPONSIVE STYLES ================== */
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
`;

const HeaderBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 2rem;
  background: #ffffff;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
  flex-wrap: wrap;
  gap: 1rem;

  @media (max-width: 1024px) {
    padding: 1.2rem 1.5rem;
  }

  @media (max-width: 768px) {
    padding: 1rem;
    position: relative;
  }

  @media (max-width: 480px) {
    padding: 0.8rem;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 1024px) {
    gap: 1.2rem;
  }

  @media (max-width: 768px) {
    display: none;
    flex-direction: column;
    width: 100%;
    gap: 1rem;
    padding-top: 1rem;
    
    &.open {
      display: flex;
    }
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const HamburgerIcon = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 24px;
  height: 18px;
  
  span {
    height: 2px;
    width: 100%;
    background-color: #2c3e50;
    border-radius: 2px;
    transition: all 0.3s ease;
  }
  
  &.open span:nth-child(1) {
    transform: rotate(45deg) translate(6px, 6px);
  }
  
  &.open span:nth-child(2) {
    opacity: 0;
  }
  
  &.open span:nth-child(3) {
    transform: rotate(-45deg) translate(6px, -6px);
  }
`;

const WelcomeSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const WelcomeTitle = styled.h2`
  font-size: 1.8rem;
  font-weight: bold;
  background: linear-gradient(to right, #6bc1e1, #34b89c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 0.3rem 0;
  line-height: 1.2;

  @media (max-width: 1024px) {
    font-size: 1.6rem;
  }

  @media (max-width: 768px) {
    font-size: 1.4rem;
  }

  @media (max-width: 480px) {
    font-size: 1.2rem;
  }
`;

const WelcomeSubtitle = styled.p`
  font-size: 1rem;
  color: #666;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    font-size: 0.8rem;
  }
`;

const ProfileSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;

  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const ProfileIcon = styled.div`
  font-size: 1.5rem;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  background: #f0f9ff;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 1024px) {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.3rem;
  }

  @media (max-width: 768px) {
    width: 2.2rem;
    height: 2.2rem;
    font-size: 1.1rem;
  }
`;

const ProfileName = styled.span`
  font-weight: 600;
  color: #2c3e50;
  font-size: 1rem;
  
  @media (max-width: 1024px) {
    font-size: 0.95rem;
  }

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const LogoutButton = styled.button`
  background: linear-gradient(90deg, #34B89C, #6BC1E1);
  color: #fff;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 0.75rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px rgba(52, 184, 156, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 10px rgba(52, 184, 156, 0.3);
  }
  
  @media (max-width: 1024px) {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    width: 100%;
    padding: 0.8rem;
    margin-top: 0.5rem;
  }
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  padding: 2.5rem;
  overflow-y: auto;

  @media (max-width: 1024px) {
    padding: 2rem;
    gap: 2rem;
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
    gap: 1.5rem;
  }

  @media (max-width: 480px) {
    padding: 1rem;
    gap: 1.2rem;
  }
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1rem;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.2rem;
  }
  
  @media (max-width: 580px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 1.2rem;
  padding: 2rem;
  box-shadow: 0px 6px 20px rgba(0, 0, 0, 0.08);
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid #eaeaea;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0px 12px 30px rgba(0, 0, 0, 0.15);
  }
  
  @media (max-width: 1024px) {
    padding: 1.8rem;
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 1rem;
  }

  @media (max-width: 480px) {
    padding: 1.2rem;
  }
`;

const CardIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1.2rem;
  
  @media (max-width: 1024px) {
    font-size: 2.8rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 768px) {
    font-size: 2.5rem;
    margin-bottom: 0.8rem;
  }
`;

const CardTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.8rem;
  
  @media (max-width: 1024px) {
    font-size: 1.2rem;
  }

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const CardText = styled.p`
  font-size: 1rem;
  color: #666;
  line-height: 1.5;
  
  @media (max-width: 1024px) {
    font-size: 0.95rem;
  }

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const AppointmentsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1rem;

  @media (max-width: 768px) {
    gap: 1.2rem;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

const SectionTitle = styled.h3`
  font-size: 1.6rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  
  @media (max-width: 1024px) {
    font-size: 1.5rem;
  }

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }

  @media (max-width: 480px) {
    font-size: 1.2rem;
  }
`;

const AppointmentCount = styled.span`
  background: #e8f4ff;
  color: #0077ff;
  padding: 0.4rem 1rem;
  border-radius: 1.2rem;
  font-size: 0.9rem;
  font-weight: 500;

  @media (max-width: 480px) {
    font-size: 0.8rem;
    padding: 0.3rem 0.8rem;
  }
`;

const AppointmentsList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.2rem;
  }
`;

const AppointmentCard = styled.div`
  background: #ffffff;
  padding: 2rem;
  border-radius: 1.2rem;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid #f0f0f0;
  
  @media (max-width: 1024px) {
    padding: 1.8rem;
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 1rem;
  }

  @media (max-width: 480px) {
    padding: 1.2rem;
    gap: 1rem;
  }
`;

const AppointmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

const AppointmentInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AppointmentDate = styled.span`
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
  
  @media (max-width: 1024px) {
    font-size: 1.1rem;
  }

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const AppointmentTime = styled.span`
  font-size: 1rem;
  color: #666;
  background: #f7f9fc;
  padding: 0.4rem 0.9rem;
  border-radius: 0.75rem;
  
  @media (max-width: 1024px) {
    font-size: 0.95rem;
  }

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 0.4rem 0.9rem;
  border-radius: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case "Confirmed": return "#e7f6e9";
      case "Cancelled": return "#feeceb";
      case "Completed": return "#e8f4ff";
      default: return "#fff4e6";
    }
  }};
  color: ${props => {
    switch (props.status) {
      case "Confirmed": return "#28a745";
      case "Cancelled": return "#dc3545";
      case "Completed": return "#0077ff";
      default: return "#ffc107";
    }
  }};

  @media (max-width: 480px) {
    font-size: 0.8rem;
    padding: 0.3rem 0.8rem;
  }
`;

const AppointmentDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const DetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: #2c3e50;
  min-width: 4rem;
  font-size: 1rem;
  
  @media (max-width: 768px) {
    min-width: 3.5rem;
    font-size: 0.95rem;
  }

  @media (max-width: 480px) {
    min-width: 3rem;
    font-size: 0.9rem;
  }
`;

const DetailValue = styled.span`
  color: #666;
  font-size: 1rem;
  
  @media (max-width: 768px) {
    font-size: 0.95rem;
  }

  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.8rem;
  }
`;

const EditButton = styled.button`
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.8rem 1.2rem;
  border-radius: 0.6rem;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
  flex: 1;

  &:hover {
    background: #1d4ed8;
    transform: translateY(-2px);
  }
  
  @media (max-width: 1024px) {
    padding: 0.7rem 1rem;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 0.8rem;
  }
`;

const CancelButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.8rem 1.2rem;
  border-radius: 0.6rem;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
  flex: 1;

  &:hover {
    background: #b02a37;
    transform: translateY(-2px);
  }
  
  @media (max-width: 1024px) {
    padding: 0.7rem 1rem;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 0.8rem;
  }
`;

const NoAppointments = styled.div`
  text-align: center;
  padding: 3.5rem 2rem;
  background: #ffffff;
  border-radius: 1.2rem;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
  
  @media (max-width: 1024px) {
    padding: 3rem 1.5rem;
  }

  @media (max-width: 768px) {
    padding: 2.5rem 1.2rem;
    border-radius: 1rem;
  }

  @media (max-width: 480px) {
    padding: 2rem 1rem;
  }
`;

const NoAppointmentsIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.7;
  
  @media (max-width: 1024px) {
    font-size: 3.5rem;
    margin-bottom: 1.2rem;
  }

  @media (max-width: 768px) {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
`;

const NoAppointmentsText = styled.p`
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
  
  @media (max-width: 1024px) {
    font-size: 1.1rem;
    margin-bottom: 1.8rem;
  }

  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 1.5rem;
  }
`;

const ScheduleButton = styled.button`
  background: linear-gradient(90deg, #34B89C, #6BC1E1);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 0.75rem;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(52, 184, 156, 0.2);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(52, 184, 156, 0.3);
  }
  
  @media (max-width: 1024px) {
    padding: 0.9rem 1.8rem;
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    padding: 0.8rem 1.5rem;
    font-size: 0.95rem;
  }
`;

const EditForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const EditTitle = styled.h4`
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
  }

  @media (max-width: 480px) {
    font-size: 1rem;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;

  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

const DateInput = styled.input`
  padding: 0.9rem 1rem;
  border-radius: 0.6rem;
  border: 1px solid #ddd;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #6BC1E1;
    box-shadow: 0 0 0 3px rgba(107, 193, 225, 0.2);
  }
  
  @media (max-width: 1024px) {
    padding: 0.8rem;
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    padding: 0.7rem;
  }
`;

const SelectInput = styled.select`
  padding: 0.9rem 1rem;
  border-radius: 0.6rem;
  border: 1px solid #ddd;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #6BC1E1;
    box-shadow: 0 0 0 3px rgba(107, 193, 225, 0.2);
  }
  
  @media (max-width: 1024px) {
    padding: 0.8rem;
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    padding: 0.7rem;
  }
`;

const EditButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.8rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.8rem;
  }
`;

const SaveButton = styled.button`
  flex: 1;
  background: linear-gradient(90deg, #34B89C, #6BC1E1);
  color: white;
  border: none;
  border-radius: 0.6rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.9rem 0;
  transition: all 0.2s ease;
  font-size: 0.95rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(52, 184, 156, 0.3);
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`;

const CancelEditButton = styled.button`
  flex: 1;
  background: #f1f1f1;
  color: #666;
  border: none;
  border-radius: 0.6rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.9rem 0;
  transition: all 0.2s ease;
  font-size: 0.95rem;

  &:hover {
    background: #e5e5e5;
    transform: translateY(-2px);
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`;