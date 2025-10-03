'use client';

import React, { useEffect, useState, useCallback, useMemo, useReducer } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { 
  collection, 
  getDocs, 
  addDoc, 
  DocumentData, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc
} from "firebase/firestore";

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

// 🔹 Custom Hook for Appointment Data
const useAppointmentData = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Appointment[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<Unavailable[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [petsSnapshot, appointmentsSnapshot, unavailableSnapshot, doctorsSnapshot] = 
          await Promise.all([
            getDocs(collection(db, "pets")),
            getDocs(collection(db, "appointments")),
            getDocs(collection(db, "unavailableSlots")),
            getDocs(query(collection(db, "users"), where("role", "==", "veterinarian")))
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

        // Process appointments
        const appointmentsData: Appointment[] = [];
        appointmentsSnapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          appointmentsData.push({
            id: doc.id,
            date: d.date,
            timeSlot: d.timeSlot,
            status: d.status,
            petId: d.petId,
            clientName: d.clientName || "",
            appointmentType: d.appointmentType || "",
            price: d.price || 0
          });
        });
        setBookedSlots(appointmentsData);

        // Process unavailable slots
        const unavailableData: Unavailable[] = [];
        unavailableSnapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          let dateValue = d.date;
          if (dateValue && dateValue.toDate) {
            dateValue = dateValue.toDate().toISOString().split('T')[0];
          }
          unavailableData.push({
            id: doc.id,
            date: dateValue,
            veterinarian: d.veterinarian,
            isAllDay: d.isAllDay,
            startTime: d.startTime,
            endTime: d.endTime
          });
        });
        setUnavailableSlots(unavailableData);

        // Process doctors
        const doctorsData: Doctor[] = [];
        doctorsSnapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          doctorsData.push({
            id: doc.id,
            name: d.name,
            email: d.email
          });
        });
        setDoctors(doctorsData);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    // Real-time listeners
    const unsubscribeUnavailable = onSnapshot(
      collection(db, "unavailableSlots"),
      (snapshot) => {
        const unavailableData: Unavailable[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          let dateValue = d.date;
          if (dateValue && dateValue.toDate) {
            dateValue = dateValue.toDate().toISOString().split('T')[0];
          }
          unavailableData.push({
            id: doc.id,
            date: dateValue,
            veterinarian: d.veterinarian,
            isAllDay: d.isAllDay,
            startTime: d.startTime,
            endTime: d.endTime
          });
        });
        setUnavailableSlots(unavailableData);
      }
    );

    const unsubscribeAppointments = onSnapshot(
      collection(db, "appointments"),
      (snapshot) => {
        const appointmentsData: Appointment[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data() as DocumentData;
          appointmentsData.push({
            id: doc.id,
            date: d.date,
            timeSlot: d.timeSlot,
            status: d.status,
            petId: d.petId,
            clientName: d.clientName || "",
            appointmentType: d.appointmentType || "",
            price: d.price || 0
          });
        });
        setBookedSlots(appointmentsData);
      }
    );

    return () => {
      unsubscribeUnavailable();
      unsubscribeAppointments();
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

// 🔹 NEW: Receipt Screen Component
const ReceiptScreen: React.FC<{
  appointment: Appointment;
  onViewReceipt: () => void;
  onGoToDashboard: () => void;
}> = ({ appointment, onViewReceipt, onGoToDashboard }) => {
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
        <ReceiptIcon>🧾</ReceiptIcon>
        <ReceiptTitle>Payment Receipt</ReceiptTitle>
        <ReceiptSubtitle>Transaction Successful</ReceiptSubtitle>
      </ReceiptHeader>

      <ReceiptDetails>
        <ReceiptSection>
          <ReceiptLabel>Appointment Details</ReceiptLabel>
          <ReceiptItem>
            <ReceiptItemLabel>Pet Name:</ReceiptItemLabel>
            <ReceiptItemValue>{appointment.petName}</ReceiptItemValue>
          </ReceiptItem>
          <ReceiptItem>
            <ReceiptItemLabel>Service:</ReceiptItemLabel>
            <ReceiptItemValue>{getAppointmentTypeLabel(appointment.appointmentType)}</ReceiptItemValue>
          </ReceiptItem>
          <ReceiptItem>
            <ReceiptItemLabel>Date:</ReceiptItemLabel>
            <ReceiptItemValue>{formatDate(appointment.date)}</ReceiptItemValue>
          </ReceiptItem>
          <ReceiptItem>
            <ReceiptItemLabel>Time:</ReceiptItemLabel>
            <ReceiptItemValue>{appointment.timeSlot}</ReceiptItemValue>
          </ReceiptItem>
        </ReceiptSection>

        <ReceiptSection>
          <ReceiptLabel>Payment Information</ReceiptLabel>
          <ReceiptItem>
            <ReceiptItemLabel>Payment Method:</ReceiptItemLabel>
            <ReceiptItemValue>{appointment.paymentMethod}</ReceiptItemValue>
          </ReceiptItem>
          <ReceiptItem>
            <ReceiptItemLabel>Status:</ReceiptItemLabel>
            <ReceiptItemValue className="success">{appointment.status}</ReceiptItemValue>
          </ReceiptItem>
          <ReceiptTotal>
            <ReceiptTotalLabel>Total Paid:</ReceiptTotalLabel>
            <ReceiptTotalValue>₱{appointment.price?.toLocaleString()}</ReceiptTotalValue>
          </ReceiptTotal>
        </ReceiptSection>

        <ReceiptSection>
          <ReceiptLabel>Clinic Information</ReceiptLabel>
          <ClinicInfo>
            <ClinicName>PetCare Veterinary Clinic</ClinicName>
            <ClinicDetails>Thank you for choosing our services!</ClinicDetails>
            <ClinicNote>Please arrive 10 minutes early for your appointment.</ClinicNote>
          </ClinicInfo>
        </ReceiptSection>
      </ReceiptDetails>

      <ReceiptActions>
        <ReceiptButton onClick={onViewReceipt} className="secondary">
          <PrintIcon>🖨️</PrintIcon>
          View Full Receipt
        </ReceiptButton>
        <ReceiptButton onClick={onGoToDashboard} className="primary">
          Go to Dashboard
        </ReceiptButton>
      </ReceiptActions>
    </ReceiptContainer>
  );
};

