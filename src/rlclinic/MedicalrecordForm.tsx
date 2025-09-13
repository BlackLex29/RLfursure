'use client';

import React, { useState, useEffect, useCallback } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { db } from "../firebaseConfig";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

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
  createdAt: Timestamp | null;
}

const DIAGNOSIS_OPTIONS = {
  dog: ["Parvovirus","Distemper","Kennel Cough","Heartworm","Arthritis","Dental Disease","Ear Infection","Skin Allergies","Obesity","Gastroenteritis"],
  cat: ["Feline Leukemia Virus","Feline Immunodeficiency Virus","Upper Respiratory Infection","Urinary Tract Disease","Chronic Kidney Disease","Diabetes","Hyperthyroidism","Dental Disease","Fleas and Ticks","Ringworm"]
};

const TREATMENT_OPTIONS = {
  dog: ["Vaccination","Antibiotics","Anti-inflammatory","Deworming","Flea/Tick Prevention","Dental Cleaning","Surgery","Physical Therapy","Special Diet","Medicated Shampoo"],
  cat: ["Vaccination","Antibiotics","Fluid Therapy","Urinary Diet","Insulin Therapy","Antifungal Medication","Dental Extraction","Topical Treatment","Specialized Diet","Environmental Enrichment"]
};

const PET_BREEDS = {
  dog: ["Labrador Retriever", "German Shepherd", "Golden Retriever", "Bulldog", "Beagle", "Poodle", "Siberian Husky", "Boxer", "Dachshund", "Shih Tzu"],
  cat: ["Siamese", "Persian", "Maine Coon", "Bengal", "Sphynx", "Ragdoll", "British Shorthair", "Abyssinian", "Scottish Fold", "Russian Blue"]
};

const GENDER_OPTIONS = ["Male", "Female", "Neutered Male", "Spayed Female"];

const sanitizeFirestoreData = (data: Record<string, unknown>) => {
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) delete sanitized[key];
  });
  return sanitized;
};

