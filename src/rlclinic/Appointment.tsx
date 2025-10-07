'use client';

import React, { useEffect, useState, useCallback, useMemo, useReducer, useRef } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// 🔹 Enhanced Types with Pricing
interface Pet {
  id: string;
  name: string;
}

interface Appointment {
  id?: string;
  date: string;
  timeSlot: string;
  status: string;
  petId: string;
  petName?: string;
  clientName: string;
  appointmentType: string;
  price?: number;
  paymentMethod?: string;
  createdAt?: unknown;
}

interface Unavailable {
  id: string;
  date: string;
  veterinarian: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}

interface Doctor {
  id: string;
  name: string;
  email: string;
}

interface AppointmentType {
  value: string;
  label: string;
  price: number;
}

interface AppointmentNotificationData {
  clientName: string | null | undefined;
  petName: string | undefined;
  date: string;
  timeSlot: string | null;
  appointmentType: string;
  price: number;
  appointmentId?: string;
}

// 🔹 State Management with useReducer
interface BookingState {
  selectedPet: string | null;
  selectedDate: string;
  selectedSlot: string | null;
  selectedAppointmentType: string;
  selectedPrice: number;
  selectedPaymentMethod: string;
}

type BookingAction = 
  | { type: 'SET_PET'; payload: string }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_SLOT'; payload: string }
  | { type: 'SET_APPOINTMENT_TYPE'; payload: { type: string; price: number } }
  | { type: 'SET_PAYMENT_METHOD'; payload: string }
  | { type: 'RESET' };

const bookingReducer = (state: BookingState, action: BookingAction): BookingState => {
  switch (action.type) {
    case 'SET_PET':
      return { ...state, selectedPet: action.payload };
    case 'SET_DATE':
      return { ...state, selectedDate: action.payload };
    case 'SET_SLOT':
      return { ...state, selectedSlot: action.payload };
    case 'SET_APPOINTMENT_TYPE':
      return { 
        ...state, 
        selectedAppointmentType: action.payload.type,
        selectedPrice: action.payload.price 
      };
    case 'SET_PAYMENT_METHOD':
      return { 
        ...state, 
        selectedPaymentMethod: action.payload 
      };
    case 'RESET':
      return {
        selectedPet: null,
        selectedDate: new Date().toISOString().split("T")[0],
        selectedSlot: null,
        selectedAppointmentType: "",
        selectedPrice: 0,
        selectedPaymentMethod: "Cash"
      };
    default:
      return state;
  }
};

// 🔹 Enhanced Appointment Types with Pricing
const appointmentTypes: AppointmentType[] = [
  { value: "vaccination", label: "Vaccination", price: 500},
  { value: "checkup", label: "Check Up", price: 300 },
  { value: "antiRabies", label: "Anti Rabies", price: 300 },
  { value: "ultrasound", label: "Ultrasound", price: 800 },
  { value: "groom", label: "Grooming", price: 900 },
  { value: "spayNeuter", label: "Spay/Neuter (Kapon)", price: 1500 },
  { value: "deworm", label: "Deworming (Purga)", price: 300 }
];

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

// Payment methods
const paymentMethods = [
  { value: "Cash", label: "Cash Payment", description: "Pay with cash when you arrive" },
  { value: "GCash", label: "GCash", description: "Pay online using GCash" }
];

// 🔹 FIXED: Custom Hook for Appointment Data
const useAppointmentData = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Appointment[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<Unavailable[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeAuth: () => void;
    let unsubscribePets: () => void;
    let unsubscribeAppointments: () => void;
    let unsubscribeUnavailable: () => void;

    const fetchData = async (user: any) => {
      setIsLoading(true);
      try {
        if (!user) {
          setIsLoading(false);
          return;
        }

        // ✅ FIXED: Query pets collection
        const petsQuery = query(
          collection(db, "pets"), 
          where("ownerId", "==", user.uid)
        );
        
        const petsSnapshot = await getDocs(petsQuery);
        
        const userPets: Pet[] = [];
        petsSnapshot.forEach((doc) => {
          const petData = doc.data();
          const petName = petData.petName || petData.name || "Unnamed Pet";
          
          if (petData.ownerId === user.uid) {
            userPets.push({ 
              id: doc.id, 
              name: petName
            });
          }
        });
        
        setPets(userPets);

        // Fetch doctors
        const doctorsSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "veterinarian")));
        const doctorsData: Doctor[] = [];
        doctorsSnapshot.forEach((doc) => {
          const data = doc.data();
          doctorsData.push({
            id: doc.id,
            name: data.name,
            email: data.email
          });
        });
        setDoctors(doctorsData);

      } catch (error) {
        console.error("❌ Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user);
        
        // Set up real-time listeners only after user is authenticated
        try {
          // Real-time pets listener
          const petsQuery = query(collection(db, "pets"), where("ownerId", "==", user.uid));
          unsubscribePets = onSnapshot(petsQuery, 
            (snapshot) => {
              const userPets: Pet[] = [];
              snapshot.forEach((doc) => {
                const petData = doc.data();
                const petName = petData.petName || petData.name || "Unnamed Pet";
                userPets.push({ id: doc.id, name: petName });
              });
              setPets(userPets);
            },
            (error) => {
              console.error("❌ Pets listener error:", error);
            }
          );

          // Real-time appointments listener
          unsubscribeAppointments = onSnapshot(collection(db, "appointments"), 
            (snapshot) => {
              const appointmentsData: Appointment[] = [];
              snapshot.forEach((doc) => {
                const data = doc.data();
                appointmentsData.push({
                  id: doc.id,
                  date: data.date,
                  timeSlot: data.timeSlot,
                  status: data.status,
                  petId: data.petId,
                  clientName: data.clientName || "",
                  appointmentType: data.appointmentType || "",
                  price: data.price || 0
                });
              });
              setBookedSlots(appointmentsData);
            },
            (error) => {
              console.error("❌ Appointments listener error:", error);
            }
          );

          // Real-time unavailable slots listener
          unsubscribeUnavailable = onSnapshot(collection(db, "unavailableSlots"), 
            (snapshot) => {
              const unavailableData: Unavailable[] = [];
              snapshot.forEach((doc) => {
                const data = doc.data();
                let dateValue = data.date;
                if (dateValue?.toDate) {
                  dateValue = dateValue.toDate().toISOString().split('T')[0];
                }
                unavailableData.push({
                  id: doc.id,
                  date: dateValue,
                  veterinarian: data.veterinarian,
                  isAllDay: data.isAllDay,
                  startTime: data.startTime,
                  endTime: data.endTime
                });
              });
              setUnavailableSlots(unavailableData);
            },
            (error) => {
              console.error("❌ Unavailable slots listener error:", error);
            }
          );

        } catch (listenerError) {
          console.error("❌ Error setting up real-time listeners:", listenerError);
        }

      } else {
        setPets([]);
        setBookedSlots([]);
        setUnavailableSlots([]);
        setIsLoading(false);
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribePets) unsubscribePets();
      if (unsubscribeAppointments) unsubscribeAppointments();
      if (unsubscribeUnavailable) unsubscribeUnavailable();
    };
  }, []);

  return { pets, bookedSlots, unavailableSlots, doctors, isLoading };
};

