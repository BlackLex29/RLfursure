'use client';

import React, { useState, useEffect, useCallback } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #f8fafc;
    color: #334155;
  }

  * {
    box-sizing: border-box;
  }
`;

interface MedicalRecord {
  id: string;
  petName: string;
  petAge: string;
  birthDate: string;
  breed: string;
  weight: string;
  gender: string;
  color: string;
  allergies: string;
  existingConditions: string;
  ownerName: string;
  ownerEmail: string;
  petType: string;
  diagnosis: string;
  treatment: string;
  date: string;
  notes: string;
  veterinarian: string;
  createdAt: Date | null;
  status?: string;
  petId?: string;
  appointmentId?: string;
  appointmentStatus?: string;
  appointmentType?: string;
}

interface UserMedicalRecord {
  id: string;
  petName: string;
  petAge: string;
  birthDate: string;
  breed: string;
  weight: string;
  gender: string;
  color: string;
  allergies: string;
  existingConditions: string;
  ownerName: string;
  ownerEmail: string;
  petType: string;
  diagnosis: string;
  treatment: string;
  date: string;
  notes: string;
  veterinarian: string;
  createdAt: Date | null;
  status?: string;
  petId?: string;
  appointmentId?: string;
  appointmentType?: string;
  userId?: string;
}

interface Appointment {
  id: string;
  petName: string;
  date: string;
  timeSlot: string;
  status: string;
  clientName: string;
  appointmentType: string;
  petType: string;
  breed: string;
  petAge?: string;
  birthDate?: string;
  weight?: string;
  gender?: string;
  color?: string;
  allergies?: string;
  existingConditions?: string;
  ownerEmail?: string;
  petBreed?: string;
  birthday?: string;
  age?: string;
}

interface NotificationType {
  id: string;
  userId: string;
  type: 'appointment_approved' | 'medical_record_sent' | 'appointment_reminder' | 'general';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date | null;
  appointmentId?: string;
  petId?: string;
  medicalRecordId?: string;
}

const DIAGNOSIS_OPTIONS = {
  dog: ["Parvovirus","Distemper","Kennel Cough","Heartworm","Arthritis","Dental Disease","Ear Infection","Skin Allergies","Obesity","Gastroenteritis","General Consultation","Vaccination","Rabies Vaccination","Diagnostic Imaging","Sterilization","Parasitic Infection"],
  cat: ["Feline Leukemia Virus","Feline Immunodeficiency Virus","Upper Respiratory Infection","Urinary Tract Disease","Chronic Kidney Disease","Diabetes","Hyperthyroidism","Dental Disease","Fleas and Ticks","Ringworm","General Consultation","Vaccination","Rabies Vaccination","Diagnostic Imaging","Sterilization","Parasitic Infection"]
};

const TREATMENT_OPTIONS = {
  dog: ["Vaccination","Antibiotics","Anti-inflammatory","Deworming","Flea/Tick Prevention","Dental Cleaning","Surgery","Physical Therapy","Special Diet","Medicated Shampoo","Physical Examination","Ultrasound Procedure","Professional Grooming"],
  cat: ["Vaccination","Antibiotics","Fluid Therapy","Urinary Diet","Insulin Therapy","Antifungal Medication","Dental Extraction","Topical Treatment","Specialized Diet","Environmental Enrichment","Physical Examination","Ultrasound Procedure","Professional Grooming"]
};

const PET_BREEDS = {
  dog: ["Aspin (Asong Pinoy)","Shih Tzu","Siberian Husky","Chihuahua","Labrador Retriever","Beagle","Golden Retriever","Poodle","Dachshund","Rottweiler","Philippine Forest Dog (Asong Gubat)"],
  cat: ["British Shorthair","Burmese","Abyssinian","Scottish Fold","Siamese","Sphynx","Ragdoll","American Shorthair","Maine Coon","Persian","Putot Cat (Pusang Putot)"]
};

const APPOINTMENT_TYPE_MAPPINGS: Record<string, {diagnosis: string, treatment: string}> = {
  "vaccination": { diagnosis: "Vaccination", treatment: "Vaccination" },
  "checkup": { diagnosis: "General Consultation", treatment: "Physical Examination" },
  "antiRabies": { diagnosis: "Rabies Vaccination", treatment: "Vaccination" },
  "ultrasound": { diagnosis: "Diagnostic Imaging", treatment: "Ultrasound Procedure" },
  "groom": { diagnosis: "Grooming Service", treatment: "Professional Grooming" },
  "spayNeuter": { diagnosis: "Sterilization", treatment: "Surgery" },
  "deworm": { diagnosis: "Parasitic Infection", treatment: "Deworming" }
};

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  "vaccination": "Vaccination",
  "checkup": "Check Up", 
  "antiRabies": "Anti Rabies",
  "ultrasound": "Ultrasound",
  "groom": "Grooming",
  "spayNeuter": "Spay/Neuter (Kapon)",
  "deworm": "Deworming (Purga)"
};

const sanitizeFirestoreData = (data: Record<string, unknown>) => {
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) delete sanitized[key];
  });
  return sanitized;
};

// Function to get user ID by email
const getUserIdByEmail = async (email: string): Promise<string | null> => {
  try {
    const usersQuery = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(usersQuery);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error getting user ID by email:", error);
    return null;
  }
};

// Function to create notification for user
const createNotification = async (notificationData: Omit<NotificationType, 'id'>) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notificationData,
      createdAt: new Date()
    });
    console.log("Notification created successfully");
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

// Function to send medical record notification
const sendMedicalRecordNotification = async (
  ownerEmail: string, 
  petName: string, 
  medicalRecordId: string,
  appointmentType?: string
) => {
  try {
    const userId = await getUserIdByEmail(ownerEmail);
    
    if (!userId) {
      console.warn(`User not found for email: ${ownerEmail}`);
      return;
    }

    const serviceType = appointmentType ? APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType : "veterinary service";
    
    const notificationData = {
      userId: userId,
      type: "medical_record_sent" as const,
      title: "Medical Record Available",
      message: `Your pet ${petName}'s medical record for ${serviceType} is now available for viewing.`,
      read: false,
      medicalRecordId: medicalRecordId,
      createdAt: new Date()
    };

    await createNotification(notificationData);
    console.log(`Medical record notification sent to ${ownerEmail}`);
  } catch (error) {
    console.error("Error sending medical record notification:", error);
  }
};