// 🔹 Payment Processing Function
const processPayment = async (
  appointmentId: string, 
  amount: number, 
  appointmentType: string, 
  petName: string, 
  paymentMethod: string
): Promise<boolean> => {
  try {
    if (paymentMethod === "Cash") {
      // For cash payments, just update the appointment status
      await updateDoc(doc(db, "appointments", appointmentId), {
        paymentMethod: "Cash",
        status: "Confirmed"
      });
      return false; // No redirect needed for cash payment
    }
    
    // For GCash payments, process through PayMongo
    const paymentMethodType = "gcash";
    
    // Convert price from PHP to centavos (multiply by 100)
    const amountInCentavos = amount * 100;
    
    const res = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInCentavos,
        description: `${appointmentType} for ${petName}`,
        payment_method_type: paymentMethodType,
        return_url: `${window.location.origin}/appointment?payment_success=true&appointment_id=${appointmentId}`,
        metadata: {
          appointmentId: appointmentId,
          petName: petName,
          appointmentType: appointmentType
        }
      })
    });

    const responseData = await res.json();

    if (!res.ok) {
      throw new Error(
        `Payment error: ${res.status} - ${responseData.error || 'Unknown error'}. ` +
        `${responseData.details ? JSON.stringify(responseData.details) : ''}`
      );
    }

    if (!responseData || Object.keys(responseData).length === 0) {
      throw new Error("Empty response received from server");
    }

    const checkoutUrl = responseData?.data?.attributes?.checkout_url;

    if (checkoutUrl) {
      if (responseData.data.id) {
        sessionStorage.setItem('paymentIntentId', responseData.data.id);
      }
      
      // Store success callback
      sessionStorage.setItem('appointmentId', appointmentId);
      
      // Redirect to payment gateway
      window.location.href = checkoutUrl;
      return true; // Redirecting
    } else {
      throw new Error("Failed to initialize online payment. No checkout URL received.");
    }
  } catch (err) {
    console.error("Payment error:", err);
    throw err;
  }
};

