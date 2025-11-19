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
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

// 🔹 Enhanced Types with Pricing
interface Pet {
  id: string;
  name: string;
  petType: string;
  breed: string;
  gender: string;
  color: string;
  birthday?: string;
  age?: string;
}

interface Appointment {
  id?: string;
  date: string;
  timeSlot: string;
  status: string;
  petId: string;
  petName?: string;
  petType?: string;
  breed?: string;
  gender?: string;
  color?: string;
  birthday?: string;
  age?: string;
  clientName: string;
  appointmentType: string;
  price?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  createdAt?: unknown;
}

interface UnavailableSlot {
  id: string;
  date: string;
  veterinarian: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  leaveDays?: number;
  endDate?: string;
  isMultipleDays?: boolean;
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

// 🔹 FIXED: Enhanced Appointment Creation with Complete Data - SAVES TO APPOINTMENTS COLLECTION
const createAppointmentInFirestore = async (
  bookingState: BookingState,
  paymentMethod: string,
  user: User,
  selectedPetData: Pet
): Promise<string> => {
  try {
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate, selectedPrice } = bookingState;

    if (!selectedPet || !selectedSlot || !selectedAppointmentType || !selectedDate) {
      throw new Error("Missing required appointment data");
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // ✅ CRITICAL: Create appointment data with EXACT field names
    const appointmentData = {
      // Required fields for security rules
      userId: user.uid,
      petId: selectedPet,
      date: selectedDate,
      timeSlot: selectedSlot,
      appointmentType: selectedAppointmentType,
      status: paymentMethod === "Cash" ? "Confirmed" : "Pending Payment",
      
      // Additional pet information
      clientName: user.displayName || user.email?.split('@')[0] || "Client",
      clientEmail: user.email || "",
      petName: selectedPetData.name,
      petType: selectedPetData.petType || "Unknown",
      breed: selectedPetData.breed || "Unknown",
      gender: selectedPetData.gender || "Unknown",
      color: selectedPetData.color || "Unknown",
      birthday: selectedPetData.birthday || "",
      age: selectedPetData.age || "",
      price: selectedPrice || 0,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === "Cash" ? "Complete Payment" : "Pending Payment",
      referenceNumber: "",
      
      // System fields
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      bookedBy: user.uid
    };

    console.log("💾 Creating appointment with user ID:", user.uid);
    console.log("📋 Appointment data:", {
      userId: appointmentData.userId,
      petId: appointmentData.petId,
      date: appointmentData.date,
      timeSlot: appointmentData.timeSlot,
      appointmentType: appointmentData.appointmentType,
      status: appointmentData.status
    });

    // ✅ Create the appointment document
    const appointmentsRef = collection(db, "appointments");
    const newDoc = await addDoc(appointmentsRef, appointmentData);

    console.log("✅ Appointment successfully created with ID:", newDoc.id);
    
    return newDoc.id;

  } catch (error) {
    console.error("❌ Error creating appointment in Firestore:", error);
    throw new Error(`Failed to create appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// 🔹 FIXED: Enhanced Payment Processing with proper types
const processAppointmentPayment = async (
  appointmentId: string,
  paymentMethod: string,
  amount: number,
  referenceNumber?: string
): Promise<void> => {
  try {
    const appointmentRef = doc(db, "appointments", appointmentId);
    
    const updateData: {
      updatedAt: unknown;
      status?: string;
      paymentStatus?: string;
      referenceNumber?: string;
    } = {
      updatedAt: serverTimestamp()
    };

    if (paymentMethod === "Cash") {
      updateData.status = "Confirmed";
      updateData.paymentStatus = "Complete Payment";
    } else if (paymentMethod === "GCash") {
      updateData.status = "Pending Confirmation";
      updateData.paymentStatus = "Pending Verification";
      if (referenceNumber) {
        updateData.referenceNumber = referenceNumber;
      }
    }

    await updateDoc(appointmentRef, updateData);
    console.log(`✅ ${paymentMethod} payment processed for appointment:`, appointmentId);
    
  } catch (error) {
    console.error("❌ Error processing payment:", error);
    throw new Error(`Payment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// 🔹 Helper: Send notifications to doctors
const sendDoctorNotifications = async (
  appointmentId: string,
  user: User,
  petData: Pet,
  date: string,
  timeSlot: string,
  price: number,
  doctors: Doctor[]
): Promise<void> => {
  try {
    const doctorNotifications = doctors.map(async (doctor) => {
      return addDoc(collection(db, "notifications"), {
        recipientId: doctor.id,
        recipientEmail: doctor.email,
        type: "new_appointment",
        title: "New Appointment Booked",
        message: `New appointment booked by ${user.email} for ${petData.name} (${petData.breed}) on ${date} at ${timeSlot} - ₱${price}`,
        appointmentId: appointmentId,
        isRead: false,
        createdAt: serverTimestamp()
      });
    });

    await Promise.all(doctorNotifications);
    console.log("✅ Notifications sent to doctors");
  } catch (notifError) {
    console.error("❌ Notification error (non-critical):", notifError);
    // Don't throw error for notification failures
  }
};

// 🔹 Helper: Get appointment details from Firestore
const getAppointmentDetails = async (appointmentId: string): Promise<Appointment> => {
  const appointmentDoc = await getDoc(doc(db, "appointments", appointmentId));
  if (!appointmentDoc.exists()) {
    throw new Error("Appointment not found");
  }
  
  const data = appointmentDoc.data();
  return {
    id: appointmentId,
    date: data.date,
    timeSlot: data.timeSlot,
    status: data.status,
    petId: data.petId,
    petName: data.petName,
    petType: data.petType,
    breed: data.breed,
    gender: data.gender,
    color: data.color,
    birthday: data.birthday,
    age: data.age,
    clientName: data.clientName,
    appointmentType: data.appointmentType,
    price: data.price,
    paymentMethod: data.paymentMethod,
    referenceNumber: data.referenceNumber,
    createdAt: data.createdAt
  };
};

// 🔹 Utility function to format date
const formatBirthday = (birthday: string) => {
  if (!birthday) return "Not specified";
  return new Date(birthday).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// 🔹 FIXED: Custom Hook for Appointment Data with Enhanced Pet Info
const useAppointmentData = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Appointment[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      let unsubscribePets: () => void;
      let unsubscribeAppointments: () => void;
      let unsubscribeUnavailable: () => void;

      const fetchData = async (user: User) => {
        setIsLoading(true);
        try {
          if (!user) {
            setIsLoading(false);
            return;
          }

          // ✅ FIXED: Query pets collection with enhanced data
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
                name: petName,
                petType: petData.petType || "Unknown",
                breed: petData.petBreed || petData.breed || "Mixed Breed",
                gender: petData.gender || "Unknown",
                color: petData.color || "Unknown",
                birthday: petData.birthday,
                age: petData.age
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

      if (user) {
        fetchData(user);
        
        // Set up real-time listeners with correct query
        try {
          // ✅ FIXED: Real-time pets listener with enhanced data
          const petsQuery = query(
            collection(db, "pets"), 
            where("ownerId", "==", user.uid)
          );
          
          unsubscribePets = onSnapshot(petsQuery, 
            (snapshot) => {
              console.log("🔄 Real-time pets update, count:", snapshot.size);
              const userPets: Pet[] = [];
              snapshot.forEach((doc) => {
                const petData = doc.data();
                const petName = petData.petName || petData.name || "Unnamed Pet";
                userPets.push({ 
                  id: doc.id, 
                  name: petName,
                  petType: petData.petType || "Unknown",
                  breed: petData.petBreed || petData.breed || "Mixed Breed",
                  gender: petData.gender || "Unknown",
                  color: petData.color || "Unknown",
                  birthday: petData.birthday,
                  age: petData.age
                });
              });
              console.log("✅ Updated pets:", userPets);
              setPets(userPets);
            },
            (error) => {
              console.error("❌ Pets listener error:", error);
            }
          );

          // ✅ FIXED: Real-time appointments listener - watches appointments collection
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
              console.log("🔄 Real-time appointments update, count:", appointmentsData.length);
              setBookedSlots(appointmentsData);
            },
            (error) => {
              console.error("❌ Appointments listener error:", error);
            }
          );

          // Unavailable slots listener
          unsubscribeUnavailable = onSnapshot(collection(db, "unavailableSlots"), 
            (snapshot) => {
              const unavailableData: UnavailableSlot[] = [];
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
                  endTime: data.endTime,
                  reason: data.reason,
                  leaveDays: data.leaveDays,
                  endDate: data.endDate,
                  isMultipleDays: data.isMultipleDays
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
        console.log("👤 No user logged in");
        setPets([]);
        setBookedSlots([]);
        setUnavailableSlots([]);
        setIsLoading(false);
      }

      return () => {
        if (unsubscribePets) unsubscribePets();
        if (unsubscribeAppointments) unsubscribeAppointments();
        if (unsubscribeUnavailable) unsubscribeUnavailable();
      };
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  return { pets, bookedSlots, unavailableSlots, doctors, isLoading };
};

// 🔹 FIXED: Custom Hook for Availability Logic - Proper Date Comparison
const useAvailability = (unavailableSlots: UnavailableSlot[]) => {
  const isDateUnavailable = useCallback((date: string) => {
    return unavailableSlots.some(slot => {
      // Convert both dates to same format for comparison
      const slotDate = new Date(slot.date);
      const selectedDate = new Date(date);
      
      // Compare year, month, and day only
      return slotDate.getFullYear() === selectedDate.getFullYear() &&
             slotDate.getMonth() === selectedDate.getMonth() &&
             slotDate.getDate() === selectedDate.getDate();
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

// 🔹 Enhanced Pet Selector Component with Complete Pet Details
const PetSelector: React.FC<{
  pets: Pet[];
  selectedPet: string | null;
  onPetChange: (petId: string) => void;
}> = ({ pets, selectedPet, onPetChange }) => {
  const selectedPetData = pets.find(pet => pet.id === selectedPet);

  return (
    <FormSection>
      <SectionTitle>
        <SectionIcon>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 016.775-5.025.75.75 0 01.313 1.248l-3.32 3.319c.063.475.276.934.627 1.33.35.389.820.729 1.382.963.56.235 1.217.389 1.925.389a.75.75 0 010 1.5c-.898 0-1.7-.192-2.375-.509A5.221 5.221 0 0115.75 8.25c0-.65-.126-1.275-.356-1.85l-2.57 2.57a.75.75 0 01-1.06 0l-3-3a.75.75 0 010-1.06l2.57-2.57a5.25 5.25 0 00-1.834 2.606A5.25 5.25 0 0112 6.75z" clipRule="evenodd" />
          </svg>
        </SectionIcon>
        Select Your Pet
        <PetsCount>({pets.length} pets found)</PetsCount>
      </SectionTitle>
      
      <PetSelect
        value={selectedPet || ""}
        onChange={(e) => {
          console.log("🔄 Pet changed to:", e.target.value);
          onPetChange(e.target.value);
        }}
        disabled={pets.length === 0}
      >
        <option value="">Select a pet</option>
        {pets.length === 0 ? (
          <option value="" disabled>No pets found. Please register a pet first.</option>
        ) : (
          pets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} - {p.breed} ({p.petType})
            </option>
          ))
        )}
      </PetSelect>
      
      {/* Pet Details Display */}
      {selectedPetData && (
        <PetDetailsCard>
          <PetDetailTitle>Pet Information</PetDetailTitle>
          <PetDetailsGrid>
            <PetDetailItem>
              <PetDetailLabel>Name:</PetDetailLabel>
              <PetDetailValue>{selectedPetData.name}</PetDetailValue>
            </PetDetailItem>
            <PetDetailItem>
              <PetDetailLabel>Type:</PetDetailLabel>
              <PetDetailValue>{selectedPetData.petType}</PetDetailValue>
            </PetDetailItem>
            <PetDetailItem>
              <PetDetailLabel>Breed:</PetDetailLabel>
              <PetDetailValue>{selectedPetData.breed}</PetDetailValue>
            </PetDetailItem>
            <PetDetailItem>
              <PetDetailLabel>Gender:</PetDetailLabel>
              <PetDetailValue>{selectedPetData.gender}</PetDetailValue>
            </PetDetailItem>
            <PetDetailItem>
              <PetDetailLabel>Color:</PetDetailLabel>
              <PetDetailValue>{selectedPetData.color}</PetDetailValue>
            </PetDetailItem>
            <PetDetailItem>
              <PetDetailLabel>Birthday:</PetDetailLabel>
              <PetDetailValue>{selectedPetData.birthday ? formatBirthday(selectedPetData.birthday) : "Not specified"}</PetDetailValue>
            </PetDetailItem>
            {selectedPetData.age && (
              <PetDetailItem>
                <PetDetailLabel>Age:</PetDetailLabel>
                <PetDetailValue>{selectedPetData.age}</PetDetailValue>
              </PetDetailItem>
            )}
          </PetDetailsGrid>
        </PetDetailsCard>
      )}
      
      {pets.length === 0 && (
        <NoPetsWarning>
          ⚠️ No pets found. Please register your pet first before booking an appointment.
        </NoPetsWarning>
      )}
    </FormSection>
  );
};

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

// 🔹 Date Time Selector Component with Enhanced Unavailable Dates
const DateTimeSelector: React.FC<{
  selectedDate: string;
  selectedSlot: string | null;
  bookedSlots: Appointment[];
  isDateUnavailable: (date: string) => boolean;
  unavailableDates: string[];
  unavailableSlots: UnavailableSlot[];
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string) => void;
  onViewUnavailableDetails: (slot: UnavailableSlot) => void;
}> = ({ 
  selectedDate, 
  selectedSlot, 
  bookedSlots, 
  isDateUnavailable, 
  unavailableDates,
  unavailableSlots,
  onDateChange, 
  onSlotChange,
  onViewUnavailableDetails
}) => {
  // Function to get unavailable reason for selected date
  const getUnavailableReason = (date: string) => {
    const slot = unavailableSlots.find(s => s.date === date);
    return slot?.reason || "No reason provided";
  };

  // Function to get veterinarian name for selected date
  const getUnavailableVeterinarian = (date: string) => {
    const slot = unavailableSlots.find(s => s.date === date);
    return slot?.veterinarian || "Veterinarian";
  };

  return (
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
        
        {/* Enhanced Unavailable Warning with Reason */}
        {isDateUnavailable(selectedDate) && (
          <UnavailableWarningWithReason>
            <WarningHeader>
              <WarningIcon>⚠️</WarningIcon>
              <WarningTitle>This date is unavailable</WarningTitle>
            </WarningHeader>
            <WarningDetails>
              <VeterinarianInfo>
                <strong>Veterinarian:</strong> {getUnavailableVeterinarian(selectedDate)}
              </VeterinarianInfo>
              <ReasonInfo>
                <strong>Reason:</strong> {getUnavailableReason(selectedDate)}
              </ReasonInfo>
            </WarningDetails>
            <ViewDetailsButton 
              onClick={() => {
                const slot = unavailableSlots.find(s => s.date === selectedDate);
                if (slot) onViewUnavailableDetails(slot);
              }}
            >
              📋 View Full Details
            </ViewDetailsButton>
          </UnavailableWarningWithReason>
        )}
        
        {unavailableDates.length > 0 && (
          <UnavailableDatesInfo>
            <strong>Upcoming Unavailable Dates:</strong> 
            <UnavailableDatesList>
{unavailableDates.slice(0, 5).map((date) => {
  const slot = unavailableSlots.find(s => s.date === date);
  return (
    <UnavailableDateItem 
      key={date} 
      onClick={() => {
        const slot = unavailableSlots.find(s => s.date === date);
        if (slot) onViewUnavailableDetails(slot);
      }}
    >
                    <DateText>{date}</DateText>
                    {slot?.reason && (
                      <ReasonText title={slot.reason}>
                        {slot.reason.length > 30 ? slot.reason.substring(0, 30) + '...' : slot.reason}
                      </ReasonText>
                    )}
                  </UnavailableDateItem>
                );
              })}
              {unavailableDates.length > 5 && (
                <MoreDatesText>
                  and {unavailableDates.length - 5} more unavailable dates...
                </MoreDatesText>
              )}
            </UnavailableDatesList>
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
};

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

// 🔹 Unavailable Details Modal Component
const UnavailableDetailsModal: React.FC<{
  slot: UnavailableSlot | null;
  onClose: () => void;
}> = ({ slot, onClose }) => {
  if (!slot) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (startTime?: string, endTime?: string, isAllDay?: boolean) => {
    if (isAllDay) return "All Day";
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    return "Not specified";
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
        <ModalHeader>
          <ModalTitle>Unavailable Date Details</ModalTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        
        <DetailsContent>
          <DetailSection>
            <DetailSectionTitle>Unavailability Information</DetailSectionTitle>
            
            <DetailItem>
              <DetailLabelLarge>Veterinarian:</DetailLabelLarge>
              <DetailValueLarge>{slot.veterinarian}</DetailValueLarge>
            </DetailItem>

            <DetailItem>
              <DetailLabelLarge>Date:</DetailLabelLarge>
              <DetailValueLarge>{formatDate(slot.date)}</DetailValueLarge>
            </DetailItem>

            {slot.endDate && slot.isMultipleDays && (
              <DetailItem>
                <DetailLabelLarge>End Date:</DetailLabelLarge>
                <DetailValueLarge>{formatDate(slot.endDate)}</DetailValueLarge>
              </DetailItem>
            )}

            {slot.leaveDays && slot.leaveDays > 1 && (
              <DetailItem>
                <DetailLabelLarge>Duration:</DetailLabelLarge>
                <DetailValueLarge>{slot.leaveDays} days</DetailValueLarge>
              </DetailItem>
            )}

            <DetailItem>
              <DetailLabelLarge>Time:</DetailLabelLarge>
              <DetailValueLarge>
                {formatTime(slot.startTime, slot.endTime, slot.isAllDay)}
              </DetailValueLarge>
            </DetailItem>

            <DetailItem>
              <DetailLabelLarge>Status:</DetailLabelLarge>
              <DetailValueLarge>
                <span style={{
                  color: '#e74c3c',
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }}>
                  UNAVAILABLE
                </span>
              </DetailValueLarge>
            </DetailItem>

            {slot.reason && (
              <DetailItem style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <DetailLabelLarge style={{ marginBottom: '0.5rem' }}>Reason:</DetailLabelLarge>
                <div style={{
                  background: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                  width: '100%'
                }}>
                  <DetailValueLarge style={{ 
                    fontStyle: 'italic', 
                    lineHeight: '1.5',
                    color: '#2c3e50'
                  }}>
                    {slot.reason}
                  </DetailValueLarge>
                </div>
              </DetailItem>
            )}
          </DetailSection>

          <AppointmentActions>
            <ActionButton
              $variant="primary"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Close
            </ActionButton>
          </AppointmentActions>
        </DetailsContent>
      </ModalContent>
    </ModalOverlay>
  );
};

// 🔹 FIXED: Enhanced GCash Payment Modal with Better Error Handling
const GCashPaymentModal: React.FC<{
  amount: number;
  appointmentType: string;
  petName: string;
  onSuccess: () => void;
  onCancel: (appointmentId: string) => void;
  appointmentId: string;
}> = ({ amount, appointmentType, petName, onSuccess, onCancel, appointmentId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceInput, setReferenceInput] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // 🔹 FIXED: Enhanced reference submission
  const handleSubmitReference = async () => {
    if (!referenceInput.trim()) {
      setError("Please enter your GCash reference number");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log("📝 Submitting reference number:", referenceInput);
      
      const appointmentRef = doc(db, "appointments", appointmentId);
      
      // Verify appointment exists
      const appointmentSnap = await getDoc(appointmentRef);
      if (!appointmentSnap.exists()) {
        throw new Error("Appointment not found");
      }
      
      // Update with reference number
      await updateDoc(appointmentRef, {
        referenceNumber: referenceInput.trim(),
        paymentStatus: "Pending Verification",
        status: "Pending Confirmation",
        updatedAt: serverTimestamp()
      });

      console.log("✅ Reference number submitted successfully");
      
      // Small delay to ensure Firestore update completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      alert("✅ Reference number submitted! Your appointment is pending verification.");
      onSuccess();
      
    } catch (err) {
      console.error("❌ Error submitting reference:", err);
      
      if (err instanceof Error) {
        if (err.message.includes('permission')) {
          setError("Permission denied. Please refresh and try again.");
        } else if (err.message.includes('not found')) {
          setError("Appointment not found. It may have been cancelled.");
        } else {
          setError(`Failed to submit: ${err.message}`);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔹 FIXED: Simple and direct cancel logic
  const handleCancelPayment = async () => {
    // Prevent double-clicking
    if (isCancelling || isProcessing) {
      console.log("⏸️ Already processing, please wait...");
      return;
    }

    const userConfirmed = confirm("Are you sure you want to cancel this appointment?");
    if (!userConfirmed) {
      console.log("❌ User cancelled the cancellation");
      return;
    }
    
    console.log("🗑️ Starting cancellation for appointment:", appointmentId);
    setIsCancelling(true);
    setError(null);

    try {
      const appointmentRef = doc(db, "appointments", appointmentId);
      
      // Try to delete immediately
      await deleteDoc(appointmentRef);
      console.log("✅ Appointment deleted successfully");
      
      // Close modal immediately
      onCancel(appointmentId);
      
    } catch (error) {
      console.error("❌ Error deleting appointment:", error);
      
      // If delete fails, try to mark as cancelled
      try {
        const appointmentRef = doc(db, "appointments", appointmentId);
        await updateDoc(appointmentRef, {
          status: "Cancelled",
          paymentStatus: "Cancelled",
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log("✅ Appointment marked as cancelled");
        onCancel(appointmentId);
        
      } catch (updateError) {
        console.error("❌ Failed to cancel:", updateError);
        setError("Failed to cancel appointment. Please try again.");
        setIsCancelling(false);
      }
    }
  };

  // Copy amount function
  const copyAmount = () => {
    navigator.clipboard.writeText(amount.toString())
      .then(() => {
        alert(`Amount ₱${amount.toLocaleString()} copied to clipboard!`);
      })
      .catch(() => {
        alert(`Amount: ₱${amount.toLocaleString()}`);
      });
  };

  return (
    <PaymentModalOverlay onClick={(e) => {
      // Prevent closing modal when clicking overlay during processing
      if (isProcessing || isCancelling) {
        e.stopPropagation();
      }
    }}>
      <PaymentModal className="large-modal" onClick={(e) => e.stopPropagation()}>
        <PaymentModalHeader>
          <PaymentModalTitle>📱 GCash Payment</PaymentModalTitle>
          <CloseModalButton 
            onClick={handleCancelPayment}
            disabled={isProcessing || isCancelling}
          >
            ×
          </CloseModalButton>
        </PaymentModalHeader>
        
        <PaymentModalContent>
          <PaymentSummary>
            <SummaryTitle>Payment Summary</SummaryTitle>
            <SummaryGrid>
              <SummaryItem>
                <SummaryLabel>Service:</SummaryLabel>
                <SummaryValue>{appointmentType}</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel>Pet:</SummaryLabel>
                <SummaryValue>{petName}</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel>Amount:</SummaryLabel>
                <SummaryValue className="amount">
                  ₱{amount.toLocaleString()}
                  <CopyButton onClick={copyAmount} title="Copy amount">
                    📋
                  </CopyButton>
                </SummaryValue>
              </SummaryItem>
            </SummaryGrid>
          </PaymentSummary>

          <QRCodeSection>
            <QRCodeTitle>Scan this QR Code with GCash</QRCodeTitle>
            <QRCodeNote>
              Amount: <strong>₱{amount.toLocaleString()}</strong>
            </QRCodeNote>
            <QRCodeContainer>
              <QRCodeWrapper>
                <QRCodeImage 
                  src="/RL-QR.png"
                  alt="GCash QR Code" 
                  onError={(e) => {
                    console.error("❌ Failed to load QR image");
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </QRCodeWrapper>
            </QRCodeContainer>
          </QRCodeSection>

          <ReferenceInputSection>
            <ReferenceInputTitle>Enter GCash Reference Number</ReferenceInputTitle>
            <ReferenceInputDescription>
              After completing the payment in GCash, please enter the reference number from your transaction:
            </ReferenceInputDescription>
            
            <ReferenceInputContainer>
              <ReferenceInputLabel>GCash Reference Number:</ReferenceInputLabel>
              <ReferenceInput
                type="text"
                placeholder="Enter reference number (e.g., 1234567890)"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                disabled={isProcessing || isCancelling}
              />
              <ReferenceInputHint>
                You can find this in your GCash transaction history
              </ReferenceInputHint>
            </ReferenceInputContainer>

            {error && (
              <PaymentError>
                ⚠️ {error}
              </PaymentError>
            )}
          </ReferenceInputSection>

          <PaymentModalActions>
            <CancelPaymentButton 
              onClick={handleCancelPayment} 
              disabled={isProcessing || isCancelling}
            >
              {isCancelling ? "Cancelling..." : "❌ Cancel Payment"}
            </CancelPaymentButton>
            <ConfirmPaymentButton 
              onClick={handleSubmitReference} 
              disabled={isProcessing || isCancelling || !referenceInput.trim()}
            >
              {isProcessing ? (
                <>
                  <Spinner />
                  Submitting...
                </>
              ) : (
                "✅ Submit Reference Number"
              )}
            </ConfirmPaymentButton>
          </PaymentModalActions>

          <PaymentNote>
            Your appointment will be confirmed once we verify your payment. 
            Please make sure to enter the correct reference number.
          </PaymentNote>
        </PaymentModalContent>
      </PaymentModal>
    </PaymentModalOverlay>
  );
};

// 🔹 Clean Printable Receipt Component with Logo and Complete Pet Details
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
            .logo-container {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 16px;
            }
            .clinic-logo {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
              text-align: center;
              margin: 0 auto;
            }
            .clinic-name {
              font-size: 24px;
              font-weight: bold;
              color: #34B89C;
              margin: 8px 0;
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
              <div class="logo-container">
                <div class="clinic-logo">FURSURECARE VETERINARY CLINIC</div>
              </div>
              <div class="clinic-name">FursureCare Veterinary Clinic</div>
              <div class="receipt-title">APPOINTMENT RECEIPT</div>
              <div class="receipt-subtitle">Payment Successful</div>
            </div>

            <div class="receipt-section">
              <div class="section-title">Pet Information</div>
              <div class="receipt-item">
                <span class="item-label">Pet Name:</span>
                <span class="item-value">${appointment.petName}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Pet Type:</span>
                <span class="item-value">${appointment.petType}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Breed:</span>
                <span class="item-value">${appointment.breed}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Gender:</span>
                <span class="item-value">${appointment.gender}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Color:</span>
                <span class="item-value">${appointment.color}</span>
              </div>
              <div class="receipt-item">
                <span class="item-label">Birthday:</span>
                <span class="item-value">${appointment.birthday ? formatBirthday(appointment.birthday) : "Not specified"}</span>
              </div>
              ${appointment.age ? `<div class="receipt-item">
                <span class="item-label">Age:</span>
                <span class="item-value">${appointment.age}</span>
              </div>` : ''}
            </div>

            <div class="receipt-section">
              <div class="section-title">Appointment Details</div>
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
              ${appointment.referenceNumber ? `<div class="receipt-item">
                <span class="item-label">Reference No:</span>
                <span class="item-value">${appointment.referenceNumber}</span>
              </div>` : ''}
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
              <div><strong>FursureCare Veterinary Clinic</strong></div>
              <div>168 Unit A Bus Stop JP Laurel Hiway cor. V Dimayuga st. Brgy. 4, Tanauan, Philippines</div>
              <div>Phone: 0906-484-1234 / 0916-621-5953</div>
              <div>Email: madulcedecahvez@gmail.com</div>
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
          <LogoContainer>
            <ClinicLogo>FURSURECARE VETERINARY CLINIC</ClinicLogo>
          </LogoContainer>
          <ClinicNamePrint>FursureCare Veterinary Clinic</ClinicNamePrint>
          <ReceiptTitlePrint>APPOINTMENT RECEIPT</ReceiptTitlePrint>
          <ReceiptSubtitlePrint>Payment Successful</ReceiptSubtitlePrint>
        </PrintHeader>

        <PrintSection>
          <SectionTitlePrint>Pet Information</SectionTitlePrint>
          <PrintItem>
            <ItemLabel>Pet Name:</ItemLabel>
            <ItemValue>{appointment.petName}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Pet Type:</ItemLabel>
            <ItemValue>{appointment.petType}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Breed:</ItemLabel>
            <ItemValue>{appointment.breed}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Gender:</ItemLabel>
            <ItemValue>{appointment.gender}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Color:</ItemLabel>
            <ItemValue>{appointment.color}</ItemValue>
          </PrintItem>
          <PrintItem>
            <ItemLabel>Birthday:</ItemLabel>
            <ItemValue>{appointment.birthday ? formatBirthday(appointment.birthday) : "Not specified"}</ItemValue>
          </PrintItem>
          {appointment.age && (
            <PrintItem>
              <ItemLabel>Age:</ItemLabel>
              <ItemValue>{appointment.age}</ItemValue>
            </PrintItem>
          )}
        </PrintSection>

        <PrintSection>
          <SectionTitlePrint>Appointment Details</SectionTitlePrint>
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
          {appointment.referenceNumber && (
            <PrintItem>
              <ItemLabel>Reference No:</ItemLabel>
              <ItemValue>{appointment.referenceNumber}</ItemValue>
            </PrintItem>
          )}
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
          <ClinicNameSmall>FursureCare Veterinary Clinic</ClinicNameSmall>
          <ClinicAddress>168 Unit A Bus Stop JP Laurel Hiway cor. V Dimayuga st. Brgy. 4, Tanauan, Philippines</ClinicAddress>
          <ClinicContact>Phone: 0906-484-1234 / 0916-621-5953</ClinicContact>
          <ClinicEmail>Email: madulcedecahvez@gmail.com</ClinicEmail>
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

// 🔹 Clean Receipt Screen Component with Logo and Complete Pet Details
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
        <LogoContainer>
          <ClinicLogo>
            <LogoImage src="/RL.jpg" alt="RL Clinic Logo" />
          </ClinicLogo>
        </LogoContainer>
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
              <DetailLabel>Pet Type</DetailLabel>
              <DetailValue>{appointment.petType}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Breed</DetailLabel>
              <DetailValue>{appointment.breed}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Gender</DetailLabel>
              <DetailValue>{appointment.gender}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Color</DetailLabel>
              <DetailValue>{appointment.color}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Birthday</DetailLabel>
              <DetailValue>{appointment.birthday ? formatBirthday(appointment.birthday) : "Not specified"}</DetailValue>
            </DetailItem>
            {appointment.age && (
              <DetailItem>
                <DetailLabel>Age</DetailLabel>
                <DetailValue>{appointment.age}</DetailValue>
              </DetailItem>
            )}
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
            {appointment.referenceNumber && (
              <DetailItem>
                <DetailLabel>Reference Number</DetailLabel>
                <DetailValue>{appointment.referenceNumber}</DetailValue>
              </DetailItem>
            )}
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

// 🔹 Main Appointment Page Component
const AppointmentPage: React.FC = () => {
  const router = useRouter();
  const { pets, bookedSlots, unavailableSlots, doctors, isLoading } = useAppointmentData();
  const { isDateUnavailable, getUnavailableDates } = useAvailability(unavailableSlots);
  
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
  const [showGCashModal, setShowGCashModal] = useState(false);
  const [showUnavailableDetails, setShowUnavailableDetails] = useState(false);
  const [selectedUnavailableSlot, setSelectedUnavailableSlot] = useState<UnavailableSlot | null>(null);
  const [completedAppointment, setCompletedAppointment] = useState<Appointment | null>(null);
  const [pendingAppointmentInfo, setPendingAppointmentInfo] = useState<{
    id: string;
    amount: number;
    type: string;
    petName: string;
    referenceNumber: string;
    qrData: string;
  } | null>(null);

  // 🔹 FIXED: Enhanced GCash Success Handler
  const handleGCashSuccess = useCallback(async () => {
    if (pendingAppointmentInfo) {
      try {
        // Get updated appointment details
        const fullAppointment = await getAppointmentDetails(pendingAppointmentInfo.id);
        
        setCompletedAppointment(fullAppointment);
        setShowGCashModal(false);
        setShowReceipt(true);
        setPendingAppointmentInfo(null);
        
        console.log("✅ GCash payment completed successfully");
        
      } catch (error) {
        console.error("❌ Error completing GCash payment:", error);
        alert("Payment was successful but there was an error loading your appointment details.");
        
        // Still close the modal and redirect
        setShowGCashModal(false);
        setPendingAppointmentInfo(null);
        router.push("/userdashboard");
      }
    }
  }, [pendingAppointmentInfo, router]);

  // 🔹 FIXED: Proper cancel handler with cleanup
  const handleGCashCancel = useCallback(async (appointmentId: string) => {
    try {
      console.log("🔄 Processing appointment cancellation:", appointmentId);
      
      // Close modal first
      setShowGCashModal(false);
      setPendingAppointmentInfo(null);
      
      // Small delay to allow modal to close smoothly
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reset booking state
      dispatch({ type: 'RESET' });
      
      // Redirect to dashboard
      router.push("/userdashboard");
      
      console.log("✅ Cancellation cleanup completed");
      
    } catch (error) {
      console.error("❌ Error in cancellation cleanup:", error);
      // Still redirect even if there's an error
      router.push("/userdashboard");
    }
  }, [router]);

  // 🔹 Unavailable Details Modal Handlers
  const openUnavailableDetails = (slot: UnavailableSlot) => {
    setSelectedUnavailableSlot(slot);
    setShowUnavailableDetails(true);
  };

  const closeUnavailableDetails = () => {
    setShowUnavailableDetails(false);
    setSelectedUnavailableSlot(null);
  };

  // 🔹 FIXED: Enhanced Main Booking Handler
  const handlePaymentSelection = useCallback(async (paymentMethod: string) => {
    setIsProcessing(true);
    setShowPaymentMethods(false);
    
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate, selectedPrice } = bookingState;

    try {
      // Validate required fields
      if (!selectedPet || !selectedSlot || !selectedAppointmentType || !selectedDate) {
        throw new Error("Please complete all required fields");
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found");
      }

      const selectedPetData = pets.find((p) => p.id === selectedPet);
      if (!selectedPetData) {
        throw new Error("Selected pet not found");
      }

      // Check for conflicts
      if (isDateUnavailable(selectedDate)) {
        throw new Error("This date is unavailable. Please select another date.");
      }

      const isTaken = bookedSlots.some(
        (s) => s.date === selectedDate && s.timeSlot === selectedSlot && s.status !== "Cancelled"
      );
      
      if (isTaken) {
        throw new Error("This time slot is already booked by another user");
      }

      console.log("🚀 Starting appointment creation process...");

      // ✅ STEP 1: Create appointment in Firestore
      const appointmentId = await createAppointmentInFirestore(
        bookingState,
        paymentMethod,
        currentUser,
        selectedPetData
      );

      console.log("✅ Appointment created with ID:", appointmentId);

      // ✅ STEP 2: Send notifications to doctors
      try {
        await sendDoctorNotifications(
          appointmentId, 
          currentUser, 
          selectedPetData, 
          selectedDate, 
          selectedSlot, 
          selectedPrice,
          doctors
        );
      } catch (notifError) {
        console.warn("⚠️ Notification failed (non-critical):", notifError);
      }

      // ✅ STEP 3: Handle payment method specific flows
      if (paymentMethod === "Cash") {
        // For cash payments, show receipt immediately
        await processAppointmentPayment(appointmentId, "Cash", selectedPrice);
        
        const fullAppointment = await getAppointmentDetails(appointmentId);
        setCompletedAppointment(fullAppointment);
        setShowReceipt(true);
        
        console.log("💰 Cash payment completed successfully");
        
      } else if (paymentMethod === "GCash") {
        // For GCash payments, show payment modal
        setShowGCashModal(true);
        setPendingAppointmentInfo({
          id: appointmentId,
          amount: selectedPrice,
          type: selectedAppointmentType,
          petName: selectedPetData.name,
          referenceNumber: `GCASH-${Date.now()}`,
          qrData: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`GCASH|09171234567|${selectedPrice}|GCASH-${Date.now()}|FursureCareVet`)}`
        });

        console.log("📱 GCash payment modal opened");
      }

    } catch (error) {
      console.error("❌ Appointment booking error:", error);
      alert(`Failed to book appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [bookingState, pets, bookedSlots, isDateUnavailable, doctors]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setCurrentDate(today);
    dispatch({ type: 'SET_DATE', payload: today });
  }, []);

  useEffect(() => {
    if (pets.length > 0 && !bookingState.selectedPet) {
      dispatch({ type: 'SET_PET', payload: pets[0].id });
    }
  }, [pets, bookingState.selectedPet]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { selectedPet, selectedSlot, selectedAppointmentType, selectedDate } = bookingState;
    
    // Enhanced validation with specific error messages
    if (!selectedPet) {
      alert("Please select a pet");
      return;
    }

    if (!selectedAppointmentType) {
      alert("Please select an appointment type");
      return;
    }

    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    if (!selectedSlot) {
      alert("Please select a time slot");
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
                  unavailableDates={getUnavailableDates()}
                  unavailableSlots={unavailableSlots}
                  onDateChange={(date) => dispatch({ type: 'SET_DATE', payload: date })}
                  onSlotChange={(slot) => dispatch({ type: 'SET_SLOT', payload: slot })}
                  onViewUnavailableDetails={openUnavailableDetails}
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

        {/* GCash Payment Modal */}
        {showGCashModal && pendingAppointmentInfo && (
          <GCashPaymentModal
            amount={pendingAppointmentInfo.amount}
            appointmentType={pendingAppointmentInfo.type}
            petName={pendingAppointmentInfo.petName}
            appointmentId={pendingAppointmentInfo.id}
            onSuccess={handleGCashSuccess}
            onCancel={handleGCashCancel}
          />
        )}

        {/* Unavailable Details Modal */}
        {showUnavailableDetails && (
          <UnavailableDetailsModal 
            slot={selectedUnavailableSlot} 
            onClose={closeUnavailableDetails} 
          />
        )}
      </Wrapper>
    </>
  );
};

export default AppointmentPage;

// 🔹 STYLED COMPONENTS - All the styled components from the previous code remain the same
// (Include all the styled components from the previous implementation)

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
  background: #34B89C;
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

const PetsCount = styled.span`
  margin-left: auto;
  font-size: 14px;
  color: #666;
  font-weight: normal;
`;

const PetDetailsCard = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #34B89C;
  margin-top: 8px;
`;

const PetDetailTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 12px 0;
`;

const PetDetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
`;

const PetDetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PetDetailLabel = styled.span`
  font-size: 12px;
  color: #666;
  font-weight: 500;
`;

const PetDetailValue = styled.span`
  font-size: 14px;
  color: #2c3e50;
  font-weight: 600;
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

// 🔹 NEW: Enhanced Unavailable Warning with Reason
const UnavailableWarningWithReason = styled.div`
  background-color: #fff3cd;
  color: #856404;
  padding: 16px;
  border-radius: 8px;
  margin-top: 12px;
  border-left: 4px solid #ffc107;
`;

const WarningHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const WarningIcon = styled.span`
  font-size: 18px;
`;

const WarningTitle = styled.span`
  font-weight: 600;
  font-size: 16px;
`;

const WarningDetails = styled.div`
  margin-bottom: 12px;
  padding-left: 26px;
`;

const VeterinarianInfo = styled.div`
  margin-bottom: 4px;
  font-size: 14px;
`;

const ReasonInfo = styled.div`
  font-size: 14px;
  line-height: 1.4;
`;

const ViewDetailsButton = styled.button`
  background: transparent;
  border: 1px solid #856404;
  color: #856404;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 26px;
  
  &:hover {
    background: #856404;
    color: white;
  }
`;

const UnavailableDatesInfo = styled.div`
  background-color: #e7f4ff;
  color: #0c5460;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 8px;
`;

const UnavailableDatesList = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const UnavailableDateItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #e74c3c;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #e9ecef;
    transform: translateX(4px);
  }
`;

const DateText = styled.span`
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
`;

const ReasonText = styled.span`
  color: #7f8c8d;
  font-size: 12px;
  font-style: italic;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MoreDatesText = styled.div`
  text-align: center;
  color: #7f8c8d;
  font-size: 12px;
  font-style: italic;
  margin-top: 4px;
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

// 🔹 Modal Styled Components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: ${fadeIn} 0.3s ease-out;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #ecf0f1;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #2c3e50;
  }
`;

const DetailsContent = styled.div`
  padding: 2rem;
`;

const DetailSection = styled.div`
  margin-bottom: 2rem;
`;

const DetailSectionTitle = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #2c3e50;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #ecf0f1;
`;

const DetailItem = styled.div`
  display: flex;
  margin-bottom: 1rem;
  font-size: 0.875rem;
`;

const DetailLabelLarge = styled.span`
  font-weight: 500;
  color: #7f8c8d;
  min-width: 120px;
`;

const DetailValueLarge = styled.span`
  color: #2c3e50;
  flex: 1;
`;

const AppointmentActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
`;

const ActionButton = styled.button<{ $variant: "primary" | "success" | "warning" | "danger" | "info" }>`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  
  background: ${props =>
    props.$variant === "primary" ? "#3498db" :
    props.$variant === "success" ? "#28a745" :
    props.$variant === "warning" ? "#ffc107" :
    props.$variant === "danger" ? "#dc3545" :
    "#17a2b8"
  };
  
  color: ${props => 
    props.$variant === "warning" ? "#212529" : "white"
  };
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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

// 🔹 Printable Receipt Styled Components
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

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const ClinicLogo = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 12px;
  text-align: center;
  line-height: 1.2;
  padding: 8px;
  margin: 0 auto;
`;

const LogoImage = styled.img`
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 50%;
  display: block;
`;

const ClinicNamePrint = styled.h1`
  font-size: 24px;
  font-weight: bold;
  color: #34B89C;
  margin: 8px 0;
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
  margin-bottom: 4px;
`;

const ClinicEmail = styled.div`
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

// 🔹 GCash Payment Modal Styled Components
const PaymentModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
`;

const PaymentModal = styled.div`
  background: white;
  border-radius: 16px;
  padding: 0;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: ${fadeIn} 0.3s ease-out;
  
  &.large-modal {
    max-width: 700px;
  }
`;

const PaymentModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
`;

const PaymentModalTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
`;

const CloseModalButton = styled.button`
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    color: #e74c3c;
    transform: scale(1.1);
  }
  
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: #999;
  }
`;

const PaymentModalContent = styled.div`
  padding: 24px;
`;

const PaymentSummary = styled.div`
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  color: white;
`;

const SummaryTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
`;

const SummaryGrid = styled.div`
  display: flex;
  flex-direction: row;
  gap: 12px;
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: row;
  font-size: 14px;
  gap: 8px;
`;

const SummaryLabel = styled.span`
  font-weight: 350;
  opacity: 0.9;
  font-size: 14px;
`;

const SummaryValue = styled.span`
  font-weight: 600;
  word-break: break-word;
  
  &.amount {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  &.reference {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const CopyButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const QRCodeSection = styled.div`
  text-align: center;
  margin: 24px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
`;

const QRCodeTitle = styled.h3`
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
`;

const QRCodeNote = styled.p`
  margin: 0 0 16px 0;
  color: #34B89C;
  font-weight: 600;
  font-size: 16px;
`;

const QRCodeContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 20px 0;
`;

const QRCodeWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const QRCodeImage = styled.img`
  width: 280px;
  height: 280px;
  border-radius: 12px;
  display: block;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  @media (max-width: 480px) {
    width: 250px;
    height: 250px;
  }
`;

// 🔹 NEW: Reference Input Section Styles
const ReferenceInputSection = styled.div`
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
`;

const ReferenceInputTitle = styled.h4`
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
`;

const ReferenceInputDescription = styled.p`
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
`;

const ReferenceInputContainer = styled.div`
  margin-bottom: 16px;
`;

const ReferenceInputLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
`;

const ReferenceInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s ease;
  
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

const ReferenceInputHint = styled.p`
  margin: 8px 0 0 0;
  color: #666;
  font-size: 12px;
  font-style: italic;
`;

const PaymentError = styled.div`
  background: #ffeaea;
  color: #e74c3c;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-weight: 500;
`;

const PaymentModalActions = styled.div`
  display: flex;
  gap: 12px;
  position: relative;
  z-index: 10;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CancelPaymentButton = styled.button`
  padding: 14px 24px;
  border: 2px solid #e74c3c;
  border-radius: 12px;
  background: white;
  color: #e74c3c;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  
  &:hover:not(:disabled) {
    background: #ffeaea;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.2);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f5f5f5;
    color: #999;
    border-color: #ddd;
  }
`;

const ConfirmPaymentButton = styled.button`
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const PaymentNote = styled.div`
  text-align: center;
  margin-top: 16px;
  padding: 12px;
  background: #e3f2fd;
  border-radius: 8px;
  color: #1565c0;
  font-size: 14px;
  font-weight: 500;
`;