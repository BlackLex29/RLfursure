'use client';

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { collection, getDocs, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";

// Global Styles
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #f0f9f7;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }

  * {
    box-sizing: border-box;
  }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(25px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

interface AppointmentType {
  id: string;
  clientName: string;
  petName?: string;
  birthday?: string;
  color?: string;
  petType?: string;
  petBreed?: string;
  gender?: string;
  date: string;
  timeSlot: string;
  status?: string;
  bookedByAdmin?: boolean;
}

interface ClientType {
  id: string;
  email: string;
  name?: string;
}

// New interface for unavailable slots
interface UnavailableSlot {
  id: string;
  date: string;
  veterinarian: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}

// Styled component interfaces
interface ToggleButtonProps {
  $active?: boolean;
}

interface AppointmentCardProps {
  $delay: number;
  $borderLeftColor: string;
}

interface MobileMenuProps {
  $isOpen: boolean;
}

const Admindashboard: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentType[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  const [clients, setClients] = useState<ClientType[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [petName, setPetName] = useState("");
  const [petBirthday, setPetBirthday] = useState("");
  const [petColor, setPetColor] = useState("");
  const [petType, setPetType] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petGender, setPetGender] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"today" | "all" | "unavailable">("today");
  const [isMounted, setIsMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const timeSlots = [
    "8:00 AM–8:30 AM", "8:30 AM–9:00 AM", "9:00 AM–9:30 AM", "9:30 AM–10:00 AM",
    "10:00 AM–10:30 AM", "10:30 AM–11:00 AM", "11:00 AM–11:30 AM", "11:30 AM–12:00 PM",
    "1:00 PM–1:30 PM", "1:30 PM–2:00 PM", "2:00 PM–2:30 PM", "2:30 PM–3:00 PM",
    "3:00 PM–3:30 PM", "3:30 PM–4:00 PM", "4:00 PM–4:30 PM", "4:30 PM–5:00 PM", 
    "5:00 PM–5:30 PM", "5:30 PM–6:00 PM"
  ];

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => { setIsMounted(true); }, []);

  const handleLogout = async () => {
    try { await signOut(auth); router.push("/login"); }
    catch (error) { alert("Logout failed: " + (error as Error).message); }
  };

  const fetchAppointments = async () => {
    try {
      const snapshot = await getDocs(collection(db, "appointments"));
      const data: AppointmentType[] = [];
      snapshot.forEach(doc => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          clientName: docData.clientName || "",
          petName: docData.petName || "",
          birthday: docData.birthday || "",
          color: docData.color || "",
          petType: docData.petType || "",
          petBreed: docData.petBreed || "",
          gender: docData.gender || "",
          date: docData.date || "",
          timeSlot: docData.timeSlot || "",
          status: docData.status || "Pending",
          bookedByAdmin: docData.bookedByAdmin || false
        });
      });
      setAppointments(data.sort((a,b)=>a.date.localeCompare(b.date)));
      const today = new Date().toISOString().split('T')[0];
      setTodaysAppointments(data.filter(appt => appt.date === today));
    } catch (error) { console.error("Error fetching appointments:", error); }
  };

  // New function to fetch unavailable slots
  const fetchUnavailableSlots = async () => {
    try {
      const snapshot = await getDocs(collection(db, "unavailableSlots"));
      const data: UnavailableSlot[] = [];
      snapshot.forEach(doc => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          date: docData.date || "",
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || ""
        });
      });
      setUnavailableSlots(data.sort((a,b) => a.date.localeCompare(b.date)));
    } catch (error) { 
      console.error("Error fetching unavailable slots:", error); 
    }
  };

  const fetchClients = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const data: ClientType[] = [];
      snapshot.forEach(doc => {
        const docData = doc.data();
        data.push({ id: doc.id, email: docData.email || "", name: docData.name || "" });
      });
      setClients(data);
    } catch (error) { console.error("Error fetching clients:", error); }
  };

  useEffect(() => { 
    fetchAppointments(); 
    fetchClients(); 
    fetchUnavailableSlots();

    // Set up real-time listener for unavailable slots
    const unsubscribe = onSnapshot(collection(db, "unavailableSlots"), (snapshot) => {
      const data: UnavailableSlot[] = [];
      snapshot.forEach(doc => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          date: docData.date || "",
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || ""
        });
      });
      setUnavailableSlots(data.sort((a,b) => a.date.localeCompare(b.date)));
    });

    return () => unsubscribe();
  }, []);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !petName.trim() || !appointmentDate || !appointmentTime) {
      alert("Please fill all required fields."); return;
    }

    // Check if the selected date is unavailable
    const isDateUnavailable = unavailableSlots.some(slot => slot.date === appointmentDate);
    if (isDateUnavailable) {
      alert("Cannot book appointment on this date. A doctor has marked this date as unavailable.");
      return;
    }

    setIsLoading(true);
    try {
      const isTaken = appointments.some(
        appt => appt.date === appointmentDate && appt.timeSlot === appointmentTime && appt.status !== "Cancelled"
      );
      if (isTaken) { alert("This time slot is already taken."); return; }
      await addDoc(collection(db, "appointments"), {
        clientName: selectedClient,
        petName: petName.trim(),
        birthday: petBirthday,
        color: petColor,
        petType, petBreed, gender: petGender,
        date: appointmentDate,
        timeSlot: appointmentTime,
        status: "Confirmed",
        bookedByAdmin: true,
        createdAt: new Date().toISOString(),
      });
      alert("Appointment booked successfully!");
      setShowBookingModal(false); resetForm(); fetchAppointments();
    } catch (error) {
      console.error("Error booking appointment:", error);
      alert("Failed to book appointment. Please try again.");
    } finally { setIsLoading(false); }
  };

  // Function to delete unavailable slot
  const handleDeleteUnavailable = async (id: string) => {
    if (!confirm("Are you sure you want to remove this unavailable date?")) return;
    
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "unavailableSlots", id));
      alert("Unavailable date removed successfully!");
      fetchUnavailableSlots();
    } catch (error) {
      console.error("Error deleting unavailable slot:", error);
      alert("Failed to remove unavailable date. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setSelectedClient(""); setPetName(""); setPetBirthday(""); setPetColor("");
    setPetType(""); setPetBreed(""); setPetGender(""); setAppointmentDate(""); setAppointmentTime("");
  };

  const statusColor = (status?: string) => {
    switch(status){
      case "Confirmed": return "#28a745";
      case "Cancelled": return "#dc3545";
      case "Pet Registered": return "#007bff";
      case "Booked by Admin": return "#17a2b8";
      default: return "#ffc107";
    }
  };

  // Filter appointments by month if selected
  const filteredAppointments = selectedMonth 
    ? appointments.filter(appt => {
        const date = new Date(appt.date);
        return date.getMonth() === months.indexOf(selectedMonth);
      })
    : appointments;

  // Filter unavailable slots by month if selected
  const filteredUnavailableSlots = selectedMonth 
    ? unavailableSlots.filter(slot => {
        const date = new Date(slot.date);
        return date.getMonth() === months.indexOf(selectedMonth);
      })
    : unavailableSlots;

  // Function to get the correct data based on view mode
  const getDisplayData = () => {
    switch(viewMode) {
      case "today":
        return { data: todaysAppointments, type: "appointments" };
      case "all":
        return { data: filteredAppointments, type: "appointments" };
      case "unavailable":
        return { data: filteredUnavailableSlots, type: "unavailable" };
      default:
        return { data: [], type: "appointments" };
    }
  };

  const displayData = getDisplayData();

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  if(!isMounted) return null;

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <MenuToggle onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <span></span>
              <span></span>
              <span></span>
            </MenuToggle>
            <ClinicName>RL Clinic</ClinicName>
            <Tagline>Fursure Care - Admin Dashboard</Tagline>
          </BrandSection>
          <UserSection>
            <AdminBadge>Administrator</AdminBadge>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </UserSection>
        </HeaderBar>

        <MobileMenu $isOpen={isMenuOpen}>
          <MobileNav>
            <NavItem onClick={() => { router.push("/manageappointment"); setIsMenuOpen(false); }}>Manage Appointments</NavItem>
            <NavItem onClick={() => { setShowBookingModal(true); setIsMenuOpen(false); }}>Book Appointment</NavItem>
            <NavItem onClick={() => { router.push("/medicalrecord"); setIsMenuOpen(false); }}>Medical Records</NavItem>
            <NavItem onClick={() => { router.push("/monthlystatistic"); setIsMenuOpen(false); }}>Monthly Statistics</NavItem>
          </MobileNav>
        </MobileMenu>

        <Content>
          <CardsGrid>
            <Card onClick={()=>router.push("/manageappointment")}>
              <CardIcon>📅</CardIcon>
              <CardTitle>Manage Appointments</CardTitle>
              <CardDesc>View, confirm, or cancel client appointments</CardDesc>
            </Card>
            <Card onClick={()=>setShowBookingModal(true)}>
              <CardIcon>➕</CardIcon>
              <CardTitle>Book Appointment</CardTitle>
              <CardDesc>Schedule an appointment for a client</CardDesc>
            </Card>
            <Card onClick={()=>router.push("/medicalrecord")}>
              <CardIcon>📖</CardIcon>
              <CardTitle>Medical Records</CardTitle>
              <CardDesc>Access and update pet medical history</CardDesc>
            </Card>
            {/* New card for viewing unavailable dates */}
            <Card onClick={()=>setViewMode("unavailable")}>
              <CardIcon>🚫</CardIcon>
              <CardTitle>Doctor Unavailable Dates</CardTitle>
              <CardDesc>View dates when doctors are unavailable</CardDesc>
            </Card>
            {/* New card for monthly statistics */}
            <Card onClick={()=>router.push("/monthlystatistic")}>
              <CardIcon>📊</CardIcon>
              <CardTitle>Monthly Statistics</CardTitle>
              <CardDesc>View monthly appointment statistics and reports</CardDesc>
            </Card>
          </CardsGrid>

          <AppointmentsSection>
            <SectionHeader>
              <SectionTitle>
                {viewMode === "today" && "Today's Appointments"}
                {viewMode === "all" && "All Appointments"}
                {viewMode === "unavailable" && "Doctor Unavailable Dates"}
              </SectionTitle>
              <ControlsContainer>
                <ViewToggle>
                  <ToggleButtonStyled $active={viewMode==="today"} onClick={()=>setViewMode("today")}>Today</ToggleButtonStyled>
                  <ToggleButtonStyled $active={viewMode==="all"} onClick={()=>setViewMode("all")}>All</ToggleButtonStyled>
                  <ToggleButtonStyled $active={viewMode==="unavailable"} onClick={()=>setViewMode("unavailable")}>Unavailable</ToggleButtonStyled>
                </ViewToggle>
                {(viewMode === "all" || viewMode === "unavailable") && (
                  <MonthFilter>
                    <MonthSelect 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      <option value="">All Months</option>
                      {months.map((month) => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </MonthSelect>
                  </MonthFilter>
                )}
                <RefreshButton onClick={() => {
                  fetchAppointments();
                  fetchUnavailableSlots();
                }}>Refresh</RefreshButton>
              </ControlsContainer>
            </SectionHeader>

            {displayData.data.length === 0 ? (
              <NoAppointments>
                {viewMode === "today" && "No appointments for today."}
                {viewMode === "all" && "No appointments found."}
                {viewMode === "unavailable" && "No unavailable dates set by doctors."}
              </NoAppointments>
            ) : (
              <AppointmentsGrid>
                {viewMode === "unavailable" ? (
                  // Render unavailable slots
                  (displayData.data as UnavailableSlot[]).map((slot, index) => (
                    <UnavailableCard key={slot.id} $delay={index * 0.1}>
                      <UnavailableIcon>🚫</UnavailableIcon>
                      <UnavailableInfo>
                        <UnavailableDate>{formatDate(slot.date)}</UnavailableDate>
                        <UnavailableDoctor>Doctor: {slot.veterinarian}</UnavailableDoctor>
                        <UnavailableTime>
                          {slot.isAllDay ? 'All Day' : `${slot.startTime} - ${slot.endTime}`}
                        </UnavailableTime>
                        <UnavailableStatus>Unavailable</UnavailableStatus>
                      </UnavailableInfo>
                      <DeleteButton 
                        onClick={() => handleDeleteUnavailable(slot.id)}
                        disabled={deletingId === slot.id}
                      >
                        {deletingId === slot.id ? "Deleting..." : "Delete"}
                      </DeleteButton>
                    </UnavailableCard>
                  ))
                ) : (
                  // Render appointments
                  (displayData.data as AppointmentType[]).map((appt, index) => {
                    const borderColor = statusColor(appt.status);
                    return (
                      <AppointmentCard key={appt.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                        <InfoRow><strong>Owner:</strong> {appt.clientName}</InfoRow>
                        <InfoRow><strong>Pet:</strong> {appt.petName || "-"}</InfoRow>
                        <InfoRow><strong>Date:</strong> {appt.date} | <strong>Time:</strong> {appt.timeSlot}</InfoRow>
                        <InfoRow><strong>Type:</strong> {appt.petType || "-"} | <strong>Breed:</strong> {appt.petBreed || "-"}</InfoRow>
                        <StatusLabel style={{ backgroundColor: borderColor }}>
                          {appt.status || "Pending"}{appt.bookedByAdmin && " (by Admin)"}
                        </StatusLabel>
                      </AppointmentCard>
                    );
                  })
                )}
              </AppointmentsGrid>
            )}
          </AppointmentsSection>

          {showBookingModal && (
            <ModalOverlay onClick={()=>!isLoading && setShowBookingModal(false)}>
              <ModalContent onClick={(e)=>e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle>Book Appointment for Client</ModalTitle>
                  <CloseButton onClick={()=>!isLoading && setShowBookingModal(false)} disabled={isLoading}>×</CloseButton>
                </ModalHeader>
                <Form onSubmit={handleBookAppointment}>
                  <FormColumns>
                    <FormColumn>
                      <FormGroup>
                        <Label>Select Client *</Label>
                        <Select value={selectedClient} onChange={(e)=>setSelectedClient(e.target.value)} required disabled={isLoading}>
                          <option value="">Choose a client</option>
                          {clients.map(client=><option key={client.id} value={client.email}>{client.name||client.email}</option>)}
                        </Select>
                      </FormGroup>

                      <FormGroup>
                        <Label>Pet Name *</Label>
                        <Input type="text" value={petName} onChange={(e)=>setPetName(e.target.value)} placeholder="Enter pet name" required disabled={isLoading} />
                      </FormGroup>

                      <FormGroup>
                        <Label>Pet Type</Label>
                        <Select value={petType} onChange={(e)=>setPetType(e.target.value)} disabled={isLoading}>
                          <option value="">Select pet type</option>
                          <option value="Dog">Dog</option>
                          <option value="Cat">Cat</option>
                          <option value="Bird">Bird</option>
                          <option value="Other">Other</option>
                        </Select>
                      </FormGroup>

                      <FormGroup>
                        <Label>Breed</Label>
                        <Input type="text" value={petBreed} onChange={(e)=>setPetBreed(e.target.value)} placeholder="Enter breed" disabled={isLoading} />
                      </FormGroup>

                      <FormGroup>
                        <Label>Gender</Label>
                        <Select value={petGender} onChange={(e)=>setPetGender(e.target.value)} disabled={isLoading}>
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </Select>
                      </FormGroup>
                    </FormColumn>

                    <FormColumn>
                      <FormGroup>
                        <Label>Birthday</Label>
                        <Input type="date" value={petBirthday} onChange={(e)=>setPetBirthday(e.target.value)} disabled={isLoading} />
                      </FormGroup>

                      <FormGroup>
                        <Label>Color/Markings</Label>
                        <Input type="text" value={petColor} onChange={(e)=>setPetColor(e.target.value)} placeholder="Enter color/markings" disabled={isLoading} />
                      </FormGroup>

                      <FormGroup>
                        <Label>Appointment Date *</Label>
                        <Input type="date" value={appointmentDate} onChange={(e)=>setAppointmentDate(e.target.value)} min={new Date().toISOString().split('T')[0]} required disabled={isLoading} />
                        {appointmentDate && unavailableSlots.some(slot => slot.date === appointmentDate) && (
                          <UnavailableWarning>⚠️ Warning: A doctor is unavailable on this date</UnavailableWarning>
                        )}
                      </FormGroup>

                      <FormGroup>
                        <Label>Time Slot *</Label>
                        <Select value={appointmentTime} onChange={(e)=>setAppointmentTime(e.target.value)} required disabled={isLoading}>
                          <option value="">Select a time slot</option>
                          {timeSlots.map(slot=><option key={slot} value={slot}>{slot}</option>)}
                        </Select>
                      </FormGroup>
                    </FormColumn>
                  </FormColumns>

                  <ButtonGroup>
                    <CancelButton type="button" onClick={()=>setShowBookingModal(false)} disabled={isLoading}>Cancel</CancelButton>
                    <SubmitButton type="submit" disabled={isLoading || !selectedClient || !petName.trim() || !appointmentDate || !appointmentTime}>
                      {isLoading?"Booking...":"Book Appointment"}
                    </SubmitButton>
                  </ButtonGroup>
                </Form>
              </ModalContent>
            </ModalOverlay>
          )}

        </Content>
      </PageContainer>
    </>
  );
};

/* Styled Components */

const PageContainer = styled.div`
  display: flex; 
  flex-direction: column; 
  min-height: 100vh;
`;

const HeaderBar = styled.header`
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 1rem 1.5rem; 
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const BrandSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const MenuToggle = styled.div`
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 24px;
  height: 18px;
  cursor: pointer;

  span {
    height: 2px;
    width: 100%;
    background-color: white;
    border-radius: 2px;
  }

  @media (max-width: 768px) {
    display: flex;
  }
`;

const ClinicName = styled.h1`
  margin: 0; 
  font-size: 1.8rem;
  font-weight: 700;
  color: white;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }

  @media (max-width: 480px) {
    font-size: 1.3rem;
  }
`;

const Tagline = styled.p`
  margin: 0; 
  font-size: 0.9rem; 
  color: rgba(255, 255, 255, 0.9);

  @media (max-width: 768px) {
    display: none;
  }
`;

const UserSection = styled.div`
  display: flex; 
  align-items: center; 
  gap: 1rem;

  @media (max-width: 480px) {
    gap: 0.7rem;
  }
`;

const AdminBadge = styled.span`
  background: rgba(255, 255, 255, 0.2); 
  color: white; 
  padding: 0.4rem 0.8rem; 
  border-radius: 20px; 
  font-size: 0.8rem;
  font-weight: 500;
  backdrop-filter: blur(10px);

  @media (max-width: 480px) {
    font-size: 0.7rem;
    padding: 0.3rem 0.6rem;
  }
`;

const LogoutButton = styled.button`
  padding: 0.6rem 1.2rem; 
  border: 1px solid rgba(255, 255, 255, 0.3); 
  border-radius: 8px; 
  cursor: pointer; 
  background: rgba(255, 255, 255, 0.15); 
  color: white; 
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  @media (max-width: 480px) {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }
`;

const MobileMenu = styled.div<MobileMenuProps>`
  display: none;
  background: white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 99;
  transform: translateY(${props => props.$isOpen ? '0' : '-100%'});
  opacity: ${props => props.$isOpen ? '1' : '0'};
  transition: all 0.3s ease;
  pointer-events: ${props => props.$isOpen ? 'all' : 'none'};

  @media (max-width: 768px) {
    display: block;
  }
`;

const MobileNav = styled.nav`
  display: flex;
  flex-direction: column;
  padding: 1rem;
`;

const NavItem = styled.div`
  padding: 1rem;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-weight: 500;
  transition: background 0.2s;
  color: #2C5E4F;

  &:hover {
    background: #f8f9fa;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const Content = styled.div`
  padding: 2rem; 
  flex: 1;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }

  @media (max-width: 480px) {
    padding: 1rem;
  }
`;

const CardsGrid = styled.div`
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
  gap: 1.5rem; 
  margin-bottom: 2.5rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: white; 
  padding: 1.5rem; 
  border-radius: 12px; 
  cursor: pointer; 
  box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
  transition: all 0.3s ease;
  animation: ${slideIn} 0.5s ease forwards;
  border-top: 4px solid #34B89C;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
  }

  @media (max-width: 768px) {
    padding: 1.2rem;
  }
`;

const CardIcon = styled.div`
  font-size: 2.5rem; 
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const CardTitle = styled.h3`
  margin: 0 0 0.5rem 0; 
  font-size: 1.2rem;
  color: #2C5E4F;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const CardDesc = styled.p`
  margin: 0; 
  font-size: 0.9rem; 
  color: #666;
  line-height: 1.4;
`;

const AppointmentsSection = styled.section`
  margin-top: 2rem;
`;

const SectionHeader = styled.div`
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 1.5rem; 
  flex-wrap: wrap; 
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  color: #2C5E4F;

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-wrap: wrap;
  }

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    gap: 0.8rem;
  }
