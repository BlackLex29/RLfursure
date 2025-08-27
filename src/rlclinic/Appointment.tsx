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
}

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #e6f7f4;
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

  useEffect(() => {
    const fetchPets = async () => {
      const snapshot = await getDocs(collection(db, "pets"));
      const userPets: Pet[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data() as DocumentData;
        if (d.ownerEmail === auth.currentUser?.email) {
          userPets.push({ id: doc.id, name: d.petName });
        }
      });
      setPets(userPets);
      if (userPets.length > 0) setSelectedPet(userPets[0].id);
    };

    const fetchBookedSlots = async () => {
      const snapshot = await getDocs(collection(db, "appointments"));
      const data: Appointment[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data() as DocumentData;
        data.push({
          date: d.date,
          timeSlot: d.timeSlot,
          status: d.status,
          petId: d.petId,
        });
      });
      setBookedSlots(data);
    };

    fetchPets();
    fetchBookedSlots();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet || !selectedSlot) return alert("Select pet & time slot");

    const isTaken = bookedSlots.some(
      (s) =>
        s.date === selectedDate &&
        s.timeSlot === selectedSlot &&
        s.petId === selectedPet &&
        s.status !== "Cancelled"
    );
    if (isTaken) return alert("Slot already taken for this pet");

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

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <Card>
          <Header>Book Appointment</Header>
          <FormBox onSubmit={handleSubmit}>
            <InnerContent>
              <SectionTitle>Pet</SectionTitle>
              <PetSelect
                value={selectedPet || ""}
                onChange={(e) => setSelectedPet(e.target.value)}
                disabled={pets.length === 0}
              >
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </PetSelect>

              <SectionTitle>Select Date</SectionTitle>
              <DateInput
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />

              <SectionTitle>Select Time Slot</SectionTitle>
              <SlotGrid>
                {timeSlots.map((slot) => {
                  const taken = bookedSlots.some(
                    (s) =>
                      s.date === selectedDate &&
                      s.timeSlot === slot &&
                      s.petId === selectedPet &&
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
                      {taken ? " (Taken)" : ""}
                    </SlotButton>
                  );
                })}
              </SlotGrid>

              <ButtonGroup>
                <Cancel
                  type="button"
                  onClick={() => router.push("/userdashboard")}
                >
                  Cancel
                </Cancel>
                <Next type="submit">Proceed to Payment</Next>
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
  min-height:100vh;
  display:flex;
  justify-content:center;
  align-items:flex-start;
  background: #e6f7f4;
  padding:60px 20px;
`;

const Card = styled.div`
  background:#ffffff;
  border-radius:20px;
  width:100%;
  max-width:600px;
  box-shadow:0 10px 30px rgba(0,0,0,0.1);
  overflow:hidden;
`;

const Header = styled.h2`
  text-align:center;
  color:white;
  background: linear-gradient(90deg,#34B89C,#6BC1E1);
  padding:25px 0;
  margin:0;
  font-family:'Rozha One', serif;
  font-size:32px;
`;

const FormBox = styled.form`
  display:flex;
  flex-direction:column;
  padding:30px;
`;

const InnerContent = styled.div`
  display:flex;
  flex-direction:column;
  gap:20px;
`;

const SectionTitle = styled.h3`
  font-size:16px;
  font-weight:bold;
  color:#333;
`;

const PetSelect = styled.select`
  padding:12px;
  border-radius:12px;
  border:1px solid #6BC1E1;
  font-size:16px;
  background:#d6f1ef;
  color:#057a66;
  font-weight:600;
`;

const DateInput = styled.input`
  padding:12px;
  border-radius:12px;
  border:1px solid #6BC1E1;
  font-size:14px;
  background:#ffffff;
`;

const SlotGrid = styled.div`
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
  gap:12px;
`;

const SlotButton = styled.button`
  padding:12px;
  border-radius:12px;
  border:1px solid #34B89C;
  background:white;
  cursor:pointer;
  font-size:14px;
  font-weight:500;
  transition: 0.2s all ease;

  &.selected{
    background: linear-gradient(90deg,#34B89C,#6BC1E1);
    border-color:#34B89C;
    color:white;
    font-weight:600;
  }

  &:hover:not(:disabled){
    background: #d6f1ef;
  }

  &:disabled{
    background:#f0f0f0;
    color:#888;
    cursor:not-allowed;
  }
`;

const ButtonGroup = styled.div`
  display:flex;
  justify-content:space-between;
  gap:12px;
`;

const Cancel = styled.button`
  flex:1;
  padding:14px;
  background:white;
  color:#34B89C;
  border:1px solid #34B89C;
  border-radius:12px;
  font-weight:bold;
  cursor:pointer;
  transition: 0.2s all ease;

  &:hover{background:#d6f1ef;}
`;

const Next = styled.button`
  flex:1;
  padding:14px;
  background: linear-gradient(90deg,#34B89C,#6BC1E1);
  color:white;
  border:none;
  border-radius:12px;
  font-weight:bold;
  cursor:pointer;
  transition: 0.2s all ease;

  &:hover{opacity:0.85;}
`;
