'use client';

import React, { useState, useEffect, useCallback } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { db, auth } from "../firebaseConfig";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from "firebase/firestore";
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
  createdAt: any;
  status?: string;
  petId?: string;
  appointmentId?: string;
  appointmentStatus?: string;
  appointmentType?: string;
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

const GENDER_OPTIONS = ["Male", "Female", "Neutered Male", "Spayed Female"];

const APPOINTMENT_TYPE_MAPPINGS: Record<string, {diagnosis: string, treatment: string}> = {
  "Vaccination": { diagnosis: "Vaccination", treatment: "Vaccination" },
  "Check Up": { diagnosis: "General Consultation", treatment: "Physical Examination" },
  "Anti Rabies": { diagnosis: "Rabies Vaccination", treatment: "Vaccination" },
  "Ultrasound": { diagnosis: "Diagnostic Imaging", treatment: "Ultrasound Procedure" },
  "Grooming": { diagnosis: "Grooming Service", treatment: "Professional Grooming" },
  "Spay/Neuter": { diagnosis: "Sterilization", treatment: "Surgery" },
  "Deworming": { diagnosis: "Parasitic Infection", treatment: "Deworming" },
  "Initial Registration": { diagnosis: "General Consultation", treatment: "Physical Examination" }
};

const sanitizeFirestoreData = (data: Record<string, unknown>) => {
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) delete sanitized[key];
  });
  return sanitized;
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
    status: "completed"
  });

  const [isFromAppointment, setIsFromAppointment] = useState(false);
  const [isFromRegistration, setIsFromRegistration] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setRecords([]);
        setLoading(false);
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAppointments = useCallback(async () => {
    try {
      const q = query(collection(db, "appointments"), where("status", "==", "Done"));
      const querySnapshot = await getDocs(q);
      const appointmentsData: Appointment[] = [];
      
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        appointmentsData.push({ 
          id: docSnap.id, 
          petName: data.petName || "",
          date: data.date || "",
          timeSlot: data.timeSlot || "",
          status: data.status || "",
          clientName: data.clientName || "",
          appointmentType: data.appointmentType || "",
          petType: data.petType || "dog",
          breed: data.breed || "",
          petAge: data.petAge || "",
          birthDate: data.birthDate || "",
          weight: data.weight || "",
          gender: data.gender || "",
          color: data.color || "",
          allergies: data.allergies || "",
          existingConditions: data.existingConditions || ""
        } as Appointment);
      });
      
      appointmentsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppointments(appointmentsData);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }, []);

  const fetchMedicalRecords = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "medicalRecords"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const recordsData: MedicalRecord[] = [];
      
      querySnapshot.forEach(docSnap => {
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
          status: data.status || "completed",
          petId: data.petId || "",
          createdAt: data.createdAt || null
        } as MedicalRecord);
      });
      
      setRecords(recordsData);
    } catch (error) {
      console.error("Error fetching medical records:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchMedicalRecords();
      fetchAppointments();
    }
  }, [currentUser, fetchMedicalRecords, fetchAppointments]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // I-disable lang ang pag-edit ng petName at date kapag galing sa appointment
    if ((isFromAppointment || isFromRegistration) && 
        (name === "petName" || name === "date")) {
      return;
    }
    
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

  const handleCreateFromAppointment = (appointment: Appointment) => {
    const appointmentMapping = APPOINTMENT_TYPE_MAPPINGS[appointment.appointmentType] || {};
    
    setFormData({
      petName: appointment.petName,
      date: appointment.date,
      petType: appointment.petType || "dog",
      breed: appointment.breed || "",
      appointmentType: appointment.appointmentType || "",
      appointmentId: appointment.id,
      petAge: appointment.petAge || "",
      birthDate: appointment.birthDate || "",
      weight: appointment.weight || "",
      gender: appointment.gender || "",
      color: appointment.color || "",
      allergies: appointment.allergies || "",
      existingConditions: appointment.existingConditions || "",
      diagnosis: appointmentMapping.diagnosis || "",
      treatment: appointmentMapping.treatment || "",
      ownerName: appointment.clientName || "",
      ownerEmail: "",
      notes: "",
      veterinarian: "",
      status: "completed"
    });
    
    setIsFromAppointment(true);
    setIsFromRegistration(false);
    setShowAppointmentModal(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please login first!");
      return;
    }

    const sanitizedData = sanitizeFirestoreData({
      ...formData,
      status: "completed",
      updatedAt: new Date()
    });

    try {
      if (editingRecord) {
        await updateDoc(doc(db, "medicalRecords", editingRecord.id), sanitizedData);
        setSuccessMessage("Medical record completed successfully!");
      } else {
        await addDoc(collection(db, "medicalRecords"), {
          ...sanitizedData,
          createdAt: new Date()
        });
        setSuccessMessage("Medical record added successfully!");
      }

      resetForm();
      fetchMedicalRecords();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error saving medical record:", error);
      alert("Failed to save medical record. Please try again.");
    }
  };

  const handleEdit = (record: MedicalRecord) => {
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
      status: record.status || "completed"
    });
    setIsFromAppointment(!!record.appointmentId);
    setIsFromRegistration(record.status === "pending_completion");
    setEditingRecord(record);
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    
    try {
      await deleteDoc(doc(db, "medicalRecords", id));
      setSuccessMessage("Record deleted successfully!");
      fetchMedicalRecords();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Failed to delete record. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'});
    } catch {
      return "Invalid date";
    }
  };

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
      status: "completed"
    });
    setIsFromAppointment(false);
    setIsFromRegistration(false);
    setEditingRecord(null);
    setShowForm(false);
  };

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
  const completedRecords = records.filter(r => r.status === "completed" || !r.status);

  if (loading) return <><GlobalStyle /><LoadingContainer>Loading medical records...</LoadingContainer></>;

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <ClinicLogo>🐾</ClinicLogo>
            <div>
              <ClinicName>RL Clinic</ClinicName>
              <Tagline>Fursure Care - Medical Records (Admin)</Tagline>
            </div>
          </BrandSection>
          <ButtonGroup>
            <BackButton onClick={() => router.push("/admindashboard")}>
              ← Back
            </BackButton>
            {appointments.length > 0 && (
              <CreateButton onClick={() => setShowAppointmentModal(true)}>
                📅 From Appointment
              </CreateButton>
            )}
            <AddButton onClick={resetForm}>
              + Add Record
            </AddButton>
          </ButtonGroup>
        </HeaderBar>

        {successMessage && <SuccessMessage>✓ {successMessage}</SuccessMessage>}

        <Content>
          {showForm ? (
            <FormCard>
              <Title>
                {editingRecord ? "Edit Medical Record" : "Add New Medical Record"}
                <FormHelpText>Please fill in all required fields marked with *</FormHelpText>
                {isFromRegistration && (
                  <RegistrationInfo>
                    📋 Completing record from pet registration - Pet details are pre-filled
                  </RegistrationInfo>
                )}
                {isFromAppointment && !isFromRegistration && (
                  <AppointmentInfo>
                    📋 Creating record from completed appointment - Pet details are auto-filled
                  </AppointmentInfo>
                )}
              </Title>
              
              <Form onSubmit={handleSubmit}>
                <FormRow>
                  <FormGroup>
                    <Label>Pet Name *</Label>
                    <Input 
                      name="petName" 
                      value={formData.petName} 
                      onChange={handleChange} 
                      required 
                      placeholder="Enter pet name"
                      disabled={isFromAppointment || isFromRegistration}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label>Owner Name *</Label>
                    <Input 
                      name="ownerName" 
                      value={formData.ownerName} 
                      onChange={handleChange} 
                      required 
                      placeholder="Enter owner name"
                    />
                  </FormGroup>
                </FormRow>

                <FormGroup>
                  <Label>Owner Email *</Label>
                  <Input 
                    name="ownerEmail" 
                    value={formData.ownerEmail} 
                    onChange={handleChange} 
                    required 
                    placeholder="Enter owner email"
                    type="email"
                  />
                </FormGroup>
                
                <FormRow>
                  <FormGroup>
                    <Label>Pet Age</Label>
                    <Input 
                      name="petAge" 
                      value={formData.petAge} 
                      onChange={handleChange} 
                      placeholder="e.g., 3 years"
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
                    <Label>Weight</Label>
                    <Input 
                      name="weight" 
                      value={formData.weight} 
                      onChange={handleChange} 
                      placeholder="e.g., 5 kg"
                    />
                  </FormGroup>
                </FormRow>
                
                <FormRow>
                  <FormGroup>
                    <Label>Gender</Label>
                    <Select 
                      name="gender" 
                      value={formData.gender} 
                      onChange={handleChange}
                    >
                      <option value="">Select Gender</option>
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label>Color/Markings</Label>
                    <Input 
                      name="color" 
                      value={formData.color} 
                      onChange={handleChange} 
                      placeholder="e.g., Brown with white patches"
                    />
                  </FormGroup>
                </FormRow>
                
                <FormRow>
                  <FormGroup>
                    <Label>Pet Type *</Label>
                    <Select 
                      name="petType" 
                      value={formData.petType} 
                      onChange={handleChange}
                    >
                      <option value="dog">Dog</option>
                      <option value="cat">Cat</option>
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label>Breed *</Label>
                    <Select 
                      name="breed" 
                      value={formData.breed} 
                      onChange={handleChange} 
                      required
                    >
                      <option value="">Select Breed</option>
                      {(PET_BREEDS[formData.petType as keyof typeof PET_BREEDS] || []).map(breed => (
                        <option key={breed} value={breed}>{breed}</option>
                      ))}
                    </Select>
                  </FormGroup>
                </FormRow>

                <FormRow>
                  <FormGroup>
                    <Label>Allergies</Label>
                    <Input 
                      name="allergies" 
                      value={formData.allergies} 
                      onChange={handleChange} 
                      placeholder="List any known allergies"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label>Existing Conditions</Label>
                    <Input 
                      name="existingConditions" 
                      value={formData.existingConditions} 
                      onChange={handleChange} 
                      placeholder="Any pre-existing health conditions"
                    />
                  </FormGroup>
                </FormRow>
                
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
                    </Select>
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
                    </Select>
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
                      disabled={isFromAppointment || isFromRegistration}
                    />
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
                  <Label>Notes</Label>
                  <TextArea 
                    name="notes" 
                    value={formData.notes} 
                    onChange={handleChange} 
                    placeholder="Additional notes about the treatment or condition" 
                    rows={4}
                  />
                </FormGroup>
                
                <ButtonGroupForm>
                  <SaveButton type="submit">
                    {editingRecord ? "Update Record" : "Complete & Save Record"}
                  </SaveButton>
                  <CancelButton type="button" onClick={resetForm}>
                    Cancel
                  </CancelButton>
                </ButtonGroupForm>
              </Form>
            </FormCard>
          ) : (
            <>
              <SectionHeader>
                <SectionTitle>Medical Records Management</SectionTitle>
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
                  <RefreshButton onClick={fetchMedicalRecords}>
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
                  <StatNumber>{appointments.length}</StatNumber>
                  <StatLabel>Done Appointments</StatLabel>
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
                            <RegistrationBadge>From Pet Registration</RegistrationBadge>
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
                            <DetailLabel>Registration Date:</DetailLabel>
                            <DetailValue>{formatDate(record.date)}</DetailValue>
                          </DetailItem>
                          
                          <MissingInfo>
                            ⚠️ Missing: Diagnosis, Treatment, Veterinarian
                          </MissingInfo>
                        </CardContent>
                        
                        <CardActions>
                          <CompleteButton onClick={() => handleEdit(record)}>
                            ✓ Complete Record
                          </CompleteButton>
                          <DeleteButton onClick={() => handleDelete(record.id)}>
                            Delete
                          </DeleteButton>
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
                    {filteredRecords.filter(r => r.status === "completed" || !r.status).length === 0 ? (
                      <EmptyState>
                        <EmptyText>No completed records found</EmptyText>
                        <EmptySubtext>
                          {searchTerm || filterPetType !== "all" 
                            ? "Try adjusting your search or filter" 
                            : "Complete pending records or add new ones"}
                        </EmptySubtext>
                      </EmptyState>
                    ) : (
                      filteredRecords.filter(r => r.status === "completed" || !r.status).map(record => (
                        <RecordCard key={record.id}>
                          <CardHeader>
                            <div>
                              <PetName>{record.petName}</PetName>
                              <OwnerName>{record.ownerName}</OwnerName>
                              {record.appointmentId && (
                                <AppointmentBadge>From Appointment</AppointmentBadge>
                              )}
                              {record.appointmentType && (
                                <AppointmentTypeBadge>{record.appointmentType}</AppointmentTypeBadge>
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
                              <DetailValue>{formatDate(record.date)}</DetailValue>
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
                            <ActionButton onClick={() => handleEdit(record)}>
                              Edit
                            </ActionButton>
                            <DeleteButton onClick={() => handleDelete(record.id)}>
                              Delete
                            </DeleteButton>
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
                <ModalTitle>Select Completed Appointment</ModalTitle>
                <CloseButton onClick={() => setShowAppointmentModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <ModalContent>
                {appointments.length === 0 ? (
                  <NoAppointmentsMessage>
                    No completed appointments available
                  </NoAppointmentsMessage>
                ) : (
                  <AppointmentsList>
                    {appointments.map(appointment => (
                      <AppointmentCard 
                        key={appointment.id}
                        onClick={() => handleCreateFromAppointment(appointment)}
                      >
                        <AppointmentInfoSection>
                          <AppointmentPetName>{appointment.petName}</AppointmentPetName>
                          <AppointmentDetails>
                            <div><strong>Date:</strong> {formatDate(appointment.date)}</div>
                            <div><strong>Service:</strong> {appointment.appointmentType}</div>
                            <div><strong>Pet Type:</strong> {appointment.petType || 'Not specified'}</div>
                            <div><strong>Breed:</strong> {appointment.breed || 'Not specified'}</div>
                          </AppointmentDetails>
                        </AppointmentInfoSection>
                        <SelectButton>Select</SelectButton>
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
  background: linear-gradient(135deg, #34B89C 0%, #6BC1E1 100%);
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

const FormHelpText = styled.span`
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 400;
`;

const RegistrationInfo = styled.div`
  background: #fef3c7;
  color: #92400e;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 0.5rem;
  border-left: 4px solid #f59e0b;
`;

const AppointmentInfo = styled.div`
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 0.5rem;
  border-left: 4px solid #4f46e5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

  &:disabled {
    background-color: #f3f4f6;
    color: #6b7280;
    cursor: not-allowed;
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

  &:disabled {
    background-color: #f3f4f6;
    color: #6b7280;
    cursor: not-allowed;
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

  &:hover {
    background: #2a947c;
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

  &:hover {
    background: #4b5563;
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

const SectionTitle = styled.h3`
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

const RegistrationBadge = styled.span`
  background: #fef3c7;
  color: #92400e;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
  display: inline-block;
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
`;

const ActionButton = styled.button`
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

  &:hover {
    background: #d97706;
  }
`;

const DeleteButton = styled.button`
  background: #ef4444;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;

  &:hover {
    background: #dc2626;
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
  max-width: 600px;
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
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    border-color: #8b5cf6;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
  }
`;

const AppointmentInfoSection = styled.div`
  flex: 1;
`;

const AppointmentPetName = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 1rem;
  margin-bottom: 0.5rem;
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
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;

  &:hover {
    background: #7c3aed;
  }
`;