// 🔹 Custom Hook for Availability Logic
const useAvailability = (unavailableSlots: Unavailable[]) => {
  const isDateUnavailable = useCallback((date: string) => {
    return unavailableSlots.some(slot => {
      const slotDateFormatted = new Date(slot.date).toISOString().split('T')[0];
      const selectedDateFormatted = new Date(date).toISOString().split('T')[0];
      return slotDateFormatted === selectedDateFormatted;
    });
  }, [unavailableSlots]);

  const getUnavailableDates = useCallback(() => {
    return unavailableSlots
      .map(slot => new Date(slot.date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }));
  }, [unavailableSlots]);

  return { isDateUnavailable, getUnavailableDates };
};

// 🔹 Pet Selector Component
const PetSelector: React.FC<{
  pets: Pet[];
  selectedPet: string | null;
  onPetChange: (petId: string) => void;
}> = ({ pets, selectedPet, onPetChange }) => (
  <FormSection>
    <SectionTitle>
      <SectionIcon>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 016.775-5.025.75.75 0 01.313 1.248l-3.32 3.319c.063.475.276.934.627 1.33.35.389.820.729 1.382.963.56.235 1.217.389 1.925.389a.75.75 0 010 1.5c-.898 0-1.7-.192-2.375-.509A5.221 5.221 0 0115.75 8.25c0-.65-.126-1.275-.356-1.85l-2.57 2.57a.75.75 0 01-1.06 0l-3-3a.75.75 0 010-1.06l2.57-2.57a5.25 5.25 0 00-1.834 2.606A5.25 5.25 0 0012 6.75z" clipRule="evenodd" />
        </svg>
      </SectionIcon>
      Select Your Pet
    </SectionTitle>
    <PetSelect
      value={selectedPet || ""}
      onChange={(e) => onPetChange(e.target.value)}
      disabled={pets.length === 0}
    >
      <option value="">Select a pet</option>
      {pets.length === 0 ? (
        <option value="" disabled>No pets found. Please register a pet first.</option>
      ) : (
        pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))
      )}
    </PetSelect>
    {pets.length === 0 && (
      <NoPetsWarning>
        ⚠️ No pets found. Please register your pet first before booking an appointment.
      </NoPetsWarning>
    )}
  </FormSection>
);

// 🔹 Enhanced Appointment Type Grid with Pricing
const AppointmentTypeGrid: React.FC<{
  selectedType: string;
  selectedPrice: number;
  onTypeChange: (type: string, price: number) => void;
}> = ({ selectedType, selectedPrice, onTypeChange }) => (
  <FormSection>
    <SectionTitle>
      <SectionIcon>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 016.775-5.025.75.75 0 01.313 1.248l-3.32 3.319c.063.475.276.934.627 1.33.35.389.820.729 1.382.963.56.235 1.217.389 1.925.389a.75.75 0 010 1.5c-.898 0-1.7-.192-2.375-.509A5.221 5.221 0 0115.75 8.25c0-.65-.126-1.275-.356-1.85l-2.57 2.57a.75.75 0 01-1.06 0l-3-3a.75.75 0 010-1.06l2.57-2.57a5.25 5.25 0 00-1.834 2.606A5.25 5.25 0 0112 6.75z" clipRule="evenodd" />
        </svg>
      </SectionIcon>
      Select Appointment Type
      {selectedPrice > 0 && (
        <PriceDisplay>
          Total: ₱{selectedPrice.toLocaleString()}
        </PriceDisplay>
      )}
    </SectionTitle>
    <AppointmentTypeContainer>
      {appointmentTypes.map((type) => (
        <AppointmentTypeButton
          key={type.value}
          type="button"
          className={selectedType === type.value ? "selected" : ""}
          onClick={() => onTypeChange(type.value, type.price)}
        >
          <TypeLabel>{type.label}</TypeLabel>
          <TypePrice>₱{type.price.toLocaleString()}</TypePrice>
        </AppointmentTypeButton>
      ))}
    </AppointmentTypeContainer>
  </FormSection>
);