`;

const ViewToggle = styled.div`
  display: flex; 
  background: #f1f1f1; 
  border-radius: 8px; 
  overflow: hidden;
`;

const ToggleButtonStyled = styled.button<ToggleButtonProps>`
  border: none; 
  padding: 0.6rem 1.2rem; 
  cursor: pointer; 
  transition: all 0.2s; 
  font-size: 0.9rem;
  background: ${props => props.$active ? '#34B89C' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#333'};
  font-weight: ${props => props.$active ? '600' : 'normal'};
  
  &:hover {
    background: ${props => props.$active ? '#2a947c' : '#e5e5e5'};
  }

  @media (max-width: 480px) {
    padding: 0.5rem 1rem;
  }
`;

const MonthFilter = styled.div`
  display: flex;
  align-items: center;
`;

const MonthSelect = styled.select`
  padding: 0.6rem 0.8rem; 
  border: 1px solid #ddd; 
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  background: white;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }
`;

const RefreshButton = styled.button`
  padding: 0.6rem 1.2rem; 
  border: none; 
  border-radius: 8px; 
  cursor: pointer; 
  background: #34B89C; 
  color: white; 
  font-weight: 600;
  transition: background 0.2s;
  font-size: 0.9rem;

  &:hover {
    background: #2a947c;
  }

  @media (max-width: 480px) {
    width: 100%;
    text-align: center;
  }
