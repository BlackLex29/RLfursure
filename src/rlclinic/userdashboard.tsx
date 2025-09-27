'use client';

import React, { useEffect, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, deleteDoc, query, where, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f8f9fa;
    scroll-behavior: smooth;
  }
  
  * {
    box-sizing: border-box;
  }
`;

interface AppointmentType {
  id: string;
  clientName: string;
  petName: string;
  date: string;
  timeSlot: string;
  status?: string;
  paymentMethod?: string;
  appointmentType?: string;
  completedAt?: string;
  notes?: string;
  veterinarian?: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

const timeSlots = [
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

const UserDashboard: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [completedAppointments, setCompletedAppointments] = useState<AppointmentType[]>([]);
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);

  // Modal states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);

  // Medical Records modal state
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false);

  // Success message states
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [today, setToday] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Show success message
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 3000);
  };

  useEffect(() => {
    setIsClient(true);
    setToday(new Date().toISOString().split("T")[0]);
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserEmail(user.email);
        setUserId(user.uid);
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!userEmail || !userId) return;

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setUserProfile(profileData);
          setEditFirstName(profileData.firstName || userEmail.split('@')[0]);
          setEditLastName(profileData.lastName || "");
          setProfilePictureUrl(profileData.profilePicture || "");
        } else {
          const defaultProfile: UserProfile = {
            firstName: userEmail.split('@')[0],
            lastName: "",
            email: userEmail
          };
          await setDoc(doc(db, "users", userId), defaultProfile);
          setUserProfile(defaultProfile);
          setEditFirstName(defaultProfile.firstName);
          setEditLastName("");
          setProfilePictureUrl("");
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        const defaultProfile: UserProfile = {
          firstName: userEmail.split('@')[0],
          lastName: "",
          email: userEmail
        };
        setUserProfile(defaultProfile);
        setEditFirstName(defaultProfile.firstName);
        setEditLastName("");
        setProfilePictureUrl("");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Query for active appointments (excluding completed ones)
    const activeQuery = query(
      collection(db, "appointments"),
      where("clientName", "==", userEmail)
    );

    const activeUnsub = onSnapshot(activeQuery, (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        const appointmentData = { id: doc.id, ...(doc.data() as Omit<AppointmentType, 'id'>) };
        // Filter out completed appointments (Done, Not Attend, Cancelled)
        if (!["Done", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData);
        }
      });
      data.sort((a, b) => a.date.localeCompare(b.date));
      setAppointments(data);
    });

    // Query for completed appointments (for history)
    const completedQuery = query(
      collection(db, "appointments"),
      where("clientName", "==", userEmail)
    );

    const completedUnsub = onSnapshot(completedQuery, (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        const appointmentData = { id: doc.id, ...(doc.data() as Omit<AppointmentType, 'id'>) };
        // Only include completed appointments
        if (["Done", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData);
        }
      });
      // Sort by completion date (most recent first)
      data.sort((a, b) => {
        const dateA = a.completedAt || a.date;
        const dateB = b.completedAt || b.date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setCompletedAppointments(data);
    });

    return () => {
      activeUnsub();
      completedUnsub();
    };
  }, [userEmail, userId]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/homepage");
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "appointments", id));
      setShowCancelModal(false);
      showSuccess("Appointment cancelled successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to cancel appointment.");
    }
  };

  const openCancelModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt);
    setShowCancelModal(true);
  };

  const openRescheduleModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt);
    setEditDate(appt.date || today);
    setEditSlot(appt.timeSlot);
    setShowRescheduleModal(true);
  };

  const openHistoryModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt);
    setShowHistoryModal(true);
  };

  const handleMedicalRecordsClick = () => {
    setShowMedicalRecordsModal(true);
  };

  const saveEdit = async () => {
    if (!selectedAppointment || !editDate || !editSlot) {
      return alert("Please select date and time slot.");
    }

    const isTaken = appointments.some(a =>
      a.id !== selectedAppointment.id &&
      a.date === editDate &&
      a.timeSlot === editSlot &&
      a.status !== "Cancelled"
    );
    
    if (isTaken) return alert("This time slot is already taken.");

    try {
      await updateDoc(doc(db, "appointments", selectedAppointment.id), {
        date: editDate,
        timeSlot: editSlot
      });
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      showSuccess("Appointment rescheduled successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to reschedule appointment.");
    }
  };

  // Profile editing functions
  const toggleProfileEdit = () => {
    if (isEditingProfile) {
      saveProfileEdit();
    } else {
      setIsEditingProfile(true);
      setEditFirstName(userProfile?.firstName || userEmail?.split('@')[0] || "");
      setEditLastName(userProfile?.lastName || "");
      setProfilePictureUrl(userProfile?.profilePicture || "");
      setProfilePictureFile(null);
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    if (!userId) throw new Error("No user ID");
    
    const storageRef = ref(storage, `profile-pictures/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  };

  const saveProfileEdit = async () => {
    if (!userId) return;

    try {
      let imageUrl = profilePictureUrl;
      
      if (profilePictureFile) {
        imageUrl = await uploadImageToStorage(profilePictureFile);
      }

      const updatedProfile = {
        firstName: editFirstName.trim() || userEmail?.split('@')[0] || "User",
        lastName: editLastName.trim(),
        email: userEmail || "",
        profilePicture: imageUrl
      };

      await updateDoc(doc(db, "users", userId), updatedProfile);
      
      setUserProfile(prevProfile => ({
        ...prevProfile!,
        ...updatedProfile
      }));
      
      setIsEditingProfile(false);
      setProfilePictureFile(null);
      showSuccess("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePictureFile(file);
      const imageUrl = URL.createObjectURL(file);
      setProfilePictureUrl(imageUrl);
    }
  };

  const getAppointmentTypeLabel = (type?: string) => {
    const types: Record<string, string> = {
      vaccination: "Vaccination",
      checkup: "Check Up",
      antiRabies: "Anti Rabies",
      ultrasound: "Ultrasound",
      groom: "Grooming",
      spayNeuter: "Spay/Neuter",
      deworm: "Deworming"
    };
    return types[type || ""] || "General Consultation";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isClient) {
    return (
      <>
        <GlobalStyle />
        <PageContainer>
          <HeaderBar>
            <HeaderLeft>
              <Logo>
                <LogoIcon>🏥</LogoIcon>
                <LogoText>
                  <ClinicName>RL Clinic</ClinicName>
                  <LogoSubtext>Fursure Care - User Dashboard</LogoSubtext>
                </LogoText>
              </Logo>
            </HeaderLeft>
          </HeaderBar>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        {/* Success Message */}
        {showSuccessMessage && (
          <SuccessNotification>
            <SuccessIcon>✓</SuccessIcon>
            <SuccessText>{successMessage}</SuccessText>
            <CloseSuccessButton onClick={() => setShowSuccessMessage(false)}>
              ×
            </CloseSuccessButton>
          </SuccessNotification>
        )}

        <HeaderBar>
          <HeaderLeft>
            <MobileMenuButton onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <HamburgerIcon className={isMenuOpen ? "open" : ""}>
                <span></span>
                <span></span>
                <span></span>
              </HamburgerIcon>
            </MobileMenuButton>
            
            <Logo>
              <LogoIcon>🏥</LogoIcon>
              <LogoText>
                <ClinicName>RL Clinic</ClinicName>
                <LogoSubtext>Fursure Care - User Dashboard</LogoSubtext>
              </LogoText>
            </Logo>
          </HeaderLeft>
          
          <HeaderRight className={isMenuOpen ? "open" : ""}>
            <UserInfo>
              {loading ? "Loading..." : `${userProfile?.firstName || "User"} ${userProfile?.lastName || ""}`.trim()}
            </UserInfo>
            
            <ProfileContainer>
              <ProfileIconButton onClick={toggleProfileEdit}>
                <ProfileAvatar>
                  {userProfile?.profilePicture ? (
                    <ProfileImage src={userProfile.profilePicture} alt="Profile" />
                  ) : (
                    <DefaultAvatar>👤</DefaultAvatar>
                  )}
                </ProfileAvatar>
              </ProfileIconButton>

              {isEditingProfile && (
                <ProfileModalOverlay onClick={() => setIsEditingProfile(false)}>
                  <LargeProfileModal onClick={(e) => e.stopPropagation()}>
                    <ModalHeader>
                      <ModalTitle>Edit Profile</ModalTitle>
                      <CloseButton onClick={() => setIsEditingProfile(false)}>×</CloseButton>
                    </ModalHeader>
                    
                    <ModalContent>
                      <ProfileImageSection>
                        <ProfileImagePreview>
                          {profilePictureUrl ? (
                            <ProfileImage src={profilePictureUrl} alt="Profile Preview" />
                          ) : (
                            <DefaultAvatarLarge>👤</DefaultAvatarLarge>
                          )}
                        </ProfileImagePreview>
                        <ImageUploadLabel htmlFor="profile-pic">
                          Choose Photo
                          <ImageUploadInput
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            id="profile-pic"
                          />
                        </ImageUploadLabel>
                      </ProfileImageSection>
                      
                      <FormGroup>
                        <Label>First Name</Label>
                        <EditInput
                          type="text"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder="First name"
                        />
                      </FormGroup>
                      
                      <FormGroup>
                        <Label>Last Name</Label>
                        <EditInput
                          type="text"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          placeholder="Last name"
                        />
                      </FormGroup>
                      
                      <FormGroup>
                        <Label>Email</Label>
                        <EmailDisplay>{userEmail}</EmailDisplay>
                      </FormGroup>
                    </ModalContent>
                    
                    <ModalActions>
                      <CancelModalButton onClick={() => setIsEditingProfile(false)}>
                        Cancel
                      </CancelModalButton>
                      <SaveProfileButton onClick={saveProfileEdit}>
                        Save Changes
                      </SaveProfileButton>
                    </ModalActions>
                  </LargeProfileModal>
                </ProfileModalOverlay>
              )}
            </ProfileContainer>
            
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </HeaderRight>
        </HeaderBar>

        <Content>
          <WelcomeSection>
            <WelcomeTitle>
              Welcome to Fursurecare, {userProfile?.firstName || userEmail?.split('@')[0] || "User"}!
            </WelcomeTitle>
            <WelcomeSubtitle>How can we help your pet today?</WelcomeSubtitle>
          </WelcomeSection>

          <CardsGrid>
            <Card onClick={() => router.push("/petregistration")}>
              <CardIcon>🐾</CardIcon>
              <CardContent>
                <CardTitle>Register Pet</CardTitle>
                <CardText>Add your pet to get started with appointments</CardText>
              </CardContent>
            </Card>

            <Card onClick={() => router.push("/appointment")}>
              <CardIcon>📅</CardIcon>
              <CardContent>
                <CardTitle>Book Appointment</CardTitle>
                <CardText>Schedule a new vet visit for your pet</CardText>
              </CardContent>
            </Card>

            <Card onClick={handleMedicalRecordsClick}>
              <CardIcon>📋</CardIcon>
              <CardContent>
                <CardTitle>Medical Records & History</CardTitle>
                <CardText>View your pet's health history and appointment records</CardText>
                {completedAppointments.length > 0 && (
                  <HistoryBadge>{completedAppointments.length} completed appointments</HistoryBadge>
                )}
              </CardContent>
            </Card>
          </CardsGrid>

          <AppointmentsSection>
            <SectionHeader>
              <SectionTitleGroup>
                <SectionTitle>Active Appointments</SectionTitle>
                {isClient && <AppointmentCount>{appointments.length} scheduled</AppointmentCount>}
              </SectionTitleGroup>
            </SectionHeader>

            {appointments.length === 0 ? (
              <NoAppointments>
                <NoAppointmentsIcon>📅</NoAppointmentsIcon>
                <NoAppointmentsText>No active appointments</NoAppointmentsText>
                <ScheduleButton onClick={() => router.push("/appointment")}>
                  Schedule an Appointment
                </ScheduleButton>
              </NoAppointments>
            ) : (
              <AppointmentsList>
                {appointments
                  .filter(a => a.petName)
                  .map((appt) => (
                    <AppointmentCard key={appt.id}>
                      <AppointmentHeader>
                        <AppointmentLeftSide>
                          <AppointmentStatus>Pet: {appt.petName}</AppointmentStatus>
                          <AppointmentInfo>
                            <AppointmentLabel>Service:</AppointmentLabel>
                            <AppointmentValue>{getAppointmentTypeLabel(appt.appointmentType)}</AppointmentValue>
                          </AppointmentInfo>
                          <AppointmentInfo>
                            <AppointmentLabel>Date:</AppointmentLabel>
                            <AppointmentValue>{formatDate(appt.date || today)}</AppointmentValue>
                            <AppointmentSeparator>|</AppointmentSeparator>
                            <AppointmentLabel>Time:</AppointmentLabel>
                            <AppointmentValue>{appt.timeSlot}</AppointmentValue>
                          </AppointmentInfo>
                          <AppointmentInfo>
                            <AppointmentLabel>Payment:</AppointmentLabel>
                            <AppointmentValue>{appt.paymentMethod || "Not specified"}</AppointmentValue>
                          </AppointmentInfo>
                        </AppointmentLeftSide>
                        <StatusBadge status={appt.status || "Pending"}>
                          {appt.status || "Pending Payment"}
                        </StatusBadge>
                      </AppointmentHeader>

                      <ButtonRow>
                        <EditButton onClick={() => openRescheduleModal(appt)}>Reschedule</EditButton>
                        <DeleteButton onClick={() => openCancelModal(appt)}>Cancel</DeleteButton>
                      </ButtonRow>
                    </AppointmentCard>
                  ))}
              </AppointmentsList>
            )}
          </AppointmentsSection>
        </Content>

        {/* Medical Records Modal with Appointment History */}
        {showMedicalRecordsModal && (
          <ModalOverlay onClick={() => setShowMedicalRecordsModal(false)}>
            <LargeMedicalModal onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Medical Records & Appointment History</ModalTitle>
                <CloseButton onClick={() => setShowMedicalRecordsModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <MedicalModalContent>
                <MedicalRecordsSection>
                  <SectionSubtitle>Medical Records</SectionSubtitle>
                  <ViewRecordsButton onClick={() => {
                    setShowMedicalRecordsModal(false);
                    router.push("/usermedicalrecord");
                  }}>
                    View Full Medical Records
                  </ViewRecordsButton>
                </MedicalRecordsSection>

                <AppointmentHistorySection>
                  <HistorySectionHeader>
                    <SectionSubtitle>Appointment History</SectionSubtitle>
                    <HistoryCount>{completedAppointments.length} completed appointments</HistoryCount>
                  </HistorySectionHeader>

                  {completedAppointments.length === 0 ? (
                    <NoHistoryMessage>
                      <NoHistoryIcon>📚</NoHistoryIcon>
                      <NoHistoryText>No appointment history yet</NoHistoryText>
                    </NoHistoryMessage>
                  ) : (
                    <HistoryList>
                      {completedAppointments.map((appt) => (
                        <HistoryCard key={appt.id} onClick={() => openHistoryModal(appt)}>
                          <HistoryCardHeader>
                            <HistoryCardLeft>
                              <PetName>{appt.petName}</PetName>
                              <ServiceInfo>{getAppointmentTypeLabel(appt.appointmentType)}</ServiceInfo>
                              <DateInfo>{formatDate(appt.date)} • {appt.timeSlot}</DateInfo>
                            </HistoryCardLeft>
                            <HistoryStatusBadge status={appt.status || "Completed"}>
                              {appt.status === "Done" ? "✅ Completed" : 
                               appt.status === "Not Attend" ? "❌ No Show" : 
                               appt.status === "Cancelled" ? "🚫 Cancelled" : appt.status}
                            </HistoryStatusBadge>
                          </HistoryCardHeader>
                          <ClickHint>Click for details</ClickHint>
                        </HistoryCard>
                      ))}
                    </HistoryList>
                  )}
                </AppointmentHistorySection>
              </MedicalModalContent>
              
              <ModalActions>
                <CancelModalButton onClick={() => setShowMedicalRecordsModal(false)}>
                  Close
                </CancelModalButton>
              </ModalActions>
            </LargeMedicalModal>
          </ModalOverlay>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && selectedAppointment && (
          <ModalOverlay onClick={() => setShowRescheduleModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Reschedule Appointment</ModalTitle>
                <CloseButton onClick={() => setShowRescheduleModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <ModalContent>
                <AppointmentInfoModal>
                  <InfoItem>
                    <InfoLabel>Pet:</InfoLabel>
                    <InfoValue>{selectedAppointment.petName}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Current Date:</InfoLabel>
                    <InfoValue>{formatDate(selectedAppointment.date)}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Current Time:</InfoLabel>
                    <InfoValue>{selectedAppointment.timeSlot}</InfoValue>
                  </InfoItem>
                </AppointmentInfoModal>

                <FormGroup>
                  <Label>New Date:</Label>
                  <DateInput
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    min={today}
                  />
                </FormGroup>
                
                <FormGroup>
                  <Label>New Time Slot:</Label>
                  <SelectInput
                    value={editSlot}
                    onChange={(e) => setEditSlot(e.target.value)}
                  >
                    <option value="">Select a time slot</option>
                    {timeSlots.map(slot => {
                      const isTaken = appointments.some(a =>
                        a.id !== selectedAppointment.id &&
                        a.date === editDate &&
                        a.timeSlot === slot &&
                        a.status !== "Cancelled"
                      );
                      return (
                        <option key={slot} value={slot} disabled={isTaken}>
                          {slot} {isTaken ? "(Taken)" : ""}
                        </option>
                      );
                    })}
                  </SelectInput>
                </FormGroup>
              </ModalContent>
              
              <ModalActions>
                <CancelModalButton onClick={() => setShowRescheduleModal(false)}>
                  Cancel
                </CancelModalButton>
                <ConfirmButton onClick={saveEdit}>
                  Confirm Reschedule
                </ConfirmButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}

        {/* Cancel Appointment Modal */}
        {showCancelModal && selectedAppointment && (
          <ModalOverlay onClick={() => setShowCancelModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Cancel Appointment</ModalTitle>
                <CloseButton onClick={() => setShowCancelModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <ModalContent>
                <WarningMessage>
                  <WarningIcon>⚠️</WarningIcon>
                  <WarningText>
                    Are you sure you want to cancel this appointment? This action cannot be undone.
                  </WarningText>
                </WarningMessage>
                
                <AppointmentDetails>
                  <DetailItem>
                    <DetailLabel>Pet:</DetailLabel>
                    <DetailValue>{selectedAppointment.petName}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Date:</DetailLabel>
                    <DetailValue>{formatDate(selectedAppointment.date)}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Time:</DetailLabel>
                    <DetailValue>{selectedAppointment.timeSlot}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Service:</DetailLabel>
                    <DetailValue>{getAppointmentTypeLabel(selectedAppointment.appointmentType)}</DetailValue>
                  </DetailItem>
                </AppointmentDetails>
              </ModalContent>
              
              <ModalActions>
                <CancelModalButton onClick={() => setShowCancelModal(false)}>
                  Keep Appointment
                </CancelModalButton>
                <DeleteModalButton onClick={() => handleDelete(selectedAppointment.id)}>
                  Cancel Appointment
                </DeleteModalButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}

        {/* Appointment History Details Modal */}
        {showHistoryModal && selectedAppointment && (
          <ModalOverlay onClick={() => setShowHistoryModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Appointment Details</ModalTitle>
                <CloseButton onClick={() => setShowHistoryModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <ModalContent>
                <AppointmentInfoModal>
                  <InfoItem>
                    <InfoLabel>Pet Name:</InfoLabel>
                    <InfoValue>{selectedAppointment.petName}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Service Type:</InfoLabel>
                    <InfoValue>{getAppointmentTypeLabel(selectedAppointment.appointmentType)}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Appointment Date:</InfoLabel>
                    <InfoValue>{formatDate(selectedAppointment.date)}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Time Slot:</InfoLabel>
                    <InfoValue>{selectedAppointment.timeSlot}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Payment Method:</InfoLabel>
                    <InfoValue>{selectedAppointment.paymentMethod || "Not specified"}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Status:</InfoLabel>
                    <InfoValue>
                      <HistoryStatusBadge status={selectedAppointment.status || "Completed"}>
                        {selectedAppointment.status === "Done" ? "✅ Completed" : 
                         selectedAppointment.status === "Not Attend" ? "❌ No Show" : 
                         selectedAppointment.status === "Cancelled" ? "🚫 Cancelled" : selectedAppointment.status}
                      </HistoryStatusBadge>
                    </InfoValue>
                  </InfoItem>
                  {selectedAppointment.completedAt && (
                    <InfoItem>
                      <InfoLabel>Completed On:</InfoLabel>
                      <InfoValue>{formatDate(selectedAppointment.completedAt)}</InfoValue>
                    </InfoItem>
                  )}
                  {selectedAppointment.veterinarian && (
                    <InfoItem>
                      <InfoLabel>Veterinarian:</InfoLabel>
                      <InfoValue>{selectedAppointment.veterinarian}</InfoValue>
                    </InfoItem>
                  )}
                  {selectedAppointment.notes && (
                    <InfoItem>
                      <InfoLabel>Notes:</InfoLabel>
                      <InfoValue>{selectedAppointment.notes}</InfoValue>
                    </InfoItem>
                  )}
                </AppointmentInfoModal>
              </ModalContent>
              
              <ModalActions>
                <CancelModalButton onClick={() => setShowHistoryModal(false)}>
                  Close
                </CancelModalButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}
      </PageContainer>
    </>
  );
};

export default UserDashboard;

// Styled Components
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  background: #f8f9fa;
`;

// Success Notification
const SuccessNotification = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 1001;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    top: 10px;
    right: 10px;
    left: 10px;
  }
`;

const SuccessIcon = styled.div`
  background: #28a745;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
`;

const SuccessText = styled.span`
  color: #155724;
  font-weight: 600;
  flex: 1;
`;

const CloseSuccessButton = styled.button`
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #155724;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  &:hover {
    background: rgba(21, 87, 36, 0.1);
  }
`;

const HeaderBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1rem;
    position: relative;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  color: white;

  @media (max-width: 768px) {
    display: none;
    flex-direction: column;
    width: 100%;
    gap: 1rem;
    padding-top: 1rem;
    
    &.open {
      display: flex;
    }
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: white;
`;

const LogoIcon = styled.div`
  font-size: 2rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem;
  border-radius: 10px;
`;

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
`;

const ClinicName = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
`;

const LogoSubtext = styled.span`
  font-size: 0.85rem;
  opacity: 0.9;
  font-weight: 500;
`;

const UserInfo = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-right: 1rem;

  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 1rem;
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 5px;
  
  @media (max-width: 768px) {
    display: block;
    align-self: flex-end;
  }
`;

const HamburgerIcon = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 24px;
  height: 18px;
  
  span {
    height: 3px;
    width: 100%;
    background-color: white;
    border-radius: 2px;
    transition: all 0.3s ease;
  }
  
  &.open span:nth-child(1) {
    transform: rotate(45deg) translate(6px, 6px);
  }
  
  &.open span:nth-child(2) {
    opacity: 0;
  }
  
  &.open span:nth-child(3) {
    transform: rotate(-45deg) translate(6px, -6px);
  }
`;

const ProfileContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ProfileIconButton = styled.div`
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 10px;
  transition: background-color 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const ProfileAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.3);
`;

const ProfileImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DefaultAvatar = styled.div`
  font-size: 1.2rem;
  color: #4ecdc4;
`;

const DefaultAvatarLarge = styled(DefaultAvatar)`
  font-size: 4rem;
`;

const LogoutButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Content = styled.div`
  flex: 1;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
    gap: 1.5rem;
  }
`;

const WelcomeSection = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  text-align: center;
  border-top: 4px solid #4ecdc4;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const WelcomeTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const WelcomeSubtitle = styled.p`
  font-size: 1.1rem;
  color: #7f8c8d;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const Card = styled.div`
  background: white;
  border-radius: 15px;
  padding: 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  border-top: 4px solid transparent;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    border-top-color: #4ecdc4;
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
    gap: 1rem;
  }
`;

const CardIcon = styled.div`
  font-size: 2.5rem;
  color: #4ecdc4;
  background: linear-gradient(135deg, #e8f8f5 0%, #d4edda 100%);
  padding: 1rem;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  height: 80px;

  @media (max-width: 768px) {
    font-size: 2rem;
    min-width: 60px;
    height: 60px;
    padding: 0.8rem;
  }
`;

const CardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CardTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const CardText = styled.p`
  font-size: 0.95rem;
  color: #6c757d;
  margin: 0;
  line-height: 1.4;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const HistoryBadge = styled.div`
  background: #4ecdc4;
  color: white;
  padding: 0.3rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  align-self: flex-start;
  margin-top: 0.25rem;
`;

const AppointmentsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SectionTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }
`;

const AppointmentCount = styled.span`
  background: #4ecdc4;
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: 600;
`;

const AppointmentsList = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AppointmentCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  border: 1px solid #e9ecef;
  border-left: 4px solid #ffc107;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 768px) {
    padding: 1.2rem;
  }
`;

const AppointmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
`;

const AppointmentLeftSide = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
`;

const AppointmentStatus = styled.div`
  font-weight: 600;
  color: #2c3e50;
  font-size: 1rem;
`;

const AppointmentInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const AppointmentLabel = styled.span`
  font-weight: 600;
  color: #6c757d;
  font-size: 0.85rem;
`;

const AppointmentValue = styled.span`
  color: #2c3e50;
  font-size: 0.9rem;
`;

const AppointmentSeparator = styled.span`
  color: #dee2e6;
  margin: 0 0.25rem;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 0.4rem 0.8rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  background: ${props => {
    switch (props.status) {
      case "Confirmed": return "#d4edda";
      case "Cancelled": return "#f8d7da";
      case "Completed": return "#d1ecf1";
      default: return "#fff3cd";
    }
  }};
  color: ${props => {
    switch (props.status) {
      case "Confirmed": return "#155724";
      case "Cancelled": return "#721c24";
      case "Completed": return "#0c5460";
      default: return "#856404";
    }
  }};
`;

const HistoryStatusBadge = styled.span<{ status: string }>`
  padding: 0.4rem 0.8rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  background: ${props => {
    switch (props.status) {
      case "Done": return "#d4edda";
      case "Not Attend": return "#fff3cd";
      case "Cancelled": return "#f8d7da";
      default: return "#e2e6ea";
    }
  }};
  color: ${props => {
    switch (props.status) {
      case "Done": return "#155724";
      case "Not Attend": return "#856404";
      case "Cancelled": return "#721c24";
      default: return "#6c757d";
    }
  }};
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const EditButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background-color 0.3s ease;
  flex: 1;

  &:hover {
    background: #45b7b8;
  }
`;

const DeleteButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background-color 0.3s ease;
  flex: 1;

  &:hover {
    background: #c0392b;
  }
`;

const NoAppointments = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  background: white;
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  border: 1px solid #e9ecef;
  border-top: 4px solid #4ecdc4;

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`;

const NoAppointmentsIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const NoAppointmentsText = styled.p`
  font-size: 1.1rem;
  color: #6c757d;
  margin-bottom: 1.5rem;
`;

const ScheduleButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background: #45b7b8;
  }
`;

// Medical Records Modal Components
const LargeMedicalModal = styled.div`
  background: white;
  border-radius: 15px;
  width: 95%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;

const MedicalModalContent = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const MedicalRecordsSection = styled.div`
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  border-left: 4px solid #4ecdc4;
  text-align: center;
`;

const SectionSubtitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 1rem 0;
`;

const ViewRecordsButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background: #45b7b8;
  }
`;

const AppointmentHistorySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const HistorySectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
`;

const HistoryCount = styled.span`
  background: #6c757d;
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: 600;
`;

const NoHistoryMessage = styled.div`
  text-align: center;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
`;

const NoHistoryIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const NoHistoryText = styled.p`
  color: #6c757d;
  margin: 0;
  font-size: 1rem;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
`;

const HistoryCard = styled.div`
  background: white;
  padding: 1rem;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border: 1px solid #e9ecef;
  border-left: 4px solid #6c757d;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
`;

const HistoryCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const HistoryCardLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
`;

const PetName = styled.div`
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
`;

const ServiceInfo = styled.div`
  color: #4ecdc4;
  font-size: 0.85rem;
  font-weight: 500;
`;

const DateInfo = styled.div`
  color: #6c757d;
  font-size: 0.8rem;
`;

const ClickHint = styled.div`
  font-size: 0.75rem;
  color: #4ecdc4;
  font-weight: 500;
  text-align: center;
  opacity: 0.7;
`;

// Modal Components
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

const ModalContainer = styled.div`
  background: white;
  border-radius: 15px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.3rem;
  color: #2c3e50;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  &:hover {
    background: #f8f9fa;
    color: #2c3e50;
  }
`;

const ModalContent = styled.div`
  padding: 1.5rem;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #dee2e6;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CancelModalButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  flex: 1;

  &:hover {
    background: #5a6268;
  }
`;

const ConfirmButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  flex: 1;

  &:hover {
    background: #45b7b8;
  }
`;

const DeleteModalButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  flex: 1;

  &:hover {
    background: #c0392b;
  }
`;

const SaveProfileButton = styled(ConfirmButton)`
`;

const AppointmentInfoModal = styled.div`
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border-left: 4px solid #4ecdc4;
`;

const InfoItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoLabel = styled.span`
  font-weight: 600;
  color: #495057;
`;

const InfoValue = styled.span`
  color: #2c3e50;
  font-weight: 500;
`;

const WarningMessage = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
`;

const WarningIcon = styled.div`
  font-size: 1.5rem;
  flex-shrink: 0;
`;

const WarningText = styled.p`
  color: #856404;
  margin: 0;
  line-height: 1.4;
`;

const AppointmentDetails = styled.div`
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #e74c3c;
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: #495057;
`;

const DetailValue = styled.span`
  color: #2c3e50;
  font-weight: 500;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const Label = styled.label`
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
`;

const DateInput = styled.input`
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
  }
`;

const SelectInput = styled.select`
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
  }
`;

// Profile Modal Components
const ProfileModalOverlay = styled(ModalOverlay)``;

const LargeProfileModal = styled(ModalContainer)`
  max-width: 600px;
`;

const ProfileImageSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
`;

const ProfileImagePreview = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #4ecdc4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
`;

const ImageUploadLabel = styled.label`
  padding: 0.6rem 1.2rem;
  background: #4ecdc4;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.3s ease;
  
  &:hover {
    background: #45b7b8;
  }
`;

const ImageUploadInput = styled.input`
  display: none;
`;

const EditInput = styled.input`
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
  }
`;

const EmailDisplay = styled.div`
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
  font-size: 1rem;
  border: 1px solid #e9ecef;
`;