// 🔹 Date Time Selector Component
const DateTimeSelector: React.FC<{
  selectedDate: string;
  selectedSlot: string | null;
  bookedSlots: Appointment[];
  isDateUnavailable: (date: string) => boolean;
  unavailableDates: string[];
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string) => void;
}> = ({ 
  selectedDate, 
  selectedSlot, 
  bookedSlots, 
  isDateUnavailable, 
  unavailableDates,
  onDateChange, 
  onSlotChange 
}) => (
  <>
    <FormSection>
      <SectionTitle>
        <SectionIcon>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
          </svg>
        </SectionIcon>
        Select Date
      </SectionTitle>
      <DateInput
        type="date"
        value={selectedDate}
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => onDateChange(e.target.value)}
      />
      {isDateUnavailable(selectedDate) && (
        <UnavailableWarning>
          ⚠️ This date is unavailable. Please select another date.
        </UnavailableWarning>
      )}
      {unavailableDates.length > 0 && (
        <UnavailableDatesInfo>
          <strong>Upcoming Unavailable Dates:</strong> {unavailableDates.slice(0, 5).join(", ")}
          {unavailableDates.length > 5 && ` and ${unavailableDates.length - 5} more...`}
        </UnavailableDatesInfo>
      )}
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
          const taken = bookedSlots.some(
            (s) => s.date === selectedDate && s.timeSlot === slot && s.status !== "Cancelled"
          );
          const dateUnavailable = isDateUnavailable(selectedDate);
          
          return (
            <SlotButton
              key={slot}
              type="button"
              disabled={taken || dateUnavailable}
              className={selectedSlot === slot ? "selected" : ""}
              onClick={() => !dateUnavailable && !taken && onSlotChange(slot)}
            >
              {slot}
              {taken && <TakenIndicator>Booked</TakenIndicator>}
              {dateUnavailable && <TakenIndicator>Unavailable</TakenIndicator>}
            </SlotButton>
          );
        })}
      </SlotGrid>
    </FormSection>
  </>
);

// 🔹 Payment Method Selector Component
const PaymentMethodSelector: React.FC<{
  selectedMethod: string;
  onMethodChange: (method: string) => void;
}> = ({ selectedMethod, onMethodChange }) => (
  <FormSection>
    <SectionTitle>
      <SectionIcon>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
          <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
        </svg>
      </SectionIcon>
      Select Payment Method
    </SectionTitle>
    <PaymentMethodContainer>
      {paymentMethods.map((method) => (
        <PaymentMethodButton
          key={method.value}
          type="button"
          className={selectedMethod === method.value ? "selected" : ""}
          onClick={() => onMethodChange(method.value)}
        >
          <PaymentMethodIcon>
            {method.value === "Cash" ? "💵" : "📱"}
          </PaymentMethodIcon>
          <PaymentMethodDetails>
            <PaymentMethodLabel>{method.label}</PaymentMethodLabel>
            <PaymentMethodDescription>{method.description}</PaymentMethodDescription>
          </PaymentMethodDetails>
        </PaymentMethodButton>
      ))}
    </PaymentMethodContainer>
  </FormSection>
);