`;

const AppointmentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.2rem;
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AppointmentCard = styled.div<AppointmentCardProps>`
  animation: ${fadeInUp} 0.4s ease forwards;
  animation-delay: ${props => props.$delay}s;
  opacity: 0;
  padding: 1.2rem; 
  border-left: 6px solid ${props => props.$borderLeftColor}; 
  background: white; 
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  height: 100%;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }

  @media (max-width: 480px) {
    padding: 1rem;
  }
`;

const InfoRow = styled.p`
  margin: 0.4rem 0;
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 0 0 auto;

  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

const StatusLabel = styled.span`
  display: inline-block;
  padding: 0.3rem 0.7rem; 
  border-radius: 20px; 
  color: white; 
  font-size: 0.8rem;
  font-weight: 500;
  margin-top: 0.5rem;
  align-self: flex-start;
  flex: 0 0 auto;
`;

const NoAppointments = styled.p`
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.05);
`;

// New styled components for unavailable slots
const UnavailableCard = styled.div<{ $delay: number }>`
  animation: ${fadeInUp} 0.4s ease forwards;
  animation-delay: ${props => props.$delay}s;
  opacity: 0;
  padding: 1.2rem; 
  border-left: 6px solid #dc3545; 
  background: white; 
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }

  @media (max-width: 480px) {
    padding: 1rem;
    flex-direction: column;
    text-align: center;
    gap: 0.8rem;
  }
`;