const MedicalRecordForm: React.FC = () => {
  const router = useRouter();
  const auth = getAuth();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPetType, setFilterPetType] = useState("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setFormData(prev => ({ 
          ...prev, 
          ownerEmail: user.email || "", 
          ownerName: user.displayName || "" 
        }));
      } else {
        setCurrentUser(null);
        setRecords([]);
        setLoading(false);
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const fetchMedicalRecords = useCallback(async () => {
    try {
      setLoading(true);

      if (!currentUser?.email) return;

      const q = query(
        collection(db, "medicalRecords"), 
        where("ownerEmail", "==", currentUser.email),
        orderBy("date", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const recordsData: MedicalRecord[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        recordsData.push({ 
          id: doc.id, 
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
          createdAt: data.createdAt || null
        } as MedicalRecord);
      });
      
      setRecords(recordsData);
    } catch {
      // Optionally log error
      // console.error(_);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchMedicalRecords();
    }
  }, [currentUser, fetchMedicalRecords]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please login first!");
      return;
    }

    const sanitizedData = sanitizeFirestoreData({
      ...formData,
      ownerEmail: currentUser.email,
      ownerName: formData.ownerName || currentUser.displayName || "Unknown"
    });

    try {
      if (editingRecord) {
        await updateDoc(doc(db, "medicalRecords", editingRecord.id), {
          ...sanitizedData,
          updatedAt: new Date()
        });
        setSuccessMessage("Record updated successfully!");
      } else {
        await addDoc(collection(db, "medicalRecords"), {
          ...sanitizedData,
          createdAt: new Date()
        });
        setSuccessMessage("Record added successfully!");
      }

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
        ownerName: currentUser.displayName || "",
        ownerEmail: currentUser.email || "",
        petType: "dog",
        diagnosis: "",
        treatment: "",
        date: new Date().toISOString().split('T')[0],
        notes: "",
        veterinarian: "",
      });
      setEditingRecord(null);
      setShowForm(false);
      fetchMedicalRecords();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      // Optionally log error
      // console.error(_);
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
      ownerEmail: record.ownerEmail || currentUser?.email || "",
      petType: record.petType,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      date: record.date,
      notes: record.notes,
      veterinarian: record.veterinarian || "",
    });
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

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      // Optionally log error
      // console.error(_);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'});
    } catch {
      return "Invalid date";
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.petName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        record.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPetType = filterPetType === "all" || record.petType === filterPetType;
    return matchesSearch && matchesPetType;
  });

  if (loading) return <><GlobalStyle /><LoadingContainer>Loading medical records...</LoadingContainer></>;

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        {/* Header */}
        <HeaderBar>
          <BrandSection>
            <ClinicLogo>🐾</ClinicLogo>
            <div>
              <ClinicName>RL Clinic</ClinicName>
              <Tagline>Fursure Care - Medical Records</Tagline>
            </div>
          </BrandSection>
          <ButtonGroup>
            <BackButton onClick={() => router.push("/admindashboard")}>
              <Icon className="material-icons"></Icon>
              Back
            </BackButton>
            <AddButton onClick={() => setShowForm(true)}>
              <Icon className="material-icons"></Icon>
              Add Record
            </AddButton>
          </ButtonGroup>
        </HeaderBar>

        {/* Success Message */}
        {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}

        {/* Content */}
        <Content>
          {showForm ? (
            <FormCard>
              <Title>
                {editingRecord ? "Edit Medical Record" : "Add New Medical Record"}
                <FormHelpText>Please fill in all required fields marked with *</FormHelpText>
              </Title>
              <Form onSubmit={handleSubmit}>
                <FormRow>
                  <FormGroup>
                    <Label>Pet Name *</Label>
                    <Input name="petName" value={formData.petName} onChange={handleChange} required placeholder="Enter pet name"/>
                  </FormGroup>
                  <FormGroup>
                    <Label>Owner Name *</Label>
                    <Input name="ownerName" value={formData.ownerName} onChange={handleChange} required placeholder="Enter owner name"/>
                  </FormGroup>
                </FormRow>
                
                <FormRow>
                  <FormGroup>
                    <Label>Pet Age</Label>
                    <Input name="petAge" value={formData.petAge} onChange={handleChange} placeholder="e.g., 3 years"/>
                  </FormGroup>
                  <FormGroup>
                    <Label>Birth Date</Label>
                    <Input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange}/>
                  </FormGroup>
                  <FormGroup>
                    <Label>Weight</Label>
                    <Input name="weight" value={formData.weight} onChange={handleChange} placeholder="e.g., 5 kg"/>
                  </FormGroup>
                </FormRow>
                
                <FormRow>
                  <FormGroup>
                    <Label>Gender</Label>
                    <Select name="gender" value={formData.gender} onChange={handleChange}>
                      <option value="">Select Gender</option>
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label>Color/Markings</Label>
                    <Input name="color" value={formData.color} onChange={handleChange} placeholder="e.g., Brown with white patches"/>
                  </FormGroup>
                </FormRow>
                
                <FormRow>
                  <FormGroup>
                    <Label>Pet Type *</Label>
                    <Select name="petType" value={formData.petType} onChange={handleChange}>
                      <option value="dog">Dog</option>
                      <option value="cat">Cat</option>
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label>Breed *</Label>
                    <Select name="breed" value={formData.breed} onChange={handleChange} required>
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
                    <Input name="allergies" value={formData.allergies} onChange={handleChange} placeholder="List any known allergies"/>
                  </FormGroup>
                  <FormGroup>
                    <Label>Existing Conditions</Label>
                    <Input name="existingConditions" value={formData.existingConditions} onChange={handleChange} placeholder="Any pre-existing health conditions"/>
                  </FormGroup>
                </FormRow>
                
                <FormRow>
                  <FormGroup>
                    <Label>Diagnosis *</Label>
                    <Select name="diagnosis" value={formData.diagnosis} onChange={handleChange} required>
                      <option value="">Select Diagnosis</option>
                      {(DIAGNOSIS_OPTIONS[formData.petType as keyof typeof DIAGNOSIS_OPTIONS] || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label>Treatment *</Label>
                    <Select name="treatment" value={formData.treatment} onChange={handleChange} required>
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
                    <Input type="date" name="date" value={formData.date} onChange={handleChange} required/>
                  </FormGroup>
                  <FormGroup>
                    <Label>Veterinarian</Label>
                    <Input name="veterinarian" value={formData.veterinarian} onChange={handleChange} placeholder="Name of attending veterinarian"/>
                  </FormGroup>
                </FormRow>
                
                <FormGroup>
                  <Label>Notes</Label>
                  <TextArea name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes about the treatment or condition" rows={4}/>
                </FormGroup>
                
                <ButtonGroupForm>
                  <SaveButton type="submit">
                    <Icon className="material-icons">{editingRecord ? "save" : "Add"}</Icon>
                    {editingRecord ? "Update Record" : " Record"}
                  </SaveButton>
                  <CancelButton type="button" onClick={() => {
                      setShowForm(false); 
                      setEditingRecord(null);
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
                        ownerName: currentUser?.displayName || "",
                        ownerEmail: currentUser?.email || "",
                        petType: "dog",
                        diagnosis: "",
                        treatment: "",
                        date: new Date().toISOString().split('T')[0],
                        notes: "",
                        veterinarian: "",
                      });
                    }}>
                    <Icon className="material-icons"></Icon>
                    Cancel
                  </CancelButton>
                </ButtonGroupForm>
              </Form>
            </FormCard>
          ) : (
            <>
              <SectionHeader>
                <SectionTitle>Medical Records</SectionTitle>
                <FilterSection>
                  <SearchContainer>
                    <SearchIcon className="material-icons"></SearchIcon>
                    <SearchInput 
                      type="text" 
                      placeholder="Search by pet or owner name" 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </SearchContainer>
                  <FilterSelect value={filterPetType} onChange={(e) => setFilterPetType(e.target.value)}>
                    <option value="all">All Pets</option>
                    <option value="dog">Dogs Only</option>
                    <option value="cat">Cats Only</option>
                  </FilterSelect>
                  <RefreshButton onClick={fetchMedicalRecords}>
                    <Icon className="material-icons"></Icon>
                    Refresh
                  </RefreshButton>
                </FilterSection>
              </SectionHeader>
              
              <RecordsStats>
                <StatCard>
                  <StatNumber>{records.length}</StatNumber>
                  <StatLabel>Total Records</StatLabel>
                </StatCard>
                <StatCard>
                  <StatNumber>{records.filter(r => r.petType === 'dog').length}</StatNumber>
                  <StatLabel>Dogs</StatLabel>
                </StatCard>
                <StatCard>
                  <StatNumber>{records.filter(r => r.petType === 'cat').length}</StatNumber>
                  <StatLabel>Cats</StatLabel>
                </StatCard>
              </RecordsStats>
              
              <RecordsGrid>
                {filteredRecords.length === 0 ? (
                  <EmptyState>
                    <EmptyIcon>🐾</EmptyIcon>
                    <EmptyText>No medical records found</EmptyText>
                    <EmptySubtext>{searchTerm || filterPetType !== "all" ? "Try adjusting your search or filter" : "Add your first medical record to get started"}</EmptySubtext>
                    <AddButton onClick={() => setShowForm(true)}>
                      <Icon className="material-icons"></Icon>
                      Add Your First Record
                    </AddButton>
                  </EmptyState>
                ) : (
                  filteredRecords.map(record => (
                    <RecordCard key={record.id}>
                      <CardHeader>
                        <div>
                          <PetName>{record.petName}</PetName>
                          <OwnerName>{record.ownerName}</OwnerName>
                        </div>
                        <PetTypeBadge $petType={record.petType}>
                          {record.petType === 'dog' ? '🐶 Dog' : '🐱 Cat'}
                        </PetTypeBadge>
                      </CardHeader>
                      
                      <CardContent>
                        <DetailItem>
                          <DetailLabel>Age:</DetailLabel>
                          <DetailValue>{record.petAge || 'Not specified'}</DetailValue>
                        </DetailItem>
                        
                        <DetailItem>
                          <DetailLabel>Breed:</DetailLabel>
                          <DetailValue>{record.breed || 'Not specified'}</DetailValue>
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
                          <DetailLabel>Color:</DetailLabel>
                          <DetailValue>{record.color || 'Not specified'}</DetailValue>
                        </DetailItem>
                        
                        <DetailItem>
                          <DetailLabel>Date of Visit:</DetailLabel>
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
                        
                        {record.allergies && (
                          <DetailItem>
                            <DetailLabel>Allergies:</DetailLabel>
                            <DetailValue>{record.allergies}</DetailValue>
                          </DetailItem>
                        )}
                        
                        {record.existingConditions && (
                          <DetailItem>
                            <DetailLabel>Existing Conditions:</DetailLabel>
                            <DetailValue>{record.existingConditions}</DetailValue>
                          </DetailItem>
                        )}
                        
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
                          <Icon className="material-icons">edit</Icon>
                          Edit
                        </ActionButton>
                        <DeleteButton onClick={() => handleDelete(record.id)}>
                          <Icon className="material-icons">delete</Icon>
                          Delete
                        </DeleteButton>
                      </CardActions>
                    </RecordCard>
                  ))
                )}
              </RecordsGrid>
            </>
          )}
        </Content>
      </PageContainer>
    </>
  );
};
export default MedicalRecordForm;