// ✅ NEW: Function to save medical record to usermedicalrecord collection
const saveToUserMedicalRecord = async (
  medicalRecordData: MedicalRecord,
  ownerEmail: string
): Promise<void> => {
  try {
    const userId = await getUserIdByEmail(ownerEmail);
    
    if (!userId) {
      console.warn(`User not found for email: ${ownerEmail}, cannot save to usermedicalrecord`);
      return;
    }

    // Prepare data for usermedicalrecord collection
    const userMedicalRecordData: Omit<UserMedicalRecord, 'id'> = {
      petName: medicalRecordData.petName,
      petAge: medicalRecordData.petAge,
      birthDate: medicalRecordData.birthDate,
      breed: medicalRecordData.breed,
      weight: medicalRecordData.weight,
      gender: medicalRecordData.gender,
      color: medicalRecordData.color,
      allergies: medicalRecordData.allergies,
      existingConditions: medicalRecordData.existingConditions,
      ownerName: medicalRecordData.ownerName,
      ownerEmail: medicalRecordData.ownerEmail,
      petType: medicalRecordData.petType,
      diagnosis: medicalRecordData.diagnosis,
      treatment: medicalRecordData.treatment,
      date: medicalRecordData.date,
      notes: medicalRecordData.notes,
      veterinarian: medicalRecordData.veterinarian,
      status: medicalRecordData.status || "completed",
      petId: medicalRecordData.petId,
      appointmentId: medicalRecordData.appointmentId,
      appointmentType: medicalRecordData.appointmentType,
      userId: userId,
      createdAt: new Date()
    };

    // Check if record already exists in usermedicalrecord
    const existingRecordsQuery = query(
      collection(db, "usermedicalrecord"),
      where("appointmentId", "==", medicalRecordData.appointmentId),
      where("userId", "==", userId)
    );
    
    const existingRecords = await getDocs(existingRecordsQuery);
    
    if (!existingRecords.empty) {
      // Update existing record
      const existingDoc = existingRecords.docs[0];
      await updateDoc(doc(db, "usermedicalrecord", existingDoc.id), {
        ...userMedicalRecordData,
        updatedAt: new Date()
      });
      console.log(`✅ Updated existing medical record in usermedicalrecord for user ${userId}`);
    } else {
      // Create new record
      await addDoc(collection(db, "usermedicalrecord"), userMedicalRecordData);
      console.log(`✅ Created new medical record in usermedicalrecord for user ${userId}`);
    }
    
  } catch (error) {
    console.error("❌ Error saving to usermedicalrecord:", error);
    throw new Error(`Failed to save medical record to user collection: ${error}`);
  }
};

// Enhanced function to calculate age from birth date
const calculateAgeFromBirthDate = (birthDate: string): string => {
  if (!birthDate) return '';
  
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    
    // Check if birth date is valid
    if (isNaN(birth.getTime())) return '';
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    if (age <= 0) {
      const months = Math.max(0, (today.getFullYear() - birth.getFullYear()) * 12 + 
        (today.getMonth() - birth.getMonth()));
      if (months === 0) {
        const days = Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
        return days <= 1 ? "1 day" : `${days} days`;
      }
      return months <= 1 ? "1 month" : `${months} months`;
    }
    if (age === 1) return "1 year";
    return `${age} years`;
  } catch {
    return '';
  }
};

// Helper function to format date
const formatDateDisplay = (dateString: string): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Enhanced helper function to get display value
const getDisplayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return String(value);
};

// Function to extract breed from appointment data
const getBreedFromAppointment = (appointment: Appointment): string => {
  return appointment.breed || appointment.petBreed || '';
};

// Function to extract age from appointment data
const getAgeFromAppointment = (appointment: Appointment): string => {
  if (appointment.petAge) return appointment.petAge;
  if (appointment.birthDate || appointment.birthday) {
    const birthDate = appointment.birthDate || appointment.birthday;
    return calculateAgeFromBirthDate(birthDate!);
  }
  if (appointment.age) return appointment.age;
  return '';
};

// Function to extract birth date from appointment data
const getBirthDateFromAppointment = (appointment: Appointment): string => {
  return appointment.birthDate || appointment.birthday || '';
};

// Function to extract pet type from appointment data with validation
const getPetTypeFromAppointment = (appointment: Appointment): string => {
  const petType = appointment.petType?.toLowerCase() || '';
  
  // Validate and normalize pet type
  if (petType === 'dog' || petType === 'cat') {
    return petType;
  }
  
  // Additional validation: check breed to determine pet type
  const breed = getBreedFromAppointment(appointment).toLowerCase();
  const dogBreeds = PET_BREEDS.dog.map(b => b.toLowerCase());
  const catBreeds = PET_BREEDS.cat.map(b => b.toLowerCase());
  
  if (dogBreeds.some(dogBreed => breed.includes(dogBreed))) {
    return 'dog';
  }
  if (catBreeds.some(catBreed => breed.includes(catBreed))) {
    return 'cat';
  }
  
  // Default to dog if cannot determine
  console.warn(`Cannot determine pet type for appointment ${appointment.id}, defaulting to dog`);
  return 'dog';
};