// 🔹 UPDATED: Clean Printable Receipt Component
const PrintableReceipt: React.FC<{
  appointment: Appointment;
  onClose: () => void;
}> = ({ appointment, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAppointmentTypeLabel = (value: string) => {
    const type = appointmentTypes.find(t => t.value === value);
    return type ? type.label : value;
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${appointment.petName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              background: white;
            }
            .receipt-container {
              max-width: 400px;
              margin: 0 auto;
              border: 2px solid #34B89C;
              border-radius: 12px;
              padding: 24px;
              background: white;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #e0e0e0;
            }
            .clinic-name {
              font-size: 24px;
              font-weight: bold;
              color: #34B89C;
              margin: 0 0 8px 0;
            }
            .receipt-title {
              font-size: 18px;
              font-weight: bold;
              margin: 8px 0;
              color: #2c3e50;
            }
            .receipt-subtitle {
              color: #27AE60;
              font-weight: 600;
              margin: 0;
            }
            .receipt-section {
              margin-bottom: 20px;
            }
            .section-title {
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 12px;
              font-size: 16px;
              border-bottom: 1px solid #e0e0e0;
              padding-bottom: 4px;
            }
            .receipt-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .item-label {
              color: #666;
            }
            .item-value {
              font-weight: 600;
            }
            .receipt-total {
              display: flex;
              justify-content: space-between;
              font-size: 18px;
              font-weight: bold;
              margin-top: 16px;
              padding-top: 16px;
              border-top: 2px solid #34B89C;
            }
            .total-label {
              color: #2c3e50;
            }
            .total-value {
              color: #34B89C;
            }
            .clinic-info {
              text-align: center;
              margin-top: 24px;
              padding-top: 16px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #666;
            }
            .thank-you {
              text-align: center;
              font-weight: bold;
              margin: 16px 0;
              color: #34B89C;
            }
            .print-actions {
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="receipt-header">
              <div class="clinic-name">PetCare Veterinary Clinic</div>
              <div class="receipt-title">APPOINTMENT RECEIPT</div>
              <div class="receipt-subtitle">Payment Successful</div>
            </div>

            <div class="receipt-section">
              <div class="section-title">Appointment Details</div>
              <div class="receipt-item">
                <span class="item-label">Pet Name:</span>
                <span class="item-value">${appointment.petName}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Service:</span>
                <span class="item-value">${getAppointmentTypeLabel(appointment.appointmentType)}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Date:</span>
                <span class="item-value">${formatDate(appointment.date)}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Time:</span>
                <span class="item-value">${appointment.timeSlot}</span>
              </div>
            </div>

            <div class="receipt-section">
              <div class="section-title">Payment Information</div>
              <div class="receipt-item">
                <span class="item-label">Payment Method:</span>
                <span class="item-value">${appointment.paymentMethod}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Status:</span>
                <span class="item-value" style="color: #27AE60;">${appointment.status}</span>
              </div>
              <div class="receipt-total">
                <span class="total-label">Total Amount:</span>
                <span class="total-value">₱${appointment.price?.toLocaleString()}</span>
              </div>
            </div>

            <div class="thank-you">Thank you for your appointment!</div>

            <div class="clinic-info">
              <div><strong>PetCare Veterinary Clinic</strong></div>
              <div>123 Pet Street, Animal City</div>
              <div>Phone: (02) 1234-5678</div>
              <div>Email: info@petcareclinic.com</div>
              <div style="margin-top: 8px; font-style: italic;">
                Please arrive 10 minutes before your scheduled appointment time.
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    
    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
      // Don't close immediately after print - let user decide
    }, 500);
  };

  return (
    <PrintOverlay>
      <PrintContainer ref={receiptRef}>
        <PrintHeader>
          <ClinicNamePrint>PetCare Veterinary Clinic</ClinicNamePrint>
          <ReceiptTitlePrint>APPOINTMENT RECEIPT</ReceiptTitlePrint>
          <ReceiptSubtitlePrint>Payment Successful</ReceiptSubtitlePrint>
        </PrintHeader>

        <PrintSection>
          <SectionTitlePrint>Appointment Details</SectionTitlePrint>
          <PrintItem>
            <ItemLabel>Pet Name:</ItemLabel>
            <ItemValue>{appointment.petName}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Service:</ItemLabel>
            <ItemValue>{getAppointmentTypeLabel(appointment.appointmentType)}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Date:</ItemLabel>
            <ItemValue>{formatDate(appointment.date)}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Time:</ItemLabel>
            <ItemValue>{appointment.timeSlot}</ItemValue>
          </PrintItem>
        </PrintSection>

        <PrintSection>
          <SectionTitlePrint>Payment Information</SectionTitlePrint>
          <PrintItem>
            <ItemLabel>Payment Method:</ItemLabel>
            <ItemValue>{appointment.paymentMethod}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Status:</ItemLabel>
            <ItemValue className="success">{appointment.status}</ItemValue>
          </PrintItem>
          <PrintTotal>
            <TotalLabel>Total Amount:</TotalLabel>
            <TotalValue>₱{appointment.price?.toLocaleString()}</TotalValue>
          </PrintTotal>
        </PrintSection>

        <ThankYouPrint>Thank you for your appointment!</ThankYouPrint>

        <ClinicInfoPrint>
          <ClinicNameSmall>PetCare Veterinary Clinic</ClinicNameSmall>
          <ClinicAddress>123 Pet Street, Animal City</ClinicAddress>
          <ClinicContact>Phone: (02) 1234-5678 | Email: info@petcareclinic.com</ClinicContact>
          <ClinicNote>Please arrive 10 minutes before your scheduled appointment time.</ClinicNote>
        </ClinicInfoPrint>

        <PrintActions className="no-print">
          <PrintButton onClick={handlePrint}>
            <PrintIcon>🖨️</PrintIcon>
            Print Receipt
          </PrintButton>
          <CloseButton onClick={onClose}>
            Close
          </CloseButton>
        </PrintActions>
      </PrintContainer>
    </PrintOverlay>
  );
};