// Styled Components
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

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
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

  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`;

const Icon = styled.span`
  font-size: 1.1rem;
  margin-right: 0.4rem;
  display: inline-flex;
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
  display: flex;
  align-items: center;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
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
  display: flex;
  align-items: center;

  &:hover {
    background: #059669;
    transform: translateY(-2px);
  }
`;

const Content = styled.main`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 1rem;
  }
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

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
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
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;

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

const ButtonGroupForm = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
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
  display: flex;
  align-items: center;

  &:hover {
    background: #2a947c;
    transform: translateY(-2px);
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
  display: flex;
  align-items: center;

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

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
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

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const SearchContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 0.75rem;
  color: #64748b;
  font-size: 1.25rem;
`;

const SearchInput = styled.input`
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.15);
  }

  @media (max-width: 640px) {
    min-width: auto;
    width: 100%;
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
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.15);
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
  display: flex;
  align-items: center;

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

const StatCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
  border-top: 4px solid #34B89C;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:before {
    content: "✅";
  }
`;

const RecordsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const RecordCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-top: 4px solid #6BC1E1;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
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

const PetTypeBadge = styled.span<{ $petType: string }>`
  background: ${props => props.$petType === 'dog' ? '#dbeafe' : '#fce7f3'};
  color: ${props => props.$petType === 'dog' ? '#1d4ed8' : '#be185d'};
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500; 
  `;
  const CardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #374151;
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
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;

  &:hover {
    background: #59a7c5;
    transform: translateY(-2px);
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
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;

  &:hover {
    background: #dc2626;
    transform: translateY(-2px);
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

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
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