const MedicalRecord: React.FC = () => {
  const router = useRouter();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPetType, setFilterPetType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ NEW: Prevent double submission

  const [formData, setFormData] = useState({
    petName: "",
    petAge: "",
    birthDate: "",
    breed: "",
    weight: "",
    gender: "",
    color: "",
    allergies: "",
    existingConditions: "",
    ownerName: "",
    ownerEmail: "",
    petType: "dog",
    diagnosis: "",
    treatment: "",
    date: new Date().toISOString().split('T')[0],
    notes: "",
    veterinarian: "",
    appointmentId: "",
    appointmentType: "",
    status: "pending_completion"
  });

  const [isFromAppointment, setIsFromAppointment] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Check user claims for debugging
        try {
          const token = await user.getIdTokenResult();
          console.log('User Claims:', token.claims);
        } catch (error) {
          console.error('Error getting user claims:', error);
        }
      } else {
        setCurrentUser(null);
        setRecords([]);
        setLoading(false);
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Enhanced appointment fetching with complete data extraction and pet type validation
  const fetchAppointments = useCallback(async () => {
    try {
      const q = query(collection(db, "appointments"), where("status", "==", "Done"));
      const querySnapshot = await getDocs(q);
      const appointmentsData: Appointment[] = [];
      
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        
        // ENHANCED: Extract ALL possible data fields from appointment with pet type validation
        const rawPetType = data.petType || "dog";
        const validatedPetType = getPetTypeFromAppointment({
          id: docSnap.id,
          petType: rawPetType,
          breed: data.petBreed || data.breed || "",
          // ... other fields
        } as Appointment);
        
        const appointment: Appointment = {
          id: docSnap.id,
          petName: data.petName || data.name || "Unknown Pet",
          date: data.date || new Date().toISOString().split('T')[0],
          timeSlot: data.timeSlot || "",
          status: data.status || "",
          clientName: data.clientName || data.ownerName || "Unknown Owner",
          appointmentType: data.appointmentType || "",
          petType: validatedPetType, // Use validated pet type
          breed: data.petBreed || data.breed || "",
          petAge: data.petAge || data.age || "",
          birthDate: data.birthDate || data.birthday || "",
          weight: data.weight || "",
          gender: data.gender || "",
          color: data.color || "",
          allergies: data.allergies || "",
          existingConditions: data.existingConditions || "",
          ownerEmail: data.ownerEmail || data.clientEmail || "",
          petBreed: data.petBreed || data.breed || "",
          birthday: data.birthday || data.birthDate || "",
          age: data.age || data.petAge || ""
        };
        
        appointmentsData.push(appointment);
      });
      
      appointmentsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppointments(appointmentsData);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }, []);

  const setupMedicalRecordsListener = useCallback(() => {
    const q = query(collection(db, "medicalRecords"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: MedicalRecord[] = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        recordsData.push({ 
          id: docSnap.id, 
          petName: data.petName || "",
          petAge: data.petAge || "",
          birthDate: data.birthDate || "",
          breed: data.breed || "",
          weight: data.weight || "",
          gender: data.gender || "",
          color: data.color || "",
          allergies: data.allergies || "",
          existingConditions: data.existingConditions || "",
          ownerName: data.ownerName || "",
          ownerEmail: data.ownerEmail || "",
          petType: data.petType || "dog",
          diagnosis: data.diagnosis || "",
          treatment: data.treatment || "",
          date: data.date || new Date().toISOString().split('T')[0],
          notes: data.notes || "",
          veterinarian: data.veterinarian || "",
          appointmentId: data.appointmentId || "",
          appointmentStatus: data.appointmentStatus || "",
          appointmentType: data.appointmentType || "",
          status: data.status || "pending_completion",
          petId: data.petId || "",
          createdAt: data.createdAt || null
        } as MedicalRecord);
      });
      
      setRecords(recordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to medical records:", error);
      setErrorMessage("Error loading medical records. Please refresh the page.");
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (currentUser) {
      fetchAppointments();
      unsubscribe = setupMedicalRecordsListener();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, fetchAppointments, setupMedicalRecordsListener]);

  // NEW: Function to filter out appointments that already have medical records
  const getAvailableAppointments = useCallback(() => {
    // Get all appointment IDs that already have medical records
    const usedAppointmentIds = new Set(
      records
        .filter(record => record.appointmentId)
        .map(record => record.appointmentId)
    );
    
    // Filter out appointments that are already used
    return appointments.filter(appointment => 
      !usedAppointmentIds.has(appointment.id)
    );
  }, [appointments, records]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === "petType") {
      const currentBreed = formData.breed;
      const currentDiagnosis = formData.diagnosis;
      const currentTreatment = formData.treatment;
      
      const newBreeds = PET_BREEDS[value as keyof typeof PET_BREEDS] || [];
      const newDiagnoses = DIAGNOSIS_OPTIONS[value as keyof typeof DIAGNOSIS_OPTIONS] || [];
      const newTreatments = TREATMENT_OPTIONS[value as keyof typeof TREATMENT_OPTIONS] || [];
      
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        breed: newBreeds.includes(currentBreed) ? currentBreed : "",
        diagnosis: newDiagnoses.includes(currentDiagnosis) ? currentDiagnosis : "",
        treatment: newTreatments.includes(currentTreatment) ? currentTreatment : ""
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ENHANCED: Handle creating from appointment with COMPLETE auto-fill and PET TYPE VALIDATION
  const handleCreateFromAppointment = (appointment: Appointment) => {
    const appointmentTypeKey = Object.keys(APPOINTMENT_TYPE_LABELS).find(
      key => APPOINTMENT_TYPE_LABELS[key] === appointment.appointmentType
    ) || appointment.appointmentType;
    
    const appointmentMapping = APPOINTMENT_TYPE_MAPPINGS[appointmentTypeKey] || APPOINTMENT_TYPE_MAPPINGS.checkup;
    
    // ENHANCED: Use helper functions to get breed and age with PET TYPE VALIDATION
    const breed = getBreedFromAppointment(appointment);
    const age = getAgeFromAppointment(appointment);
    const birthDate = getBirthDateFromAppointment(appointment);
    
    // FIXED: Use validated pet type from appointment
    const validatedPetType = getPetTypeFromAppointment(appointment);

    // COMPLETE AUTO-FILL: Map ALL data from appointment to form
    const autoFilledFormData = {
      petName: getDisplayValue(appointment.petName),
      date: appointment.date || new Date().toISOString().split('T')[0],
      petType: validatedPetType, // Use validated pet type
      breed: breed,
      appointmentType: getDisplayValue(appointment.appointmentType),
      appointmentId: appointment.id,
      petAge: age,
      birthDate: birthDate,
      weight: getDisplayValue(appointment.weight),
      gender: getDisplayValue(appointment.gender),
      color: getDisplayValue(appointment.color),
      allergies: getDisplayValue(appointment.allergies),
      existingConditions: getDisplayValue(appointment.existingConditions),
      diagnosis: appointmentMapping.diagnosis || "General Consultation",
      treatment: appointmentMapping.treatment || "Physical Examination",
      ownerName: getDisplayValue(appointment.clientName),
      ownerEmail: getDisplayValue(appointment.ownerEmail),
      notes: `Appointment: ${appointment.appointmentType} on ${formatDateDisplay(appointment.date)} at ${appointment.timeSlot}`,
      veterinarian: currentUser?.email?.split('@')[0] || "Dr. Veterinarian",
      status: "pending_completion"
    };
    
    console.log('Auto-filled form data:', {
      originalPetType: appointment.petType,
      validatedPetType: validatedPetType,
      breed: breed,
      formData: autoFilledFormData
    });
    
    setFormData(autoFilledFormData);
    setIsFromAppointment(true);
    setShowAppointmentModal(false);
    setShowForm(true);
  };

  // ✅ ENHANCED: Handle submit with usermedicalrecord saving and double-click prevention
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ PREVENT DOUBLE SUBMISSION
    if (isSubmitting) {
      console.log('Submission already in progress...');
      return;
    }

    if (!currentUser) {
      alert("Please login first!");
      return;
    }

    setIsSubmitting(true); // ✅ Set submitting state to true

    const finalStatus = formData.diagnosis && formData.treatment && formData.veterinarian 
      ? "completed" 
      : "pending_completion";

    const sanitizedData = sanitizeFirestoreData({
      ...formData,
      status: finalStatus,
      updatedAt: new Date()
    });

    try {
      let medicalRecordId: string;
      
      if (editingRecord) {
        // Update existing record
        await updateDoc(doc(db, "medicalRecords", editingRecord.id), sanitizedData);
        medicalRecordId = editingRecord.id;
        setSuccessMessage("✅ Medical record updated successfully!");
        
        // ✅ NEW: Save to usermedicalrecord when editing and completing
        if (finalStatus === "completed" && editingRecord.status !== "completed") {
          await saveToUserMedicalRecord(
            { ...editingRecord, ...sanitizedData } as MedicalRecord,
            formData.ownerEmail
          );
        }
      } else {
        // Create new record
        const docRef = await addDoc(collection(db, "medicalRecords"), {
          ...sanitizedData,
          createdAt: new Date()
        });
        medicalRecordId = docRef.id;
        console.log("Medical record created with ID:", docRef.id);
        
        setSuccessMessage("✅ Medical record created successfully!");
        
        // ✅ NEW: Save to usermedicalrecord when creating completed record
        if (finalStatus === "completed") {
          await saveToUserMedicalRecord(
            { id: medicalRecordId, ...sanitizedData } as MedicalRecord,
            formData.ownerEmail
          );
        }
        
        // Refresh appointments list to remove the used one
        if (formData.appointmentId) {
          await fetchAppointments();
        }
      }

      // ✅ ENHANCED: Send notification if record is completed
      if (finalStatus === "completed") {
        await sendMedicalRecordNotification(
          formData.ownerEmail,
          formData.petName,
          medicalRecordId,
          formData.appointmentType
        );
      }

      resetForm();
      
      // ✅ Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

    } catch (error) {
      console.error("Error saving medical record:", error);
      setErrorMessage("❌ Failed to save medical record. Please try again.");
      
      // ✅ Auto-hide error message after 5 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    } finally {
      // ✅ Reset submitting state whether success or error
      setIsSubmitting(false);
    }
  };

  const handleEdit = (record: MedicalRecord, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setFormData({
      petName: record.petName,
      petAge: record.petAge,
      birthDate: record.birthDate,
      breed: record.breed,
      weight: record.weight,
      gender: record.gender,
      color: record.color,
      allergies: record.allergies,
      existingConditions: record.existingConditions,
      ownerName: record.ownerName,
      ownerEmail: record.ownerEmail,
      petType: record.petType,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      date: record.date,
      notes: record.notes,
      veterinarian: record.veterinarian || "",
      appointmentId: record.appointmentId || "",
      appointmentType: record.appointmentType || "",
      status: record.status || "pending_completion"
    });
    setIsFromAppointment(!!record.appointmentId);
    setEditingRecord(record);
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  // NEW: Function to refresh user token
  const refreshUserToken = async () => {
    if (currentUser) {
      try {
        await currentUser.getIdToken(true);
        console.log('User token refreshed');
        setSuccessMessage("User token refreshed successfully!");
        setTimeout(() => setSuccessMessage(null), 2000);
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    }
  };

  // ✅ FIXED: Separate functions for reset form and add new record
  const resetForm = () => {
    setFormData({
      petName: "",
      petAge: "",
      birthDate: "",
      breed: "",
      weight: "",
      gender: "",
      color: "",
      allergies: "",
      existingConditions: "",
      ownerName: "",
      ownerEmail: "",
      petType: "dog",
      diagnosis: "",
      treatment: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
      veterinarian: "",
      appointmentId: "",
      appointmentType: "",
      status: "pending_completion"
    });
    setIsFromAppointment(false);
    setEditingRecord(null);
    setShowForm(false);
    setIsSubmitting(false); // ✅ Reset submitting state
  };

  // ✅ NEW: Function specifically for adding new record
  const handleAddRecord = () => {
    setFormData({
      petName: "",
      petAge: "",
      birthDate: "",
      breed: "",
      weight: "",
      gender: "",
      color: "",
      allergies: "",
      existingConditions: "",
      ownerName: "",
      ownerEmail: "",
      petType: "dog",
      diagnosis: "",
      treatment: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
      veterinarian: currentUser?.email?.split('@')[0] || "Dr. Veterinarian", // ✅ Auto-fill veterinarian
      appointmentId: "",
      appointmentType: "",
      status: "pending_completion"
    });
    setIsFromAppointment(false);
    setEditingRecord(null);
    setShowForm(true); // ✅ IMPORTANT: Set showForm to TRUE
    window.scrollTo(0, 0);
  };

  // FIXED: Enhanced filtering logic
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.petName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        record.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPetType = filterPetType === "all" || record.petType === filterPetType;
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "pending" && record.status === "pending_completion") ||
                         (filterStatus === "completed" && record.status === "completed");
    return matchesSearch && matchesPetType && matchesStatus;
  });

  const pendingRecords = records.filter(r => r.status === "pending_completion");
  const completedRecords = records.filter(r => r.status === "completed");

  // NEW: Get available appointments (not used yet)
  const availableAppointments = getAvailableAppointments();

  const FormStatusInfo = () => {
    const isComplete = formData.diagnosis && formData.treatment && formData.veterinarian;
    
    if (!isComplete) {
      return (
        <StatusInfo $status="pending">
          ⚠️ Draft Mode - This record will be saved as pending until diagnosis, treatment, and veterinarian are filled
        </StatusInfo>
      );
    }
    return (
      <StatusInfo $status="completed">
        ✅ Complete Mode - This record will be visible to the user and notification will be sent
      </StatusInfo>
    );
  };

  if (loading) return <><GlobalStyle /><LoadingContainer>Loading medical records...</LoadingContainer></>;

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <ClinicLogo>
              <LogoImage src="/RL.jpg" alt="RL Clinic Logo" />
            </ClinicLogo>
            <div>
              <ClinicName>RL Clinic</ClinicName>
              <Tagline>Fursure Care - Medical Records (Admin)</Tagline>
              {currentUser && (
                <UserInfo>
                  Logged in as: {currentUser.email} 
                  <RefreshTokenButton onClick={refreshUserToken}>
                    🔄 Refresh Token
                  </RefreshTokenButton>
                </UserInfo>
              )}
            </div>
          </BrandSection>
          <ButtonGroup>
            <BackButton onClick={() => router.push("/admindashboard")}>
              ⮜ Back
            </BackButton>
            {availableAppointments.length > 0 && (
              <CreateButton onClick={() => setShowAppointmentModal(true)}>
                📅 From Appointment ({availableAppointments.length})
              </CreateButton>
            )}
            {/* ✅ FIXED: Changed from resetForm to handleAddRecord */}
            <AddButton onClick={handleAddRecord}>
              + Add Record
            </AddButton>
          </ButtonGroup>
        </HeaderBar>

        {successMessage && (
          <SuccessMessage>
            {successMessage}
            <br />
            <small>List will update automatically...</small>
          </SuccessMessage>
        )}

        {errorMessage && (
          <ErrorMessage>
            {errorMessage}
            <br />
            <small>Please check your permissions or try refreshing the page.</small>
          </ErrorMessage>
        )}

        <Content>
          {showForm ? (
            <FormCard>
              <Title>
                {editingRecord ? "Edit Medical Record" : "Create New Medical Record"}
                {isFromAppointment && (
                  <AutoFillBadge>
                    🎯 AUTO-FILLED FROM APPOINTMENT
                  </AutoFillBadge>
                )}
                <FormHelpText>
                  {isFromAppointment 
                    ? "All pet information is auto-filled from appointment data" 
                    : "Fill in all required fields to create a new medical record"}
                </FormHelpText>
                <FormStatusInfo />
              </Title>
              
              <Form onSubmit={handleSubmit}>
                {/* Pet Information Section - AUTO-FILLED but EDITABLE for specific fields */}
                <FormSection>
                  <SectionTitle>
                    Pet Information 
                    {isFromAppointment && <AutoFillIndicator>✅ Auto-filled</AutoFillIndicator>}
                  </SectionTitle>
                  
                  {isFromAppointment ? (
                    <EditableSection>
                      <EditableGrid>
                        {/* Read-only fields for appointment-based records */}
                        <ReadOnlyField>
                          <ReadOnlyLabel>Pet Name</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.petName || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Owner Name</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.ownerName || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Owner Email</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.ownerEmail || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Pet Type</ReadOnlyLabel>
                          <ReadOnlyValue>
                            {formData.petType === 'dog' ? '🐶 Dog' : formData.petType === 'cat' ? '🐱 Cat' : formData.petType || 'Not specified'}
                          </ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Breed</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.breed || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Age</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.petAge || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Birth Date</ReadOnlyLabel>
                          <ReadOnlyValue>{formatDateDisplay(formData.birthDate) || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Gender</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.gender || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        <ReadOnlyField>
                          <ReadOnlyLabel>Color</ReadOnlyLabel>
                          <ReadOnlyValue>{formData.color || 'Not specified'}</ReadOnlyValue>
                        </ReadOnlyField>
                        
                        {/* Editable fields - Admin can modify these */}
                        <FormGroup>
                          <Label>Weight <OptionalText>(optional)</OptionalText></Label>
                          <Input 
                            type="text" 
                            name="weight" 
                            value={formData.weight} 
                            onChange={handleChange} 
                            placeholder="e.g., 5 kg, 12 lbs"
                          />
                          <FieldHelp>Enter weight with unit (kg/lbs)</FieldHelp>
                        </FormGroup>
                        
                        <FormGroup>
                          <Label>Allergies <OptionalText>(optional)</OptionalText></Label>
                          <TextArea 
                            name="allergies" 
                            value={formData.allergies} 
                            onChange={handleChange} 
                            placeholder="List any known allergies"
                            rows={2}
                          />
                          <FieldHelp>Separate multiple allergies with commas</FieldHelp>
                        </FormGroup>
                        
                        <FormGroup>
                          <Label>Existing Conditions <OptionalText>(optional)</OptionalText></Label>
                          <TextArea 
                            name="existingConditions" 
                            value={formData.existingConditions} 
                            onChange={handleChange} 
                            placeholder="List any pre-existing medical conditions"
                            rows={2}
                          />
                          <FieldHelp>Chronic conditions or previous health issues</FieldHelp>
                        </FormGroup>
                      </EditableGrid>
                    </EditableSection>
                  ) : (
                    // ✅ NEW: Editable fields for manual record creation
                    <EditableGrid>
                      <FormGroup>
                        <Label>Pet Name *</Label>
                        <Input 
                          type="text" 
                          name="petName" 
                          value={formData.petName} 
                          onChange={handleChange} 
                          placeholder="Enter pet name"
                          required
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Owner Name *</Label>
                        <Input 
                          type="text" 
                          name="ownerName" 
                          value={formData.ownerName} 
                          onChange={handleChange} 
                          placeholder="Enter owner name"
                          required
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Owner Email *</Label>
                        <Input 
                          type="email" 
                          name="ownerEmail" 
                          value={formData.ownerEmail} 
                          onChange={handleChange} 
                          placeholder="Enter owner email"
                          required
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Pet Type *</Label>
                        <Select 
                          name="petType" 
                          value={formData.petType} 
                          onChange={handleChange} 
                          required
                        >
                          <option value="dog">🐶 Dog</option>
                          <option value="cat">🐱 Cat</option>
                        </Select>
                      </FormGroup>
                      <FormGroup>
                        <Label>Breed</Label>
                        <Select 
                          name="breed" 
                          value={formData.breed} 
                          onChange={handleChange}
                        >
                          <option value="">Select Breed</option>
                          {(PET_BREEDS[formData.petType as keyof typeof PET_BREEDS] || []).map(breed => (
                            <option key={breed} value={breed}>{breed}</option>
                          ))}
                        </Select>
                      </FormGroup>
                      <FormGroup>
                        <Label>Age</Label>
                        <Input 
                          type="text" 
                          name="petAge" 
                          value={formData.petAge} 
                          onChange={handleChange} 
                          placeholder="e.g., 2 years, 6 months"
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Birth Date</Label>
                        <Input 
                          type="date" 
                          name="birthDate" 
                          value={formData.birthDate} 
                          onChange={handleChange} 
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Gender</Label>
                        <Select 
                          name="gender" 
                          value={formData.gender} 
                          onChange={handleChange}
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </Select>
                      </FormGroup>
                      <FormGroup>
                        <Label>Color</Label>
                        <Input 
                          type="text" 
                          name="color" 
                          value={formData.color} 
                          onChange={handleChange} 
                          placeholder="e.g., Brown, Black, White"
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Weight</Label>
                        <Input 
                          type="text" 
                          name="weight" 
                          value={formData.weight} 
                          onChange={handleChange} 
                          placeholder="e.g., 5 kg, 12 lbs"
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Allergies</Label>
                        <TextArea 
                          name="allergies" 
                          value={formData.allergies} 
                          onChange={handleChange} 
                          placeholder="List any known allergies"
                          rows={2}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Existing Conditions</Label>
                        <TextArea 
                          name="existingConditions" 
                          value={formData.existingConditions} 
                          onChange={handleChange} 
                          placeholder="List any pre-existing medical conditions"
                          rows={2}
                        />
                      </FormGroup>
                    </EditableGrid>
                  )}
                </FormSection>

                {/* Medical Information Section - REQUIRED and EDITABLE */}
                <FormSection>
                  <SectionTitle>Medical Information *</SectionTitle>
                  <FormRow>
                    <FormGroup>
                      <Label>Diagnosis *</Label>
                      <Select 
                        name="diagnosis" 
                        value={formData.diagnosis} 
                        onChange={handleChange} 
                        required
                      >
                        <option value="">Select Diagnosis</option>
                        {(DIAGNOSIS_OPTIONS[formData.petType as keyof typeof DIAGNOSIS_OPTIONS] || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="Other">Other (Specify in notes)</option>
                      </Select>
                      {formData.appointmentType && (
                        <FieldHelp>Based on appointment: {formData.appointmentType}</FieldHelp>
                      )}
                    </FormGroup>
                    <FormGroup>
                      <Label>Treatment *</Label>
                      <Select 
                        name="treatment" 
                        value={formData.treatment} 
                        onChange={handleChange} 
                        required
                      >
                        <option value="">Select Treatment</option>
                        {(TREATMENT_OPTIONS[formData.petType as keyof typeof TREATMENT_OPTIONS] || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="Other">Other (Specify in notes)</option>
                      </Select>
                      {formData.appointmentType && (
                        <FieldHelp>Based on appointment: {formData.appointmentType}</FieldHelp>
                      )}
                    </FormGroup>
                  </FormRow>
                  
                  <FormRow>
                    <FormGroup>
                      <Label>Date of Visit *</Label>
                      <Input 
                        type="date" 
                        name="date" 
                        value={formData.date} 
                        onChange={handleChange} 
                        required
                        readOnly={isFromAppointment}
                      />
                      {isFromAppointment && (
                        <FieldHelp>Auto-filled from appointment</FieldHelp>
                      )}
                    </FormGroup>
                    <FormGroup>
                      <Label>Veterinarian *</Label>
                      <Input 
                        name="veterinarian" 
                        value={formData.veterinarian} 
                        onChange={handleChange} 
                        placeholder="Name of attending veterinarian"
                        required
                      />
                    </FormGroup>
                  </FormRow>
                  
                  <FormGroup>
                    <Label>Notes <OptionalText>(optional)</OptionalText></Label>
                    <TextArea 
                      name="notes" 
                      value={formData.notes} 
                      onChange={handleChange} 
                      placeholder="Additional notes about the treatment, condition, or any special instructions" 
                      rows={4}
                    />
                    {isFromAppointment && (
                      <FieldHelp>Auto-filled with appointment details. Add any additional information here.</FieldHelp>
                    )}
                  </FormGroup>

                  {isFromAppointment && (
                    <FormGroup>
                      <Label>Appointment Information</Label>
                      <AppointmentInfoBox>
                        <InfoRow>
                          <InfoLabel>Appointment Type:</InfoLabel>
                          <InfoValue>{formData.appointmentType}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                          <InfoLabel>Appointment ID:</InfoLabel>
                          <InfoValue>{formData.appointmentId}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                          <InfoLabel>Pet Type:</InfoLabel>
                          <InfoValue>{formData.petType === 'dog' ? '🐶 Dog' : '🐱 Cat'}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                          <InfoLabel>Status:</InfoLabel>
                          <InfoValue>Completed Appointment</InfoValue>
                        </InfoRow>
                      </AppointmentInfoBox>
                    </FormGroup>
                  )}
                </FormSection>
                
                <ButtonGroupForm>
                  {/* ✅ UPDATED: Disable button when submitting */}
                  <SaveButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "⏳ Saving..." : (editingRecord ? "Update Record" : "💾 Save Medical Record")}
                  </SaveButton>
                  <CancelButton type="button" onClick={resetForm} disabled={isSubmitting}>
                    Cancel
                  </CancelButton>
                </ButtonGroupForm>
              </Form>
            </FormCard>
          ) : (
            <>
              <SectionHeader>
                <SectionTitleMain>Medical Records Management</SectionTitleMain>
                <FilterSection>
                  <SearchInput 
                    type="text" 
                    placeholder="🔍 Search by pet or owner name" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <FilterSelect value={filterPetType} onChange={(e) => setFilterPetType(e.target.value)}>
                    <option value="all">All Pets</option>
                    <option value="dog">Dogs Only</option>
                    <option value="cat">Cats Only</option>
                  </FilterSelect>
                  <FilterSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </FilterSelect>
                  <RefreshButton onClick={() => window.location.reload()}>
                    ↻ Refresh
                  </RefreshButton>
                </FilterSection>
              </SectionHeader>
              
              <RecordsStats>
                <StatCard>
                  <StatNumber>{records.length}</StatNumber>
                  <StatLabel>Total Records</StatLabel>
                </StatCard>
                <StatCard $highlight>
                  <StatNumber>{pendingRecords.length}</StatNumber>
                  <StatLabel>Pending Completion</StatLabel>
                </StatCard>
                <StatCard>
                  <StatNumber>{completedRecords.length}</StatNumber>
                  <StatLabel>Completed</StatLabel>
                </StatCard>
                <StatCard>
                  <StatNumber>{availableAppointments.length}</StatNumber>
                  <StatLabel>Available Appointments</StatLabel>
                </StatCard>
              </RecordsStats>

              {pendingRecords.length > 0 && filterStatus !== "completed" && (
                <>
                  <PendingSection>
                    <PendingSectionTitle>
                      Pending Completion ({pendingRecords.length})
                      <PendingBadge>Action Required</PendingBadge>
                    </PendingSectionTitle>
                  </PendingSection>
                  
                  <RecordsGrid>
                    {pendingRecords.filter(record => {
                      const matchesSearch = record.petName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          record.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesPetType = filterPetType === "all" || record.petType === filterPetType;
                      return matchesSearch && matchesPetType;
                    }).map(record => (
                      <RecordCard key={record.id} $isPending>
                        <PendingIndicator>Needs Completion</PendingIndicator>
                        <CardHeader>
                          <div>
                            <PetName>{record.petName}</PetName>
                            <OwnerName>{record.ownerName || record.ownerEmail}</OwnerName>
                            {record.appointmentId && (
                              <AppointmentBadge>From Appointment</AppointmentBadge>
                            )}
                          </div>
                          <PetTypeBadge $petType={record.petType}>
                            {record.petType === 'dog' ? '🐶 Dog' : '🐱 Cat'}
                          </PetTypeBadge>
                        </CardHeader>
                        
                        <CardContent>
                          <DetailItem>
                            <DetailLabel>Breed:</DetailLabel>
                            <DetailValue>{record.breed || 'Not specified'}</DetailValue>
                          </DetailItem>
                          <DetailItem>
                            <DetailLabel>Age:</DetailLabel>
                            <DetailValue>{record.petAge || 'Not specified'}</DetailValue>
                          </DetailItem>
                          <DetailItem>
                            <DetailLabel>Gender:</DetailLabel>
                            <DetailValue>{record.gender || 'Not specified'}</DetailValue>
                          </DetailItem>
                          <DetailItem>
                            <DetailLabel>Weight:</DetailLabel>
                            <DetailValue>{record.weight || 'Not specified'}</DetailValue>
                          </DetailItem>
                          <DetailItem>
                            <DetailLabel>Visit Date:</DetailLabel>
                            <DetailValue>{formatDateDisplay(record.date)}</DetailValue>
                          </DetailItem>
                          
                          <MissingInfo>
                            ⚠️ Missing: {!record.diagnosis && "Diagnosis, "}{!record.treatment && "Treatment, "}{!record.veterinarian && "Veterinarian"}
                          </MissingInfo>
                        </CardContent>
                        
                        <CardActions>
                          {/* ✅ UPDATED: Add loading state to buttons */}
                          <CompleteButton 
                            onClick={(e) => handleEdit(record, e)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "⏳ Loading..." : "✓ Complete Record"}
                          </CompleteButton>
                          <EditButton 
                            onClick={(e) => handleEdit(record, e)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "⏳" : "✏️ Edit"}
                          </EditButton>
                        </CardActions>
                      </RecordCard>
                    ))}
                  </RecordsGrid>
                </>
              )}

              {filterStatus !== "pending" && (
                <>
                  <CompletedSection>
                    <CompletedSectionTitle>
                      Completed Records ({completedRecords.length})
                    </CompletedSectionTitle>
                  </CompletedSection>
                  
                  <RecordsGrid>
                    {filteredRecords.filter(r => r.status === "completed").length === 0 ? (
                      <EmptyState>
                        <EmptyText>No completed records found</EmptyText>
                        <EmptySubtext>
                          {searchTerm || filterPetType !== "all" || filterStatus !== "all"
                            ? "Try adjusting your search or filter" 
                            : "Complete pending records or add new ones"}
                        </EmptySubtext>
                      </EmptyState>
                    ) : (
                      filteredRecords.filter(r => r.status === "completed").map(record => (
                        <RecordCard key={record.id}>
                          <CardHeader>
                            <div>
                              <PetName>{record.petName}</PetName>
                              <OwnerName>{record.ownerName}</OwnerName>
                              {record.appointmentId && (
                                <AppointmentBadge>From Appointment</AppointmentBadge>
                              )}
                              {record.appointmentType && (
                                <AppointmentTypeBadge>
                                  {APPOINTMENT_TYPE_LABELS[record.appointmentType] || record.appointmentType}
                                </AppointmentTypeBadge>
                              )}
                            </div>
                            <PetTypeBadge $petType={record.petType}>
                              {record.petType === 'dog' ? '🐶 Dog' : '🐱 Cat'}
                            </PetTypeBadge>
                          </CardHeader>
                          
                          <CardContent>
                            <DetailItem>
                              <DetailLabel>Breed:</DetailLabel>
                              <DetailValue>{record.breed}</DetailValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Date:</DetailLabel>
                              <DetailValue>{formatDateDisplay(record.date)}</DetailValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Weight:</DetailLabel>
                              <DetailValue>{record.weight || 'Not specified'}</DetailValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Allergies:</DetailLabel>
                              <DetailValue>{record.allergies || 'Not specified'}</DetailValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Conditions:</DetailLabel>
                              <DetailValue>{record.existingConditions || 'Not specified'}</DetailValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Diagnosis:</DetailLabel>
                              <DiagnosisValue>{record.diagnosis}</DiagnosisValue>
                            </DetailItem>
                            <DetailItem>
                              <DetailLabel>Treatment:</DetailLabel>
                              <TreatmentValue>{record.treatment}</TreatmentValue>
                            </DetailItem>
                            {record.veterinarian && (
                              <DetailItem>
                                <DetailLabel>Veterinarian:</DetailLabel>
                                <DetailValue>{record.veterinarian}</DetailValue>
                              </DetailItem>
                            )}
                            {record.notes && (
                              <DetailItem>
                                <DetailLabel>Notes:</DetailLabel>
                                <NotesValue>{record.notes}</NotesValue>
                              </DetailItem>
                            )}
                          </CardContent>
                          
                          <CardActions>
                            <EditButton 
                              onClick={(e) => handleEdit(record, e)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? "⏳" : "✏️ Edit"}
                            </EditButton>
                          </CardActions>
                        </RecordCard>
                      ))
                    )}
                  </RecordsGrid>
                </>
              )}
            </>
          )}
        </Content>

        {showAppointmentModal && (
          <ModalOverlay onClick={() => setShowAppointmentModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Select Completed Appointment ({availableAppointments.length} available)</ModalTitle>
                <CloseButton onClick={() => setShowAppointmentModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <ModalContent>
                {availableAppointments.length === 0 ? (
                  <NoAppointmentsMessage>
                    No available appointments found. All completed appointments have been processed.
                  </NoAppointmentsMessage>
                ) : (
                  <AppointmentsList>
                    {availableAppointments.map(appointment => (
                      <AppointmentCard 
                        key={appointment.id}
                        onClick={() => handleCreateFromAppointment(appointment)}
                      >
                        <AppointmentInfoSection>
                          <AppointmentPetName>{appointment.petName}</AppointmentPetName>
                          <AppointmentDetails>
                            <InfoRow>
                              <InfoLabel>Date:</InfoLabel>
                              <InfoValue>{formatDateDisplay(appointment.date)}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                              <InfoLabel>Service:</InfoLabel>
                              <InfoValue>{APPOINTMENT_TYPE_LABELS[appointment.appointmentType] || appointment.appointmentType}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                              <InfoLabel>Owner:</InfoLabel>
                              <InfoValue>{appointment.clientName}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                              <InfoLabel>Pet Type:</InfoLabel>
                              <InfoValue>
                                {getPetTypeFromAppointment(appointment) === 'dog' ? '🐶 Dog' : '🐱 Cat'}
                                {appointment.petType !== getPetTypeFromAppointment(appointment) && 
                                  ` (Validated from: ${appointment.petType})`}
                              </InfoValue>
                            </InfoRow>
                            <InfoRow>
                              <InfoLabel>Breed:</InfoLabel>
                              <InfoValue>{getBreedFromAppointment(appointment) || 'Not specified'}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                              <InfoLabel>Age:</InfoLabel>
                              <InfoValue>{getAgeFromAppointment(appointment) || 'Not specified'}</InfoValue>
                            </InfoRow>
                            {appointment.birthDate && (
                              <InfoRow>
                                <InfoLabel>Birth Date:</InfoLabel>
                                <InfoValue>{formatDateDisplay(appointment.birthDate)}</InfoValue>
                              </InfoRow>
                            )}
                            {appointment.weight && (
                              <InfoRow>
                                <InfoLabel>Weight:</InfoLabel>
                                <InfoValue>{appointment.weight}</InfoValue>
                              </InfoRow>
                            )}
                            {appointment.gender && (
                              <InfoRow>
                                <InfoLabel>Gender:</InfoLabel>
                                <InfoValue>{appointment.gender}</InfoValue>
                              </InfoRow>
                            )}
                            {appointment.color && (
                              <InfoRow>
                                <InfoLabel>Color:</InfoLabel>
                                <InfoValue>{appointment.color}</InfoValue>
                              </InfoRow>
                            )}
                            {appointment.allergies && (
                              <InfoRow>
                                <InfoLabel>Allergies:</InfoLabel>
                                <InfoValue>{appointment.allergies}</InfoValue>
                              </InfoRow>
                            )}
                            {appointment.existingConditions && (
                              <InfoRow>
                                <InfoLabel>Conditions:</InfoLabel>
                                <InfoValue>{appointment.existingConditions}</InfoValue>
                              </InfoRow>
                            )}
                          </AppointmentDetails>
                        </AppointmentInfoSection>
                        <SelectButton>🎯 Use This Appointment</SelectButton>
                      </AppointmentCard>
                    ))}
                  </AppointmentsList>
                )}
              </ModalContent>
            </ModalContainer>
          </ModalOverlay>
        )}
      </PageContainer>
    </>
  );
};

export default MedicalRecord;

// Styled Components (same as before)
// ... (keep all the styled components the same)

// Styled Components (same as before)
const LoadingContainer = styled.div`
  padding: 2rem;
  text-align: center;
  font-size: 1.1rem;
  color: #64748b;
`;

const PageContainer = styled.div`
  min-height: 100vh;
  background-color: #f8fafc;
`;

const HeaderBar = styled.header`
  background: #34B89C;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
`;

const BrandSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ClinicLogo = styled.div`
  font-size: 2.5rem;
`;

const LogoImage = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
`;

const ClinicName = styled.h1`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
`;

const Tagline = styled.p`
  margin: 0.25rem 0 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
`;

const UserInfo = styled.div`
  font-size: 0.8rem;
  opacity: 0.8;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const RefreshTokenButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }
`;

const CreateButton = styled.button`
  background: #8b5cf6;
  border: none;
  color: white;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: #7c3aed;
  }
`;

const AddButton = styled.button`
  background: #10b981;
  border: none;
  color: white;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: #059669;
  }
`;

const Content = styled.main`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const FormCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  margin: 0 0 1.5rem 0;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AutoFillBadge = styled.span`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 1rem;
`;

const FormHelpText = styled.span`
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 400;
`;

const StatusInfo = styled.div<{ $status: string }>`
  background: ${props => props.$status === "pending" ? "#fef3c7" : "#f0fdf4"};
  color: ${props => props.$status === "pending" ? "#92400e" : "#065f46"};
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 0.5rem;
  border-left: 4px solid ${props => props.$status === "pending" ? "#f59e0b" : "#10b981"};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormSection = styled.div`
  background: #f8fafc;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
`;

const SectionTitle = styled.h4`
  margin: 0 0 1rem 0;
  color: #1e293b;
  font-size: 1.1rem;
  font-weight: 600;
  border-bottom: 2px solid #34B89C;
  padding-bottom: 0.5rem;
  display: flex;
  align-items: center;
`;

const AutoFillIndicator = styled.span`
  background: #10b981;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 1rem;
`;

const EditableSection = styled.div`
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
`;

const EditableGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
`;

const ReadOnlyField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ReadOnlyLabel = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
`;

const ReadOnlyValue = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  padding: 0.5rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
`;

const OptionalText = styled.span`
  color: #6b7280;
  font-weight: 400;
  font-size: 0.8rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.15);
  }
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.15);
  }
`;

const TextArea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.15);
  }