// 🔹 Main Appointment Page Component
const AppointmentPage: React.FC = () => {
  const router = useRouter();
  const { pets, bookedSlots, unavailableSlots, doctors, isLoading } = useAppointmentData();
  const { isDateUnavailable, getUnavailableDates } = useAvailability(unavailableSlots);
  
  // 🔹 Fix hydration mismatch by initializing date after mount
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
  const [completedAppointment, setCompletedAppointment] = useState<Appointment | null>(null);

  // 🔹 Fix hydration by setting client-side only values after mount
  useEffect(() => {
    setIsClient(true);
    const today = new Date().toISOString().split("T")[0];
    setCurrentDate(today);
    dispatch({ type: 'SET_DATE', payload: today });
  }, []);

  // 🔹 Check for payment success on component mount
  useEffect(() => {
    if (!isClient) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const appointmentId = urlParams.get('appointment_id');
    
    if (paymentSuccess === 'true' && appointmentId) {
      // Fetch the appointment details and show receipt instead of generic success
      const fetchAppointmentDetails = async () => {
        try {
          const appointmentDoc = await getDoc(doc(db, "appointments", appointmentId));
          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data();
            
            // Update appointment status to confirmed
            await updateDoc(doc(db, "appointments", appointmentId), {
              status: "Confirmed",
              paymentMethod: "GCash"
            });

            // Get pet name
            const petDoc = await getDoc(doc(db, "pets", appointmentData.petId));
            let petName = "Unknown Pet";
            if (petDoc.exists()) {
              petName = petDoc.data().petName;
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
          // Fallback to dashboard if error
          router.push("/userdashboard");
        }
      };

      fetchAppointmentDetails();
      
      // Clean URL
      window.history.replaceState({}, document.title, "/appointment");
    }
  }, [router, isClient]);

  // 🔹 FIXED: Set first pet as default when pets are loaded
  useEffect(() => {
    if (pets.length > 0 && !bookingState.selectedPet) {
      dispatch({ type: 'SET_PET', payload: pets[0].id });
    }
  }, [pets, bookingState.selectedPet]);

  // Send notification to doctors
  const sendNotificationToDoctor = useCallback(async (appointmentData: AppointmentNotificationData) => {
    try {
      const doctorNotifications = doctors.map(async (doctor) => {
        return addDoc(collection(db, "notifications"), {
          recipientId: doctor.id,
          recipientEmail: doctor.email,
          type: "new_appointment",
          title: "New Appointment Booked",
          message: `New appointment booked by ${appointmentData.clientName} for ${appointmentData.petName} on ${appointmentData.date} at ${appointmentData.timeSlot} - ₱${appointmentData.price}`,
          appointmentId: appointmentData.appointmentId,
          isRead: false,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(doctorNotifications);
      console.log("Notifications sent to all doctors");
    } catch (error) {
      console.error("Error sending notifications:", error);
    }
  }, [doctors]);

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

    // Show payment method selection instead of processing immediately
    setShowPaymentMethods(true);
  }, [bookingState, bookedSlots, isDateUnavailable]);

  const handlePaymentSelection = useCallback(async (paymentMethod: string) => {
    setIsProcessing(true);
    setShowPaymentMethods(false);
    
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate, selectedPrice } = bookingState;

    try {
      const selectedPetData = pets.find((p) => p.id === selectedPet);
      
      const appointmentData = {
        clientName: auth.currentUser?.email,
        petId: selectedPet,
        petName: selectedPetData?.name,
        date: selectedDate,
        timeSlot: selectedSlot,
        appointmentType: selectedAppointmentType,
        price: selectedPrice,
        status: paymentMethod === "Cash" ? "Confirmed" : "Pending Payment",
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp()
      };

      const newDoc = await addDoc(collection(db, "appointments"), appointmentData);

      // Update the appointment with its ID
      await updateDoc(doc(db, "appointments", newDoc.id), {
        id: newDoc.id
      });

      await sendNotificationToDoctor({
        ...appointmentData,
        appointmentId: newDoc.id
      });

      // Process payment based on selected method
      const isRedirecting = await processPayment(
        newDoc.id, 
        selectedPrice, 
        selectedAppointmentType, 
        selectedPetData?.name || "Pet",
        paymentMethod
      );

      if (paymentMethod === "Cash" || !isRedirecting) {
        alert("Appointment booked successfully! Please pay with cash when you arrive.");
        router.push("/userdashboard");
      }
      // For GCash, the processPayment function handles the redirect
      
    } catch (err) {
      console.error(err);
      alert("Failed to book appointment");
    } finally {
      setIsProcessing(false);
    }
  }, [bookingState, pets, sendNotificationToDoctor, router]);

  const unavailableDates = useMemo(() => getUnavailableDates(), [getUnavailableDates]);

  const isFormValid = useMemo(() => {
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate } = bookingState;
    return selectedPet && selectedSlot && selectedAppointmentType && 
           pets.length > 0 && !isDateUnavailable(selectedDate);
  }, [bookingState, pets.length, isDateUnavailable]);

  const handleViewReceipt = () => {
    // Here you could implement a print function or detailed receipt view
    window.print();
  };

  const handleGoToDashboard = () => {
    router.push("/userdashboard");
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

  if (showReceipt && completedAppointment) {
    return (
      <>
        <GlobalStyle />
        <Wrapper>
          <Card>
            <ReceiptScreen 
              appointment={completedAppointment} 
              onViewReceipt={handleViewReceipt}
              onGoToDashboard={handleGoToDashboard}
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
                  <Cancel
                    type="button"
                    onClick={() => router.push("/userdashboard")}
                  >
                    Cancel
                  </Cancel>
                  <Next type="submit" disabled={!isFormValid || isProcessing}>
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
                  </Next>
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
                <Cancel
                  type="button"
                  onClick={() => setShowPaymentMethods(false)}
                >
                  Back
                </Cancel>
                <Next 
                  type="button" 
                  onClick={() => handlePaymentSelection(bookingState.selectedPaymentMethod)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Processing...
                    </>
                  ) : (
                    `Pay with ${bookingState.selectedPaymentMethod}`
                  )}
                </Next>
              </ButtonGroup>
            </PaymentSelectionContainer>
          )}
        </Card>
      </Wrapper>
    </>
  );
};