// 🔹 UPDATED: Clean Receipt Screen Component
const ReceiptScreen: React.FC<{
  appointment: Appointment;
  onViewReceipt: () => void;
}> = ({ appointment, onViewReceipt }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAppointmentTypeLabel = (value: string) => {
    const type = appointmentTypes.find(t => t.value === value);
    return type ? type.label : value;
  };

  return (
    <ReceiptContainer>
      <ReceiptHeader>
        <SuccessIcon>✅</SuccessIcon>
        <ReceiptTitleMain>Appointment Confirmed</ReceiptTitleMain>
        <ReceiptSubtitleMain>Your booking has been successfully processed</ReceiptSubtitleMain>
      </ReceiptHeader>

      <ReceiptContent>
        <ReceiptCard>
          <CardHeader>
            <CardTitle>Appointment Summary</CardTitle>
            <StatusBadge className="success">{appointment.status}</StatusBadge>
          </CardHeader>
          
          <DetailsGrid>
            <DetailItem>
              <DetailLabel>Pet Name</DetailLabel>
              <DetailValue>{appointment.petName}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Service</DetailLabel>
              <DetailValue>{getAppointmentTypeLabel(appointment.appointmentType)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Date</DetailLabel>
              <DetailValue>{formatDate(appointment.date)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Time</DetailLabel>
              <DetailValue>{appointment.timeSlot}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Payment Method</DetailLabel>
              <DetailValue>{appointment.paymentMethod}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Amount Paid</DetailLabel>
              <DetailValue className="price">₱{appointment.price?.toLocaleString()}</DetailValue>
            </DetailItem>
          </DetailsGrid>
        </ReceiptCard>

        <InfoBox>
          <InfoIcon>💡</InfoIcon>
          <InfoContent>
            <InfoTitle>Important Reminders</InfoTitle>
            <InfoList>
              <InfoItem>Please arrive 10 minutes before your scheduled time</InfoItem>
              <InfoItem>Bring any previous medical records if available</InfoItem>
              <InfoItem>Keep your pet on a leash or in a carrier</InfoItem>
              <InfoItem>Cancel at least 24 hours in advance if unable to attend</InfoItem>
            </InfoList>
          </InfoContent>
        </InfoBox>
      </ReceiptContent>

      <ReceiptActions>
        <ReceiptButton onClick={onViewReceipt} className="primary">
          <PrintIcon>🧾</PrintIcon>
          View & Print Receipt
        </ReceiptButton>
        <ReceiptButton onClick={() => window.location.href = '/userdashboard'} className="secondary">
          Back to Dashboard
        </ReceiptButton>
      </ReceiptActions>
    </ReceiptContainer>
  );
};

// 🔹 Payment Processing Function - FIXED
const processPayment = async (
  appointmentId: string, 
  amount: number, 
  appointmentType: string, 
  petName: string, 
  paymentMethod: string
): Promise<boolean> => {
  try {
    if (paymentMethod === "Cash") {
      return false;
    }
    
    const amountInCentavos = Math.round(amount * 100);
    
    console.log("💳 Starting payment process for appointment:", appointmentId);

    const res = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInCentavos,
        description: `${appointmentType} for ${petName}`,
        payment_method_type: paymentMethod.toLowerCase(),
        return_url: `${window.location.origin}/appointment?payment_success=true&appointment_id=${appointmentId}`,
        reference_number: appointmentId
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("❌ Payment API error:", errorData);
      throw new Error(errorData.error || `Payment failed: ${res.status}`);
    }

    const responseData = await res.json();
    console.log("✅ Payment API response:", responseData);

    if (!responseData.success) {
      throw new Error(responseData.error || "Payment failed");
    }

    const checkoutUrl = responseData.data?.checkout_url;

    if (checkoutUrl) {
      console.log("🔗 Redirecting to:", checkoutUrl);
      
      sessionStorage.setItem('pendingAppointmentId', appointmentId);
      
      window.location.href = checkoutUrl;
      return true;
    } else {
      throw new Error("No checkout URL received");
    }
  } catch (err) {
    console.error("❌ Payment processing error:", err);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown payment error';
    
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        status: "Payment Failed",
        paymentError: errorMessage
      });
    } catch (updateError) {
      console.error("❌ Failed to update appointment status:", updateError);
    }
    
    throw new Error(errorMessage);
  }
};  