`;

const FieldHelp = styled.small`
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  display: block;
`;

const AppointmentInfoBox = styled.div`
  background: #e0e7ff;
  color: #3730a3;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  border-left: 4px solid #4f46e5;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoLabel = styled.span`
  font-weight: 600;
  color: #374151;
`;

const InfoValue = styled.span`
  color: #1e293b;
  text-align: right;
`;

const ButtonGroupForm = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

const SaveButton = styled.button`
  background: #34B89C;
  border: none;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #2a947c;
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const CancelButton = styled.button`
  background: #6b7280;
  border: none;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #4b5563;
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SectionTitleMain = styled.h3`
  margin: 0;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 600;
`;

const FilterSection = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.15);
  }
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: #34B89C;
  }
`;

const RefreshButton = styled.button`
  background: #6BC1E1;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;

  &:hover {
    background: #59a7c5;
  }
`;

const RecordsStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div<{$highlight?: boolean}>`
  background: ${props => props.$highlight ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 'white'};
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
  border-top: 4px solid ${props => props.$highlight ? '#f59e0b' : '#34B89C'};
`;

const StatNumber = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: #34B89C;
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  color: #64748b;
  font-size: 0.9rem;
`;

const SuccessMessage = styled.div`
  background: #f0fdf4;
  color: #16a34a;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 2rem;
  border: 1px solid #bbf7d0;