const UnavailableIcon = styled.div`
  font-size: 2rem;
  flex-shrink: 0;
`;

const UnavailableInfo = styled.div`
  flex: 1;
`;

const UnavailableDate = styled.div`
  font-weight: bold;
  font-size: 1.1rem;
  color: #2d3748;
  margin-bottom: 0.3rem;
`;

const UnavailableDoctor = styled.div`
  font-size: 0.95rem;
  color: #4a5568;
  margin-bottom: 0.3rem;
`;

const UnavailableTime = styled.div`
  font-size: 0.9rem;
  color: #718096;
  margin-bottom: 0.5rem;
`;

const UnavailableStatus = styled.div`
  display: inline-block;
  padding: 0.3rem 0.7rem; 
  border-radius: 20px; 
  background-color: #dc3545;
  color: white; 
  font-size: 0.8rem;
  font-weight: 500;
`;

const DeleteButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: #bd2130;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`;

const UnavailableWarning = styled.div`
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  font-weight: 500;
`;

const ModalOverlay = styled.div`
  position: fixed; 
  top: 0; 
  left: 0; 
  right: 0; 
  bottom: 0; 
  background: rgba(0,0,0,0.6); 
  display: flex; 
  justify-content: center; 
  align-items: center;
  padding: 1rem;
  z-index: 1000;
  overflow-y: auto;
`;