export default AppointmentPage;

// 🔹 Styled Components
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

const Cancel = styled.button`
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

const Next = styled.button`
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

// 🔹 Receipt Screen Styled Components
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
  border-bottom: 2px solid #e0e0e0;
`;

const ReceiptIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  animation: ${pulse} 2s infinite;
  
  @media (max-width: 768px) {
    font-size: 48px;
  }
`;

const ReceiptTitle = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: #34B89C;
  margin: 0 0 8px 0;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const ReceiptSubtitle = styled.p`
  font-size: 16px;
  color: #27AE60;
  margin: 0;
  font-weight: 600;
`;

const ReceiptDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;
`;

const ReceiptSection = styled.div`
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid #34B89C;
`;

const ReceiptLabel = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ReceiptItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
  
  &:last-child {
    margin-bottom: 0;
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const ReceiptItemLabel = styled.span`
  color: #7f8c8d;
  font-weight: 500;
`;

const ReceiptItemValue = styled.span`
  color: #2c3e50;
  font-weight: 600;
  
  &.success {
    color: #27AE60;
  }
`;

const ReceiptTotal = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  margin-top: 12px;
  border-top: 2px solid #34B89C;
  background: white;
  border-radius: 8px;
  padding: 16px;
`;

const ReceiptTotalLabel = styled.span`
  font-size: 18px;
  font-weight: 700;
  color: #2c3e50;
`;

const ReceiptTotalValue = styled.span`
  font-size: 20px;
  font-weight: 700;
  color: #34B89C;
`;

const ClinicInfo = styled.div`
  text-align: center;
`;

const ClinicName = styled.h4`
  font-size: 20px;
  font-weight: 700;
  color: #34B89C;
  margin: 0 0 8px 0;
`;

const ClinicDetails = styled.p`
  font-size: 14px;
  color: #7f8c8d;
  margin: 0 0 8px 0;
`;

const ClinicNote = styled.p`
  font-size: 12px;
  color: #95a5a6;
  margin: 0;
  font-style: italic;
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
  
  &.primary {
    border: none;
    background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
    color: white;
    
    &:hover {
      opacity: 0.9;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(52, 184, 156, 0.4);
    }
  }
  
  &.secondary {
    border: 2px solid #34B89C;
    background: white;
    color: #34B89C;
    
    &:hover {
      background: #f0f8ff;
      transform: translateY(-2px);
    }
  }
`;

const PrintIcon = styled.span`
  font-size: 16px;
`;