// 🔹 Main Appointment Page Component - FIXED handlePaymentSelection
const AppointmentPage: React.FC = () => {
  const router = useRouter();
  const { pets, bookedSlots, unavailableSlots, doctors, isLoading } = useAppointmentData();
  const { isDateUnavailable, getUnavailableDates } = useAvailability(unavailableSlots);
  
  const [isClient, setIsClient] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  
  const initialState: BookingState = {
    selectedPet: null,
    selectedDate: currentDate,
    selectedSlot: null,
    selectedAppointmentType: "",
    selectedPrice: 0,
    selectedPaymentMethod: "Cash"
  };

  const [bookingState, dispatch] = useReducer(bookingReducer, initialState);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPrintableReceipt, setShowPrintableReceipt] = useState(false);
  const [completedAppointment, setCompletedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    setIsClient(true);
    const today = new Date().toISOString().split("T")[0];
    setCurrentDate(today);
    dispatch({ type: 'SET_DATE', payload: today });
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const appointmentId = urlParams.get('appointment_id');
    
    if (paymentSuccess === 'true' && appointmentId) {
      const fetchAppointmentDetails = async () => {
        try {
          const appointmentDoc = await getDoc(doc(db, "appointments", appointmentId));
          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data();
            
            await updateDoc(doc(db, "appointments", appointmentId), {
              status: "Confirmed",
              paymentMethod: "GCash"
            });

            const petDoc = await getDoc(doc(db, "pets", appointmentData.petId));
            let petName = "Unknown Pet";
            if (petDoc.exists()) {
              petName = petDoc.data().petName || petDoc.data().name || "Unknown Pet";
            }

            const fullAppointment: Appointment = {
              id: appointmentId,
              date: appointmentData.date,
              timeSlot: appointmentData.timeSlot,
              status: "Confirmed",
              petId: appointmentData.petId,
              petName: petName,
              clientName: appointmentData.clientName,
              appointmentType: appointmentData.appointmentType,
              price: appointmentData.price,
              paymentMethod: "GCash",
              createdAt: appointmentData.createdAt
            };

            setCompletedAppointment(fullAppointment);
            setShowReceipt(true);
          }
        } catch (error) {
          console.error("Error fetching appointment details:", error);
          router.push("/userdashboard");
        }
      };

      fetchAppointmentDetails();
      
      window.history.replaceState({}, document.title, "/appointment");
    }
  }, [router, isClient]);

  useEffect(() => {
    if (pets.length > 0 && !bookingState.selectedPet) {
      dispatch({ type: 'SET_PET', payload: pets[0].id });
    }
  }, [pets, bookingState.selectedPet]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate } = bookingState;
    
    if (!selectedPet || !selectedSlot || !selectedAppointmentType) {
      alert("Please complete all required fields");
      return;
    }

    if (isDateUnavailable(selectedDate)) {
      alert("This date is unavailable. Please select another date.");
      return;
    }

    const isTaken = bookedSlots.some(
      (s) => s.date === selectedDate && s.timeSlot === selectedSlot && s.status !== "Cancelled"
    );
    
    if (isTaken) {
      alert("This time slot is already booked by another user");
      return;
    }

    setShowPaymentMethods(true);
  }, [bookingState, bookedSlots, isDateUnavailable]);

  // 🔹 FIXED: handlePaymentSelection function - properly handle null selectedSlot
  const handlePaymentSelection = useCallback(async (paymentMethod: string) => {
    setIsProcessing(true);
    setShowPaymentMethods(false);
    
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate, selectedPrice } = bookingState;

    // Check if required fields are present
    if (!selectedPet || !selectedSlot || !selectedAppointmentType) {
      alert("Please complete all required fields");
      setIsProcessing(false);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user");
      }

      const selectedPetData = pets.find((p) => p.id === selectedPet);
      
      // ✅ FIXED: Ensure selectedSlot is not null
      const appointmentData = {
        userId: currentUser.uid,
        clientName: currentUser.email,
        clientId: currentUser.uid,
        petId: selectedPet,
        petName: selectedPetData?.name,
        date: selectedDate,
        timeSlot: selectedSlot, // This is now guaranteed to be string
        appointmentType: selectedAppointmentType,
        price: selectedPrice,
        status: paymentMethod === "Cash" ? "Confirmed" : "Pending Payment",
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log("💾 Creating appointment:", appointmentData);

      const newDoc = await addDoc(collection(db, "appointments"), appointmentData);

      await updateDoc(doc(db, "appointments", newDoc.id), {
        id: newDoc.id
      });

      console.log("✅ Appointment created with ID:", newDoc.id);

      try {
        const doctorNotifications = doctors.map(async (doctor) => {
          return addDoc(collection(db, "notifications"), {
            recipientId: doctor.id,
            recipientEmail: doctor.email,
            type: "new_appointment",
            title: "New Appointment Booked",
            message: `New appointment booked by ${currentUser.email} for ${selectedPetData?.name} on ${selectedDate} at ${selectedSlot} - ₱${selectedPrice}`,
            appointmentId: newDoc.id,
            isRead: false,
            createdAt: serverTimestamp()
          });
        });

        await Promise.all(doctorNotifications);
        console.log("✅ Notifications sent to doctors");
      } catch (notifError) {
        console.error("❌ Notification error:", notifError);
      }

      if (paymentMethod === "Cash") {
        const fullAppointment: Appointment = {
          id: newDoc.id,
          date: selectedDate,
          timeSlot: selectedSlot, // This is now guaranteed to be string
          status: "Confirmed",
          petId: selectedPet,
          petName: selectedPetData?.name,
          clientName: currentUser.email || "",
          appointmentType: selectedAppointmentType,
          price: selectedPrice,
          paymentMethod: "Cash",
          createdAt: new Date()
        };
        
        setCompletedAppointment(fullAppointment);
        setShowReceipt(true);
      } else {
        try {
          const isRedirecting = await processPayment(
            newDoc.id, 
            selectedPrice, 
            selectedAppointmentType, 
            selectedPetData?.name || "Pet",
            paymentMethod
          );

          if (!isRedirecting) {
            alert("Appointment booked successfully!");
            router.push("/userdashboard");
          }
        } catch (paymentError) {
          console.error("❌ Payment error:", paymentError);
          
          const errorMessage = paymentError instanceof Error ? paymentError.message : 'Payment processing failed';
          
          await updateDoc(doc(db, "appointments", newDoc.id), {
            status: "Payment Failed",
            paymentError: errorMessage
          });
          
          alert(`Appointment created but payment failed: ${errorMessage}. Please try again or pay with cash.`);
          router.push("/userdashboard");
        }
      }
      
    } catch (err) {
      console.error("❌ Appointment creation error:", err);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert("Failed to book appointment: " + errorMessage);
      
    } finally {
      setIsProcessing(false);
    }
  }, [bookingState, pets, doctors, router]);

  const unavailableDates = useMemo(() => getUnavailableDates(), [getUnavailableDates]);

  const isFormValid = useMemo(() => {
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate } = bookingState;
    return selectedPet && selectedSlot && selectedAppointmentType && 
          pets.length > 0 && !isDateUnavailable(selectedDate);
  }, [bookingState, pets.length, isDateUnavailable]);

  const handleViewReceipt = () => {
    setShowPrintableReceipt(true);
  };

  const handleClosePrintableReceipt = () => {
    setShowPrintableReceipt(false);
  };

  if (isLoading) {
    return (
      <>
        <GlobalStyle />
        <Wrapper>
          <LoadingSpinner>Loading appointment data...</LoadingSpinner>
        </Wrapper>
      </>
    );
  }

  if (showPrintableReceipt && completedAppointment) {
    return (
      <PrintableReceipt 
        appointment={completedAppointment} 
        onClose={handleClosePrintableReceipt}
      />
    );
  }

  if (showReceipt && completedAppointment) {
    return (
      <>
        <GlobalStyle />
        <Wrapper>
          <Card>
            <ReceiptScreen 
              appointment={completedAppointment} 
              onViewReceipt={handleViewReceipt}
            />
          </Card>
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
                <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375z" clipRule="evenodd" />
              </svg>
            </HeaderIcon>
            Book Appointment
          </Header>
          
          {!showPaymentMethods ? (
            <FormBox onSubmit={handleSubmit}>
              <InnerContent>
                <PetSelector
                  pets={pets}
                  selectedPet={bookingState.selectedPet}
                  onPetChange={(petId) => dispatch({ type: 'SET_PET', payload: petId })}
                />

                <AppointmentTypeGrid
                  selectedType={bookingState.selectedAppointmentType}
                  selectedPrice={bookingState.selectedPrice}
                  onTypeChange={(type, price) => dispatch({ 
                    type: 'SET_APPOINTMENT_TYPE', 
                    payload: { type, price } 
                  })}
                />

                <DateTimeSelector
                  selectedDate={bookingState.selectedDate}
                  selectedSlot={bookingState.selectedSlot}
                  bookedSlots={bookedSlots}
                  isDateUnavailable={isDateUnavailable}
                  unavailableDates={unavailableDates}
                  onDateChange={(date) => dispatch({ type: 'SET_DATE', payload: date })}
                  onSlotChange={(slot) => dispatch({ type: 'SET_SLOT', payload: slot })}
                />

                <ButtonGroup>
                  <CancelButton
                    type="button"
                    onClick={() => router.push("/userdashboard")}
                  >
                    Cancel
                  </CancelButton>
                  <NextButton type="submit" disabled={!isFormValid || isProcessing}>
                    {isProcessing ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Processing...
                      </>
                    ) : (
                      <>
                        Proceed to Payment
                        {bookingState.selectedPrice > 0 && (
                          <span> - ₱{bookingState.selectedPrice.toLocaleString()}</span>
                        )}
                      </>
                    )}
                  </NextButton>
                </ButtonGroup>
              </InnerContent>
            </FormBox>
          ) : (
            <PaymentSelectionContainer>
              <PaymentMethodSelector
                selectedMethod={bookingState.selectedPaymentMethod}
                onMethodChange={(method) => dispatch({ type: 'SET_PAYMENT_METHOD', payload: method })}
              />
              
              <ButtonGroup>
                <CancelButton
                  type="button"
                  onClick={() => setShowPaymentMethods(false)}
                >
                  Back
                </CancelButton>
                <NextButton 
                  type="button" 
                  onClick={() => handlePaymentSelection(bookingState.selectedPaymentMethod)}
                  disabled={isProcessing || !bookingState.selectedSlot}
                >
                  {isProcessing ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Processing...
                    </>
                  ) : (
                    `Pay with ${bookingState.selectedPaymentMethod}`
                  )}
                </NextButton>
              </ButtonGroup>
            </PaymentSelectionContainer>
          )}
        </Card>
      </Wrapper>
    </>
  );
};