`;

const ErrorMessage = styled.div`
  background: #fef2f2;
  color: #dc2626;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 2rem;
  border: 1px solid #fecaca;
`;

const PendingSection = styled.div`
  margin: 2rem 0 1rem 0;
`;

const PendingSectionTitle = styled.h3`
  color: #92400e;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const PendingBadge = styled.span`
  background: #dc2626;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
`;

const CompletedSection = styled.div`
  margin: 2rem 0 1rem 0;
`;

const CompletedSectionTitle = styled.h3`
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
`;

const RecordsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
`;

const RecordCard = styled.div<{$isPending?: boolean}>`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  border-top: 4px solid ${props => props.$isPending ? '#f59e0b' : '#6BC1E1'};
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const PendingIndicator = styled.div`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: #dc2626;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const PetName = styled.h4`
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
`;

const OwnerName = styled.p`
  margin: 0.25rem 0 0 0;
  color: #64748b;
  font-size: 0.9rem;
`;

const AppointmentBadge = styled.span`
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
  display: inline-block;
`;

const AppointmentTypeBadge = styled.span`
  background: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
  display: inline-block;
  margin-left: 0.5rem;
`;

const PetTypeBadge = styled.span<{ $petType: string }>`
  background: ${props => props.$petType === 'dog' ? '#dbeafe' : '#fce7f3'};
  color: ${props => props.$petType === 'dog' ? '#1d4ed8' : '#be185d'};
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
`;

const DetailLabel = styled.span`
  font-weight: 500;
  color: #475569;
