'use client';

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { collection, getDocs, addDoc, DocumentData } from "firebase/firestore";

// 🔹 Types
interface Pet {
  id: string;
  name: string;
}

interface Appointment {
  date: string;
  timeSlot: string;
  status: string;
  petId: string;
  clientName: string;
}

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #e6f7f4;
  }

  * {
    box-sizing: border-box;
  }
`;

const timeSlots: string[] = [
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

const AppointmentPage: React.FC = () => {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [petsSnapshot, appointmentsSnapshot] = await Promise.all([
          getDocs(collection(db, "pets")),
          getDocs(collection(db, "appointments"))
        ]);

        // Process pets
        const userPets: Pet[] = [];
        petsSnapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          if (d.ownerEmail === auth.currentUser?.email) {
            userPets.push({ id: doc.id, name: d.petName });
          }
        });
        setPets(userPets);
        if (userPets.length > 0) setSelectedPet(userPets[0].id);

        // Process appointments
        const appointmentsData: Appointment[] = [];
        appointmentsSnapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          appointmentsData.push({
            date: d.date,
            timeSlot: d.timeSlot,
            status: d.status,
            petId: d.petId,
            clientName: d.clientName || ""
          });
        });
        setBookedSlots(appointmentsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet || !selectedSlot) return alert("Please select a pet and time slot");

    // Check if the slot is already taken by ANY user (not just the current user)
    const isTaken = bookedSlots.some(
      (s) =>
        s.date === selectedDate &&
        s.timeSlot === selectedSlot &&
        s.status !== "Cancelled"
    );
    
    if (isTaken) return alert("This time slot is already booked by another user");

    try {
      const newDoc = await addDoc(collection(db, "appointments"), {
        clientName: auth.currentUser?.email,
        petId: selectedPet,
        petName: pets.find((p) => p.id === selectedPet)?.name,
        date: selectedDate,
        timeSlot: selectedSlot,
        status: "Pending",
        paymentMethod: "",
      });

      router.push(`/payment?appointmentId=${newDoc.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to book appointment");
    }
  };

  if (isLoading) {
    return (
      <>
        <GlobalStyle />
        <Wrapper>
          <LoadingSpinner>Loading...</LoadingSpinner>
        </Wrapper>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <Card>
          <Header>
            <HeaderIcon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zM6 12a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V12zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 15a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V15zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 18a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V18zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
            </HeaderIcon>
            Book Appointment
          </Header>
          <FormBox onSubmit={handleSubmit}>
            <InnerContent>
              <FormSection>
                <SectionTitle>
                  <SectionIcon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 016.775-5.025.75.75 0 01.313 1.248l-3.32 3.319c.063.475.276.934.627 1.33.35.389.820.729 1.382.963.56.235 1.217.389 1.925.389a.75.75 0 010 1.5c-.898 0-1.7-.192-2.375-.509A5.221 5.221 0 0115.75 8.25c0-.65-.126-1.275-.356-1.85l-2.57 2.57a.75.75 0 01-1.06 0l-3-3a.75.75 0 010-1.06l2.57-2.57a5.25 5.25 0 00-1.834 2.606A5.25 5.25 0 0112 6.75zM4.118 9.835a.75.75 0 01.897-.636 5.25 5.25 0 011.788.121c.857.194 1.64.582 2.302 1.128.66.544 1.187 1.233 1.536 2.028.348.795.516 1.67.491 2.544a.75.75 0 01-1.495-.1c.02-.68-.11-1.33-.38-1.93a3.75 3.75 0 00-.98-1.51 3.742 3.742 0 00-1.52-.98c-.6-.27-1.25-.4-1.93-.38a.75.75 0 01-.636-.897zM3.75 12a.75.75 0 01.75-.75c2.663 0 5.086.943 6.984 2.497a.75.75 0 01-.968 1.153A9.495 9.495 0 004.5 12.75a.75.75 0 01-.75-.75zm3.75 0a.75.75 0 01.75-.75c.763 0 1.458.216 2.055.57a.75.75 0 01-.765 1.29A3.752 3.752 0 008.25 12.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                    </svg>
                  </SectionIcon>
                  Select Your Pet
                </SectionTitle>
                <PetSelect
                  value={selectedPet || ""}
                  onChange={(e) => setSelectedPet(e.target.value)}
                  disabled={pets.length === 0}
                >
                  {pets.length === 0 ? (
                    <option value="">No pets found</option>
                  ) : (
                    pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </PetSelect>
              </FormSection>

              <FormSection>
                <SectionTitle>
                  <SectionIcon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                    </svg>
                  </SectionIcon>
                  Select Date
                </SectionTitle>
                <DateInput
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </FormSection>

              <FormSection>
                <SectionTitle>
                  <SectionIcon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                    </svg>
                  </SectionIcon>
                  Select Time Slot
                </SectionTitle>
                <SlotGrid>
                  {timeSlots.map((slot) => {
                    // Check if slot is taken by ANY user (not just current user)
                    const taken = bookedSlots.some(
                      (s) =>
                        s.date === selectedDate &&
                        s.timeSlot === slot &&
                        s.status !== "Cancelled"
                    );
                    
                    return (
                      <SlotButton
                        key={slot}
                        type="button"
                        disabled={taken}
                        className={selectedSlot === slot ? "selected" : ""}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot}
                        {taken && <TakenIndicator>Booked</TakenIndicator>}
                      </SlotButton>
                    );
                  })}
                </SlotGrid>
              </FormSection>

              <ButtonGroup>
                <Cancel
                  type="button"
                  onClick={() => router.push("/userdashboard")}
                >
                  Cancel
                </Cancel>
                <Next 
                  type="submit" 
                  disabled={!selectedPet || !selectedSlot || pets.length === 0}
                >
                  Proceed to Payment
                </Next>
              </ButtonGroup>
            </InnerContent>
          </FormBox>
        </Card>
      </Wrapper>
    </>
  );
};

export default AppointmentPage;

/* ===== STYLED COMPONENTS ===== */
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #e6f7f4;
  padding: 40px 20px;

  @media (max-width: 768px) {
    padding: 20px 16px;
    align-items: center;
  }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 24px;
  width: 100%;
  max-width: 800px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin: 0 auto;

  @media (max-width: 768px) {
    border-radius: 16px;
  }
`;

const Header = styled.h2`
  text-align: center;
  color: white;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  padding: 28px 0;
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;

  @media (max-width: 768px) {
    font-size: 24px;
    padding: 20px 0;
    flex-direction: column;
    gap: 8px;
  }
`;

const HeaderIcon = styled.span`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
  }
