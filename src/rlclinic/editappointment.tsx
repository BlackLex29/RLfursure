'use client';

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled, { createGlobalStyle } from "styled-components";
import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #E6F4F1;
  }
`;

interface AppointmentType {
  date: string;
  timeSlot: string;
}

const EditAppointment: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("id");

  const [appointment, setAppointment] = useState<AppointmentType>({ date: "", timeSlot: "" });
  const [loading, setLoading] = useState(true);

  const timeSlots = [
    "8:00 AM–8:30 AM", "9:00 AM–9:30 AM", "10:00 AM–10:30 AM",
    "11:00 AM–11:30 AM", "1:00 PM–1:30 PM",
    "2:00 PM–2:30 PM", "3:00 PM–3:30 PM", "4:00 PM–4:30 PM", "5:00 PM–5:30 PM"
  ];

  // 🔹 Fetch appointment data
  useEffect(() => {
    if (!appointmentId) return;
    const fetchData = async () => {
      const docRef = doc(db, "appointments", appointmentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as AppointmentType;
        setAppointment({ date: data.date, timeSlot: data.timeSlot });
      }
      setLoading(false);
    };
    fetchData();
  }, [appointmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;

    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        date: appointment.date,
        timeSlot: appointment.timeSlot,
      });
      alert("Appointment updated successfully.");
      router.push("/userdashboard");
    } catch (error) {
      console.error(error);
      alert("Failed to update appointment.");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <FormBox onSubmit={handleSubmit}>
          <Header> Edit Appointment </Header>

          <Section>
            <Label>Date:</Label>
            <Input
              type="date"
              value={appointment.date}
              onChange={(e) => setAppointment({ ...appointment, date: e.target.value })}
              required
            />
          </Section>

          <Section>
            <Label>Time Slot:</Label>
            <TimeGrid>
              {timeSlots.map((slot) => (
                <TimeButton
                  key={slot}
                  type="button"
                  className={appointment.timeSlot === slot ? "selected" : ""}
                  onClick={() => setAppointment({ ...appointment, timeSlot: slot })}
                >
                  {slot}
                </TimeButton>
              ))}
            </TimeGrid>
          </Section>

          <ButtonGroup>
            <Cancel type="button" onClick={() => router.push("/userdashboard")}>Cancel</Cancel>
            <Save type="submit">Save Changes</Save>
          </ButtonGroup>
        </FormBox>
      </Wrapper>
    </>
  );
};

export default EditAppointment;

/* ================= STYLES ================= */
const Wrapper = styled.div`
  min-height:100vh;
  display:flex;
  justify-content:center;
  align-items:center;
  padding:40px 10px;
`;

const FormBox = styled.form`
  background:white;
  padding:30px;
  border-radius:20px;
  box-shadow:0 10px 25px rgba(0,0,0,0.1);
  max-width:600px;
  width:100%;
  display:flex;
  flex-direction:column;
  gap:20px;
`;

const Header = styled.h2`
  text-align:center;
  font-family:'Rozha One', serif;
`;

const Section = styled.div`
  display:flex;
  flex-direction:column;
  gap:8px;
`;

const Label = styled.label`
  font-weight:bold;
`;

const Input = styled.input`
  padding:10px;
  border-radius:8px;
  border:1px solid #ccc;
`;

const TimeGrid = styled.div`
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
  gap:10px;
`;

const TimeButton = styled.button`
  padding:10px;
  border-radius:10px;
  border:1px solid black;
  background:white;
  cursor:pointer;
  font-size:14px;
  &.selected { background-color:#cceeff; border-color:#0077cc; font-weight:bold; }
  &:hover { background-color:#e8f4ff; }
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

const Save = styled.button`
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
