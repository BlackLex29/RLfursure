"use client";

import React, { useState, useEffect } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Rozha+One&display=swap');
`;

const Appointment: React.FC = () => {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [bookedSlots, setBookedSlots] = useState<{ date: string; timeSlot: string; status: string }[]>([]);

  const timeSlots = [
    "8:00 AM–8:30 AM", "9:00 AM–9:30 AM", "10:00 AM–10:30 AM",
    "11:00 AM–11:30 AM", "1:00 PM–1:30 PM",
    "2:00 PM–2:30 PM", "3:00 PM–3:30 PM", "4:00 PM–4:30 PM", "5:00 PM–5:30 PM"
  ];

  // 🔹 Fetch booked slots from Firestore
  const fetchBookedSlots = async () => {
    const snapshot = await getDocs(collection(db, "appointments"));
    const data: { date: string; timeSlot: string; status: string }[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      data.push({ date: d.date, timeSlot: d.timeSlot, status: d.status });
    });
    setBookedSlots(data);
  };

  useEffect(() => {
    fetchBookedSlots();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      alert("Please select a time slot.");
      return;
    }

    // Check if slot is already taken and not cancelled
    const isTaken = bookedSlots.some(
      (slot) => slot.date === selectedDate && slot.timeSlot === selectedSlot && slot.status !== "Cancelled"
    );
    if (isTaken) {
      alert("This slot is already taken. Please select another.");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "appointments"), {
        date: selectedDate,
        timeSlot: selectedSlot,
        clientName: auth.currentUser?.email || "Unknown",
        status: "Pending",
        petName: "",
        paymentMethod: ""
      });

      router.push(`/petregistration?appointmentId=${docRef.id}`);
    } catch (error) {
      console.error("Error booking appointment:", error);
      alert("Failed to book appointment.");
    }
  };

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <FormBox onSubmit={handleSubmit}>
          <HeaderCover>
            <Title>Appointment</Title>
          </HeaderCover>

          <InnerContent>
            <SectionTitle>Select Date</SectionTitle>
            <DateInput
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
            />

            <SectionTitle>Select Slot</SectionTitle>
            <SlotGrid>
              {timeSlots.map((slot) => {
                // Consider cancelled appointments as available
                const isTaken = bookedSlots.some(
                  (s) => s.date === selectedDate && s.timeSlot === slot && s.status !== "Cancelled"
                );
                return (
                  <SlotButton
                    key={slot}
                    type="button"
                    disabled={isTaken}
                    className={selectedSlot === slot ? "selected" : ""}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot} {isTaken ? "(Taken)" : ""}
                  </SlotButton>
                );
              })}
            </SlotGrid>

            <ButtonGroup>
              <Cancel type="button" onClick={() => router.push("/userdashboard")}>
                Cancel
              </Cancel>
              <Next type="submit">Next</Next>
            </ButtonGroup>
          </InnerContent>
        </FormBox>
      </Wrapper>
    </>
  );
};

// 🔹 Styled Components
const Wrapper = styled.div`
  min-height:100vh;
  background-color:#e6f4f1;
  display:flex;
  justify-content:center;
  align-items:center;
  padding:40px 10px;
`;

const FormBox = styled.form`
  background-color:#fff;
  border-radius:20px;
  box-shadow:0 10px 25px rgba(0,0,0,0.1);
  max-width:600px;
  width:100%;
  display:flex;
  flex-direction:column;
`;

const HeaderCover = styled.div`
  background-color:#6bc1e1;
  padding:30px 20px 20px;
  text-align:center;
`;

const Title = styled.h2`
  font-family:'Rozha One', serif;
  font-size:36px;
  color:white;
  margin-top:10px;
`;

const InnerContent = styled.div`
  display:flex;
  flex-direction:column;
  gap:20px;
  padding:30px;
`;

const SectionTitle = styled.h3`
  font-size:16px;
  font-weight:bold;
`;

const SlotGrid = styled.div`
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
  gap:10px;
`;

const SlotButton = styled.button`
  padding:10px;
  border-radius:10px;
  border:1px solid black;
  background:white;
  cursor:pointer;
  font-size:14px;
  transition:0.2s;
  &.selected { background-color:#cceeff;border-color:#0077cc;font-weight:bold; }
  &:hover:not(:disabled) { background-color:#e8f4ff; }
  &:disabled { background-color:#ddd;color:#888;cursor:not-allowed; }
`;

const DateInput = styled.input`
  padding:10px;
  border-radius:10px;
  border:1px solid #ccc;
  font-size:14px;
`;

const ButtonGroup = styled.div`
  display:flex;
  justify-content:space-between;
  gap:10px;
`;

const Cancel = styled.button`
  flex:1;
  padding:12px;
  background:white;
  color:red;
  border:1px solid red;
  border-radius:10px;
  font-weight:bold;
  cursor:pointer;
  &:hover { background:#ffeaea; }
`;

const Next = styled.button`
  flex:1;
  padding:12px;
  background:royalblue;
  color:white;
  border:none;
  border-radius:10px;
  font-weight:bold;
  cursor:pointer;
  &:hover { background-color:#3256c1; }
`;

export default Appointment;