const ModalContent = styled.div`
  background: white; 
  padding: 1.5rem; 
  border-radius: 12px; 
  width: 100%; 
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);

  @media (max-width: 768px) {
    padding: 1.2rem;
    max-height: 85vh;
  }
`;

const ModalHeader = styled.div`
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 1.5rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #eee;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #2C5E4F;
  font-size: 1.5rem;

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }
`;

const CloseButton = styled.button`
  border: none; 
  background: none; 
  font-size: 1.8rem; 
  cursor: pointer;
  color: #666;
  transition: color 0.2s;

  &:hover {
    color: #333;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Form = styled.form`
  display: flex; 
  flex-direction: column; 
  gap: 1.2rem;
`;

const FormColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const FormColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex; 
  flex-direction: column;
  gap: 0.4rem;
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: #444;
`;

const Input = styled.input`
  padding: 0.7rem 0.8rem; 
  border: 1px solid #ddd; 
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  padding: 0.7rem 0.8rem; 
  border: 1px solid #ddd; 
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  background: white;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const ButtonGroup = styled.div`
  display: flex; 
  justify-content: flex-end; 
  gap: 0.8rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CancelButton = styled.button`
  padding: 0.7rem 1.4rem; 
  border: 1px solid #ddd; 
  border-radius: 8px; 
  cursor: pointer; 
  background: white; 
  color: #333;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #f8f8f8;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    order: 2;
  }
`;

const SubmitButton = styled.button`
  padding: 0.7rem 1.4rem; 
  border: none; 
  border-radius: 8px; 
  cursor: pointer; 
  background: #34B89C; 
  color: white; 
  font-weight: 600;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2a947c;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export default Admindashboard;