`;

const DetailValue = styled.span`
  color: #1e293b;
`;

const DiagnosisValue = styled.span`
  color: #dc2626;
  font-weight: 600;
`;

const TreatmentValue = styled.span`
  color: #059669;
  font-weight: 600;
`;

const NotesValue = styled.span`
  font-style: italic;
  color: #334155;
`;

const MissingInfo = styled.div`
  background: #fef2f2;
  color: #991b1b;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  border-left: 3px solid #dc2626;
`;

const CardActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  position: relative;
  z-index: 20;
  pointer-events: auto;
`;

const EditButton = styled.button`
  background: #6BC1E1;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  min-width: 80px;
  position: relative;
  z-index: 10;

  &:hover:not(:disabled) {
    background: #59a7c5;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const CompleteButton = styled.button`
  background: #f59e0b;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 140px;
  position: relative;
  z-index: 10;

  &:hover:not(:disabled) {
    background: #d97706;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const EmptyState = styled.div`
  grid-column: 1 / -1;
  background: white;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  color: #475569;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
`;

const EmptyText = styled.h4`
  font-size: 1.25rem;
  margin: 0.5rem 0;
  color: #1e293b;
`;

const EmptySubtext = styled.p`
  margin: 0.25rem 0 1.5rem 0;
  font-size: 0.9rem;
  color: #64748b;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;

  &:hover {
    background: #f1f5f9;
  }
`;

const ModalContent = styled.div`
  padding: 1.5rem;
`;

const NoAppointmentsMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: #64748b;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const AppointmentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const AppointmentCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const AppointmentInfoSection = styled.div`
  flex: 1;
`;

const AppointmentPetName = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
`;

const AppointmentDetails = styled.div`
  color: #64748b;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const SelectButton = styled.button`
  background: #8b5cf6;
  border: none;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  margin-left: 1rem;

  &:hover {
    background: #7c3aed;
  }
`;