export default AppointmentPage;

// 🔹 Styled Components (same as before - no changes needed)
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

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`;

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
  animation: ${fadeIn} 0.6s ease-out;
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

const PaymentSelectionContainer = styled.div`
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
  color: #2c3e50;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SectionIcon = styled.span`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #34B89C;
`;

const PetSelect = styled.select`
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.2s ease;
  background-color: white;
  
  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.2);
  }
  
  &:disabled {
    background-color: #f5f5f5;
    color: #999;
  }
`;

const NoPetsWarning = styled.div`
  background-color: #fff3cd;
  color: #856404;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
  margin-top: 8px;
`;

const AppointmentTypeContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 8px;
`;

const AppointmentTypeButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #34B89C;
    transform: translateY(-2px);
  }
  
  &.selected {
    border-color: #34B89C;
    background-color: rgba(52, 184, 156, 0.1);
    box-shadow: 0 4px 12px rgba(52, 184, 156, 0.2);
  }
`;

const TypeLabel = styled.span`
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
`;

const TypePrice = styled.span`
  color: #34B89C;
  font-weight: 700;
`;

const PriceDisplay = styled.span`
  margin-left: auto;
  font-weight: 700;
  color: #34B89C;
  font-size: 18px;
`;

const DateInput = styled.input`
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.2);
  }
`;

const UnavailableWarning = styled.div`
  background-color: #fff3cd;
  color: #856404;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
  margin-top: 8px;
`;

const UnavailableDatesInfo = styled.div`
  background-color: #e7f4ff;
  color: #0c5460;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 8px;
`;

const SlotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-top: 8px;
`;

const SlotButton = styled.button`
  padding: 12px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  font-size: 14px;
  
  &:hover:not(:disabled) {
    border-color: #34B89C;
  }
  
  &.selected {
    border-color: #34B89C;
    background-color: rgba(52, 184, 156, 0.1);
    font-weight: 600;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const TakenIndicator = styled.span`
  display: block;
  font-size: 10px;
  color: #e74c3c;
  margin-top: 4px;
  font-weight: 600;
`;

const PaymentMethodContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
`;

const PaymentMethodButton = styled.button`
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    border-color: #34B89C;
    transform: translateY(-2px);
  }
  
  &.selected {
    border-color: #34B89C;
    background-color: rgba(52, 184, 156, 0.1);
    box-shadow: 0 4px 12px rgba(52, 184, 156, 0.2);
  }
`;

