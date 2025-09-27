'use client';
import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { collection, doc, updateDoc, deleteDoc, onSnapshot, addDoc } from "firebase/firestore";
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
  appointmentType?: string;
  status?: string;
  paymentMethod?: string;
  paymentAmount?: number;
  isAnonymous?: boolean;
}

// Appointment type labels
const appointmentTypeLabels: Record<string, string> = {
  vaccination: "Vaccination",
  checkup: "Check Up",
  antiRabies: "Anti Rabies",
  ultrasound: "Ultrasound",
  groom: "Grooming",
  spayNeuter: "Spay/Neuter",
  deworm: "Deworming"
};

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ManageAppointments: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showAnonymousModal, setShowAnonymousModal] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    date: "",
    timeSlot: "",
    appointmentType: ""
  });

  const timeSlots = [
    "8:00 AM–8:30 AM", "8:30 AM–9:00 AM", "9:00 AM–9:30 AM", "9:30 AM–10:00 AM",
    "10:00 AM–10:30 AM", "10:30 AM–11:00 AM", "11:00 AM–11:30 AM", "11:30 AM–12:00 PM",
    "1:00 PM–1:30 PM", "1:30 PM–2:00 PM", "2:00 PM–2:30 PM", "2:30 PM–3:00 PM",
    "3:00 PM–3:30 PM", "3:30 PM–4:00 PM", "4:00 PM–4:30 PM", "4:30 PM–5:00 PM", 
    "5:00 PM–5:30 PM", "5:30 PM–6:00 PM"
  ];

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
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const docRef = doc(db, "appointments", id);
      await updateDoc(docRef, { 
        status,
        completedAt: status === "Done" || status === "No Show" ? new Date().toISOString() : null
      });
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

  const handleCreateAnonymousAppointment = async () => {
    if (!newAppointment.date || !newAppointment.timeSlot) {
      alert("Please select date and time slot");
      return;
    }

    try {
      await addDoc(collection(db, "appointments"), {
        clientName: "Anonymous",
        petName: "Anonymous",
        date: newAppointment.date,
        timeSlot: newAppointment.timeSlot,
        appointmentType: newAppointment.appointmentType || "checkup",
        status: "Confirmed",
        isAnonymous: true,
        createdAt: new Date().toISOString(),
      });
      alert("Anonymous appointment created!");
      setShowAnonymousModal(false);
      setNewAppointment({ date: "", timeSlot: "", appointmentType: "" });
    } catch (error) {
      console.error("Error creating appointment:", error);
      alert("Failed to create appointment");
    }
  };

  // Generate dates for the next 7 days
  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      dates.push(dateString);
    }
    
    return dates;
  };

  const dateOptions = generateDateOptions();

  // Get all appointments grouped by date
  const groupedByDate: Record<string, AppointmentType[]> = {};
  dateOptions.forEach(date => {
    groupedByDate[date] = appointments.filter(appt => appt.date === date);
  });

  // Get sorted unique dates
  const sortedDates = Object.keys(groupedByDate).sort();
  
  // Filter appointments based on selected date
  const filteredAppointments = selectedDate === "all" 
    ? appointments 
    : groupedByDate[selectedDate] || [];

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

  // Function to format payment method display
  const formatPaymentMethod = (method?: string) => {
    if (!method) return "Not Paid";
    
    switch(method.toLowerCase()) {
      case 'gcash': return 'GCash';
      case 'debitcard': return 'Debit Card';
      case 'paymaya': return 'PayMaya';
      case 'cash': return 'Cash';
      default: return method;
    }
  };

  // Function to get appointment type label
  const getAppointmentTypeLabel = (type?: string) => {
    if (!type) return "Not Specified";
    return appointmentTypeLabels[type] || type;
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

        <ActionButtonsContainer>
          <AnonymousButton onClick={() => setShowAnonymousModal(true)}>
            ➕ Create Anonymous Appointment
          </AnonymousButton>
        </ActionButtonsContainer>

        {isLoading ? (
          <LoadingContainer>
            <LoadingSpinner />
            <LoadingText>Loading appointments...</LoadingText>
          </LoadingContainer>
        ) : appointments.length > 0 ? (
          <>
            <DateSelectorContainer>
              <DateSelectorLabel>Select Date:</DateSelectorLabel>
              <DateSelector 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="all">All Appointments</option>
                {sortedDates.map(date => (
                  <option key={date} value={date}>
                    {formatDate(date)}
                  </option>
                ))}
              </DateSelector>
            </DateSelectorContainer>

            <AppointmentsCount>
              Showing {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
              {selectedDate !== "all" && ` on ${formatDate(selectedDate)}`}
            </AppointmentsCount>

            <AppointmentsContainer>
              {filteredAppointments.map((appt: AppointmentType) => {
                let statusColor = "#ffc107"; // Pending
                if (appt.status === "Confirmed") statusColor = "#28a745";
                if (appt.status === "Cancelled") statusColor = "#dc3545";
                if (appt.status === "Done") statusColor = "#28a745"; // Green for Done
                if (appt.status === "No Show") statusColor = "#dc3545"; // Red for No Show

                let paymentColor = "#555";
                if (appt.paymentMethod === "Cash") paymentColor = "#ff7f50";
                if (appt.paymentMethod === "Online") paymentColor = "#0077ff";

                return (
                  <AppointmentCard key={appt.id} color={statusColor}>
                    <CardHeader>
                      <TimeSlot>{appt.timeSlot}</TimeSlot>
                      <DateBadge>{appt.date}</DateBadge>
                      <StatusBadge bg={statusColor}>{appt.status || "Pending"}</StatusBadge>
                    </CardHeader>
                    
                    <CardContent>
                      <InfoItem>
                        <Icon>👤</Icon>
                        <InfoText>{appt.isAnonymous ? "Anonymous" : appt.clientName || "Unknown Client"}</InfoText>
                      </InfoItem>
                      
                      <InfoItem>
                        <Icon>🐾</Icon>
                        <InfoText>{appt.isAnonymous ? "Anonymous" : appt.petName || "Not Registered"}</InfoText>
                      </InfoItem>

                      <InfoItem>
                        <Icon>📋</Icon>
                        <InfoText>{getAppointmentTypeLabel(appt.appointmentType)}</InfoText>
                      </InfoItem>
                      
                      <InfoItem>
                        <Icon>💳</Icon>
                        <InfoText style={{ color: paymentColor }}>
                          {formatPaymentMethod(appt.paymentMethod)}
                          {appt.paymentAmount && ` - ₱${appt.paymentAmount}`}
                        </InfoText>
                      </InfoItem>
                    </CardContent>
                    
                    <ActionButtons>
                      <ActionButton 
                        onClick={() => handleStatusUpdate(appt.id, "Done")} 
                        bg="#28a745" // Green for Done
                      >
                        ✔️ Done
                      </ActionButton>
                      <ActionButton 
                        onClick={() => handleStatusUpdate(appt.id, "No Show")} 
                        bg="#dc3545" // Red for No Show
                      >
                        ❌ No Show
                      </ActionButton>
                      <ActionButton 
                        onClick={() => handleDelete(appt.id)} 
                        bg="#6c757d" // Gray for Cancel
                      >
                        🗑️ Cancel
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

        {showAnonymousModal && (
          <ModalOverlay onClick={() => setShowAnonymousModal(false)}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Create Anonymous Appointment</ModalTitle>
                <CloseButton onClick={() => setShowAnonymousModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <FormGroup>
                <Label>Date *</Label>
                <Select 
                  value={newAppointment.date} 
                  onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                  required
                >
                  <option value="">Select Date</option>
                  {dateOptions.map(date => (
                    <option key={date} value={date}>{formatDate(date)}</option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Time Slot *</Label>
                <Select 
                  value={newAppointment.timeSlot} 
                  onChange={(e) => setNewAppointment({...newAppointment, timeSlot: e.target.value})}
                  required
                >
                  <option value="">Select Time Slot</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Appointment Type</Label>
                <Select 
                  value={newAppointment.appointmentType} 
                  onChange={(e) => setNewAppointment({...newAppointment, appointmentType: e.target.value})}
                >
                  <option value="checkup">Check Up</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="antiRabies">Anti Rabies</option>
                  <option value="ultrasound">Ultrasound</option>
                  <option value="groom">Grooming</option>
                  <option value="spayNeuter">Spay/Neuter</option>
                  <option value="deworm">Deworming</option>
                </Select>
              </FormGroup>

              <ButtonGroup>
                <CancelButton type="button" onClick={() => setShowAnonymousModal(false)}>
                  Cancel
                </CancelButton>
                <SubmitButton type="button" onClick={handleCreateAnonymousAppointment}>
                  Create Appointment
                </SubmitButton>
              </ButtonGroup>
            </ModalContent>
          </ModalOverlay>
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

const ActionButtonsContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
`;

const AnonymousButton = styled.button`
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    opacity: 0.9;
  }
`;

const DateSelectorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  
  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const DateSelectorLabel = styled.label`
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
`;

const DateSelector = styled.select`
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background-color: white;
  font-size: 14px;
  flex-grow: 1;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
`;

const AppointmentsCount = styled.p`
  text-align: center;
  color: #6b7280;
  margin-bottom: 25px;
  font-size: 14px;
  font-weight: 500;
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
  flex-wrap: wrap;
  gap: 8px;
`;

const TimeSlot = styled.strong`
  font-size: 16px;
  font-weight: 700;
  color: #111827;
`;

const DateBadge = styled.span`
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 8px;
  color: #6b7280;
  background-color: #f3f4f6;
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

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 5px solid #f3f4f6;
  border-top: 5px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  font-size: 16px;
  color: #6b7280;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 25px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: #2C5E4F;
  font-size: 1.3rem;
`;

const CloseButton = styled.button`
  border: none;
  background: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: #666;
  
  &:hover {
    color: #333;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: #444;
`;

const Select = styled.select`
  padding: 0.7rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  
  &:focus {
    outline: none;
    border-color: #2C5E4F;
    box-shadow: 0 0 0 2px rgba(44, 94, 79, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
`;

const CancelButton = styled.button`
  padding: 0.7rem 1.4rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  background: white;
  color: #333;
  font-weight: 500;
  
  &:hover {
    background: #f8f8f8;
  }
`;

const SubmitButton = styled.button`
  padding: 0.7rem 1.4rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: #2C5E4F;
  color: white;
  font-weight: 600;
  
  &:hover {
    background: #24483c;
  }
`;

export default ManageAppointments;