`;

const FormBox = styled.form`
  display: flex;
  flex-direction: column;
  padding: 40px;

  @media (max-width: 768px) {
    padding: 24px 20px;
  }
`;

const InnerContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;

  @media (max-width: 768px) {
    gap: 24px;
  }
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const SectionIcon = styled.span`
  width: 24px;
  height: 24px;
  color: #34B89C;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PetSelect = styled.select`
  padding: 16px;
  border-radius: 12px;
  border: 2px solid #6BC1E1;
  font-size: 16px;
  background: #f7fdfc;
  color: #057a66;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.2);
  }

  @media (max-width: 768px) {
    padding: 14px;
    font-size: 16px;
  }
`;

const DateInput = styled.input`
  padding: 16px;
  border-radius: 12px;
  border: 2px solid #6BC1E1;
  font-size: 16px;
  background: #ffffff;
  color: #2d3748;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.2);
  }

  @media (max-width: 768px) {
    padding: 14px;
    font-size: 16px;
  }
`;

const SlotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const SlotButton = styled.button`
  padding: 16px 12px;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  background: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;

  &.selected {
    background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
    border-color: transparent;
    color: white;
    font-weight: 600;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52, 184, 156, 0.3);
  }

  &:hover:not(:disabled) {
    border-color: #34B89C;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    background: #f8f9fa;
    color: #a0aec0;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 14px 10px;
  }
`;

const TakenIndicator = styled.span`
  font-size: 12px;
  color: #e53e3e;
  font-weight: 500;

  ${SlotButton}.selected & {
    color: rgba(255, 255, 255, 0.9);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-top: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }
`;

const Cancel = styled.button`
  padding: 18px 24px;
  background: white;
  color: #34B89C;
  border: 2px solid #34B89C;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;

  &:hover {
    background: #f7fdfc;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(52, 184, 156, 0.2);
  }

  @media (max-width: 768px) {
    padding: 16px;
    order: 2;
  }
`;

const Next = styled.button`
  padding: 18px 24px;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(52, 184, 156, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 16px;
    order: 1;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: #34B89C;
  font-weight: 600;
`;