const PaymentMethodIcon = styled.span`
  font-size: 24px;
  margin-right: 12px;
  width: 40px;
  text-align: center;
`;

const PaymentMethodDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

const PaymentMethodLabel = styled.span`
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
`;

const PaymentMethodDescription = styled.span`
  color: #7f8c8d;
  font-size: 14px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CancelButton = styled.button`
  padding: 14px 24px;
  border: 2px solid #e74c3c;
  border-radius: 12px;
  background: white;
  color: #e74c3c;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  
  &:hover {
    background-color: #ffeaea;
  }
`;

const NextButton = styled.button`
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 2;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52, 184, 156, 0.4);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

// 🔹 UPDATED: Receipt Screen Styled Components - Clean Design
const ReceiptContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px;
  animation: ${fadeIn} 0.8s ease-out;
  
  @media (max-width: 768px) {
    padding: 24px 20px;
  }
`;

const ReceiptHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px solid #f0f0f0;
`;

const SuccessIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  animation: ${pulse} 2s infinite;
  
  @media (max-width: 768px) {
    font-size: 48px;
  }
`;

const ReceiptTitleMain = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: #27AE60;
  margin: 0 0 8px 0;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const ReceiptSubtitleMain = styled.p`
  font-size: 16px;
  color: #7f8c8d;
  margin: 0;
  font-weight: 500;
`;

const ReceiptContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;
`;

const ReceiptCard = styled.div`
  background: #f8f9fa;
  padding: 24px;
  border-radius: 16px;
  border-left: 4px solid #34B89C;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const CardTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
`;

const StatusBadge = styled.span`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  
  &.success {
    background-color: #d4edda;
    color: #155724;
  }
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
`;

const DetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DetailLabel = styled.span`
  font-size: 14px;
  color: #7f8c8d;
  font-weight: 500;
`;

const DetailValue = styled.span`
  font-size: 16px;
  color: #2c3e50;
  font-weight: 600;
  
  &.price {
    color: #34B89C;
    font-size: 18px;
  }
`;

const InfoBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: #e3f2fd;
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid #2196f3;
`;

const InfoIcon = styled.div`
  font-size: 24px;
  margin-top: 4px;
`;

const InfoContent = styled.div`
  flex: 1;
`;

const InfoTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: #1565c0;
  margin: 0 0 12px 0;
`;

const InfoList = styled.ul`
  margin: 0;
  padding-left: 16px;
`;

const InfoItem = styled.li`
  font-size: 14px;
  color: #37474f;
  margin-bottom: 8px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ReceiptActions = styled.div`
  display: flex;
  gap: 12px;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const ReceiptButton = styled.button`
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  font-size: 16px;
  
  &.primary {
    background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
    color: white;
    
    &:hover {
      opacity: 0.9;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(52, 184, 156, 0.4);
    }
  }
  
  &.secondary {
    background: #f8f9fa;
    color: #6c757d;
    border: 2px solid #dee2e6;
    
    &:hover {
      background: #e9ecef;
      border-color: #6c757d;
    }
  }
`;

const PrintIcon = styled.span`
  font-size: 16px;
`;

// 🔹 UPDATED: Printable Receipt Styled Components
const PrintOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
`;

const PrintContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: ${fadeIn} 0.3s ease-out;
`;

const PrintHeader = styled.div`
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
`;

const ClinicNamePrint = styled.h1`
  font-size: 24px;
  font-weight: bold;
  color: #34B89C;
  margin: 0 0 8px 0;
`;

const ReceiptTitlePrint = styled.h2`
  font-size: 18px;
  font-weight: bold;
  margin: 8px 0;
  color: #2c3e50;
`;

const ReceiptSubtitlePrint = styled.p`
  color: #27AE60;
  font-weight: 600;
  margin: 0;
`;

const PrintSection = styled.div`
  margin-bottom: 20px;
`;

const SectionTitlePrint = styled.h3`
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 12px;
  font-size: 16px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px;
`;

const PrintItem = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const ItemLabel = styled.span`
  color: #666;
`;

const ItemValue = styled.span`
  font-weight: 600;
  
  &.success {
    color: #27AE60;
  }
`;

const PrintTotal = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 18px;
  font-weight: bold;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 2px solid #34B89C;
`;

const TotalLabel = styled.span`
  color: #2c3e50;
`;

const TotalValue = styled.span`
  color: #34B89C;
`;

const ThankYouPrint = styled.div`
  text-align: center;
  font-weight: bold;
  margin: 16px 0;
  color: #34B89C;
  font-size: 16px;
`;

const ClinicInfoPrint = styled.div`
  text-align: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
`;

const ClinicNameSmall = styled.div`
  font-weight: bold;
  margin-bottom: 4px;
`;

const ClinicAddress = styled.div`
  margin-bottom: 4px;
`;

const ClinicContact = styled.div`
  margin-bottom: 8px;
`;

const ClinicNote = styled.div`
  font-style: italic;
`;

const PrintActions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const PrintButton = styled.button`
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  background: #34B89C;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background: #2ca189;
    transform: translateY(-1px);
  }
`;

const CloseButton = styled.button`
  padding: 12px 20px;
  border: 2px solid #e74c3c;
  border-radius: 8px;
  background: white;
  color: #e74c3c;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  
  &:hover {
    background: #ffeaea;
  }
`;