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
  twoFactorEnabled?: boolean;
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
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [today, setToday] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
          setTwoFactorEnabled(profileData.twoFactorEnabled || false);
        } else {
          const defaultProfile: UserProfile = {
            firstName: userEmail.split('@')[0],
            lastName: "",
            email: userEmail,
            twoFactorEnabled: false
          };
          await setDoc(doc(db, "users", userId), defaultProfile);
          setUserProfile(defaultProfile);
          setEditFirstName(defaultProfile.firstName);
          setEditLastName("");
          setProfilePictureUrl("");
          setTwoFactorEnabled(false);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        const defaultProfile: UserProfile = {
          firstName: userEmail.split('@')[0],
          lastName: "",
          email: userEmail,
          twoFactorEnabled: false
        };
        setUserProfile(defaultProfile);
        setEditFirstName(defaultProfile.firstName);
        setEditLastName("");
        setProfilePictureUrl("");
        setTwoFactorEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    const activeQuery = query(
      collection(db, "appointments"),
      where("clientName", "==", userEmail)
    );

    const activeUnsub = onSnapshot(activeQuery, (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        const appointmentData = { id: doc.id, ...(doc.data() as Omit<AppointmentType, 'id'>) };
        if (!["Done", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData);
        }
      });
      data.sort((a, b) => a.date.localeCompare(b.date));
      setAppointments(data);
    });

    const completedQuery = query(
      collection(db, "appointments"),
      where("clientName", "==", userEmail)
    );

    const completedUnsub = onSnapshot(completedQuery, (snapshot) => {
      const data: AppointmentType[] = [];
      snapshot.forEach((doc) => {
        const appointmentData = { id: doc.id, ...(doc.data() as Omit<AppointmentType, 'id'>) };
        if (["Done", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData);
        }
      });
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

  // Debug useEffect
  useEffect(() => {
    console.log("Current edit states:", {
      editFirstName,
      editLastName,
      profilePictureUrl,
      profilePictureFile: profilePictureFile?.name || 'No file',
      isEditingProfile
    });
  }, [editFirstName, editLastName, profilePictureUrl, profilePictureFile, isEditingProfile]);

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

  const handleHistoryClick = () => {
    setShowHistorySidebar(true);
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

  const toggleProfileEdit = () => {
    if (isEditingProfile) {
      saveProfileEdit();
    } else {
      setIsEditingProfile(true);
      setEditFirstName(userProfile?.firstName || userEmail?.split('@')[0] || "");
      setEditLastName(userProfile?.lastName || "");
      setProfilePictureUrl(userProfile?.profilePicture || "");
      setTwoFactorEnabled(userProfile?.twoFactorEnabled || false);
      setProfilePictureFile(null);
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    if (!userId) throw new Error("No user ID");
    
    // Create a unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `profile-picture-${Date.now()}.${fileExtension}`;
    
    const storageRef = ref(storage, `profile-pictures/${userId}/${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log("File selected:", file); // Debug log
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPEG, PNG, etc.)');
        event.target.value = ''; // Reset input
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Please select an image smaller than 5MB');
        event.target.value = ''; // Reset input
        return;
      }

      setProfilePictureFile(file);
      
      // Create preview URL
      const imageUrl = URL.createObjectURL(file);
      console.log("Preview URL created:", imageUrl); // Debug log
      setProfilePictureUrl(imageUrl);
    }
  };

  const saveProfileEdit = async () => {
    if (!userId) {
      console.error("No user ID found");
      return;
    }

    try {
      let imageUrl = profilePictureUrl;
      
      console.log("Saving profile...", { 
        editFirstName, 
        editLastName, 
        profilePictureFile: !!profilePictureFile,
        currentImageUrl: profilePictureUrl 
      });

      // Upload new image if selected
      if (profilePictureFile) {
        try {
          console.log("Uploading new image...");
          imageUrl = await uploadImageToStorage(profilePictureFile);
          console.log("Image uploaded successfully:", imageUrl);
        } catch (error) {
          console.error("Error uploading image:", error);
          alert("Failed to upload profile picture. Please try again.");
          return;
        }
      }

      const updatedProfile = {
        firstName: editFirstName.trim() || userEmail?.split('@')[0] || "User",
        lastName: editLastName.trim(),
        email: userEmail || "",
        profilePicture: imageUrl,
        twoFactorEnabled: twoFactorEnabled,
        updatedAt: new Date().toISOString()
      };

      console.log("Updating Firestore with:", updatedProfile);

      await updateDoc(doc(db, "users", userId), updatedProfile);
      
      // Update local state
      setUserProfile(prevProfile => ({
        ...prevProfile!,
        ...updatedProfile
      }));
      
      setIsEditingProfile(false);
      setProfilePictureFile(null);
      
      console.log("Profile updated successfully");
      showSuccess(`Profile updated successfully! 2FA is now ${twoFactorEnabled ? 'enabled' : 'disabled'}.`);
      
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  const cancelProfileEdit = () => {
    setIsEditingProfile(false);
    setEditFirstName(userProfile?.firstName || userEmail?.split('@')[0] || "");
    setEditLastName(userProfile?.lastName || "");
    setProfilePictureUrl(userProfile?.profilePicture || "");
    setTwoFactorEnabled(userProfile?.twoFactorEnabled || false);
    setProfilePictureFile(null);
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
        {showSuccessMessage && (
          <SuccessNotification>
            <SuccessIcon>✓</SuccessIcon>
            <SuccessText>{successMessage}</SuccessText>
            <CloseSuccessButton onClick={() => setShowSuccessMessage(false)}>×</CloseSuccessButton>
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
                <ProfileModalOverlay onClick={cancelProfileEdit}>
                  <LargeProfileModal onClick={(e) => e.stopPropagation()}>
                    <ModalHeader>
                      <ModalTitle>Edit Profile</ModalTitle>
                      <CloseButton onClick={cancelProfileEdit}>×</CloseButton>
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
                        {profilePictureFile && (
                          <ImageUploadHint>New image selected: {profilePictureFile.name}</ImageUploadHint>
                        )}
                      </ProfileImageSection>
                      
                      <FormGroup>
                        <Label>First Name</Label>
                        <EditInput
                          type="text"
                          value={editFirstName}
                          onChange={(e) => {
                            console.log("First name changed:", e.target.value);
                            setEditFirstName(e.target.value);
                          }}
                          placeholder="First name"
                        />
                      </FormGroup>
                      
                      <FormGroup>
                        <Label>Last Name</Label>
                        <EditInput
                          type="text"
                          value={editLastName}
                          onChange={(e) => {
                            console.log("Last name changed:", e.target.value);
                            setEditLastName(e.target.value);
                          }}
                          placeholder="Last name"
                        />
                      </FormGroup>
                      
                      <FormGroup>
                        <Label>Email</Label>
                        <EmailDisplay>{userEmail}</EmailDisplay>
                      </FormGroup>

                      <SecuritySection>
                        <SecurityTitle>🔐 Security Settings</SecurityTitle>
                        <TwoFactorContainer>
                          <TwoFactorInfo>
                            <TwoFactorLabel>Two-Factor Authentication (2FA)</TwoFactorLabel>
                            <TwoFactorDescription>
                              {twoFactorEnabled 
                                ? "✅ Enabled - Verification code will be sent to your email on each login" 
                                : "⚠️ Disabled - Enable 2FA for extra security"}
                            </TwoFactorDescription>
                          </TwoFactorInfo>
                          <ToggleSwitch>
                            <ToggleInput
                              type="checkbox"
                              id="2fa-toggle"
                              checked={twoFactorEnabled}
                              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                            />
                            <ToggleSlider className={twoFactorEnabled ? "active" : ""} />
                          </ToggleSwitch>
                        </TwoFactorContainer>
                      </SecuritySection>
                    </ModalContent>
                    
                    <ModalActions>
                      <CancelModalButton onClick={cancelProfileEdit}>
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

        <HistorySidebarToggle onClick={handleHistoryClick}>
          <HistoryIcon>📋</HistoryIcon>
          <HistoryText>History</HistoryText>
          {completedAppointments.length > 0 && (
            <HistoryBadgeSmall>{completedAppointments.length}</HistoryBadgeSmall>
          )}
        </HistorySidebarToggle>

        {showHistorySidebar && (
          <>
            <SidebarOverlay onClick={() => setShowHistorySidebar(false)} />
            <HistorySidebar>
              <SidebarHeader>
                <SidebarTitle>Appointment History</SidebarTitle>
                <SidebarCloseButton onClick={() => setShowHistorySidebar(false)}>×</SidebarCloseButton>
              </SidebarHeader>
              
              <SidebarContent>
                {completedAppointments.length === 0 ? (
                  <NoHistoryMessage>
                    <NoHistoryIcon>📚</NoHistoryIcon>
                    <NoHistoryText>No appointment history yet</NoHistoryText>
                  </NoHistoryMessage>
                ) : (
                  <SidebarHistoryList>
                    {completedAppointments.map((appt) => (
                      <SidebarHistoryCard key={appt.id} onClick={() => {
                        setShowHistorySidebar(false);
                        openHistoryModal(appt);
                      }}>
                        <SidebarCardHeader>
                          <PetName>{appt.petName}</PetName>
                          <SidebarStatusBadge status={appt.status || "Completed"}>
                            {appt.status === "Done" ? "✅" : 
                            appt.status === "Not Attend" ? "❌" : 
                            appt.status === "Cancelled" ? "🚫" : "✅"}
                          </SidebarStatusBadge>
                        </SidebarCardHeader>
                        <ServiceInfo>{getAppointmentTypeLabel(appt.appointmentType)}</ServiceInfo>
                        <DateInfo>{formatDate(appt.date)} • {appt.timeSlot}</DateInfo>
                        <ClickHint>Click for details</ClickHint>
                      </SidebarHistoryCard>
                    ))}
                  </SidebarHistoryList>
                )}
              </SidebarContent>
            </HistorySidebar>
          </>
        )}

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
                <CardTitle>Medical Records</CardTitle>
                <CardText>View your pets health records and documents</CardText>
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

        {showMedicalRecordsModal && (
          <ModalOverlay onClick={() => setShowMedicalRecordsModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Medical Records</ModalTitle>
                <CloseButton onClick={() => setShowMedicalRecordsModal(false)}>×</CloseButton>
              </ModalHeader>
              
              <ModalContent>
                <MedicalRecordsSection>
                  <SectionSubtitle>View Medical Records</SectionSubtitle>
                  <ViewRecordsButton onClick={() => {
                    setShowMedicalRecordsModal(false);
                    router.push("/usermedicalrecord");
                  }}>
                    Open Medical Records
                  </ViewRecordsButton>
                </MedicalRecordsSection>
              </ModalContent>
              
              <ModalActions>
                <CancelModalButton onClick={() => setShowMedicalRecordsModal(false)}>
                  Close
                </CancelModalButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}

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

        {showCancelModal && selectedAppointment && (
          <ModalOverlay onClick={() => setShowCancelModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Cancel Appointment</ModalTitle>
                <CloseButton onClick={() => setShowCancelModal(false)}>x</CloseButton>
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

// STYLED COMPONENTS - WITH FIXED INPUT STYLING
const ImageUploadHint = styled.div`
  font-size: 0.8rem;
  color: #4ecdc4;
  font-weight: 600;
  text-align: center;
  margin-top: 0.5rem;
`;

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  background: #f8f9fa;
  position: relative;
  
  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 2px 2px, rgba(78, 205, 196, 0.03) 1px, transparent 0);
    background-size: 50px 50px;
    pointer-events: none;
    z-index: 0;
  }
`;

const HistorySidebarToggle = styled.div`
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  color: white;
  padding: 1.2rem 1rem;
  border-radius: 30px 0 0 30px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(78, 205, 196, 0.3);
  z-index: 99;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  border: 3px solid white;
  
  &:hover {
    transform: translateY(-50%) translateX(-8px);
    box-shadow: 0 12px 32px rgba(78, 205, 196, 0.4);
    padding-right: 1.5rem;
  }

  @media (max-width: 768px) {
    right: 10px;
    padding: 1rem 0.8rem;
    border-radius: 24px 0 0 24px;
  }
`;

const HistoryIcon = styled.div`
  font-size: 1.6rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
`;

const HistoryText = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 1px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  
  @media (max-width: 768px) {
    writing-mode: horizontal-tb;
    text-orientation: initial;
    font-size: 0.7rem;
  }
`;

const HistoryBadgeSmall = styled.div`
  background: white;
  color: #4ecdc4;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.3rem 0.6rem;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;

const SidebarOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999;
  animation: fadeIn 0.3s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const HistorySidebar = styled.div`
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 420px;
  background: white;
  z-index: 1000;
  box-shadow: -8px 0 32px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  animation: slideInFromRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);

  @keyframes slideInFromRight {
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
    width: 100%;
    max-width: 380px;
  }

  @media (max-width: 480px) {
    width: 100%;
    max-width: none;
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.8rem;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.3px;
`;

const SidebarCloseButton = styled.button`
  background: rgba(255, 255, 255, 0.25);
  border: none;
  color: white;
  font-size: 1.8rem;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
  font-weight: 300;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
    transform: rotate(90deg);
  }
`;

const SidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.2rem;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #4ecdc4;
    border-radius: 4px;
  }
`;

const SidebarHistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const SidebarHistoryCard = styled.div`
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  padding: 1.2rem;
  border-radius: 16px;
  border: 2px solid #e9ecef;
  border-left: 5px solid #6c757d;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);

  &:hover {
    background: white;
    transform: translateX(-5px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
    border-left-color: #4ecdc4;
  }
`;

const SidebarCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
`;

const SidebarStatusBadge = styled.span<{ status: string }>`
  font-size: 1.2rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${props => {
    switch (props.status) {
      case "Done": return "#d4edda";
      case "Not Attend": return "#fff3cd";
      case "Cancelled": return "#f8d7da";
      default: return "#e2e6ea";
    }
  }};
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;

const SuccessNotification = styled.div`
  position: fixed;
  top: 24px;
  right: 24px;
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border: 2px solid #28a745;
  border-radius: 16px;
  padding: 1.2rem 1.6rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 8px 24px rgba(40, 167, 69, 0.25);
  z-index: 1001;
  animation: slideInBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);

  @keyframes slideInBounce {
    0% {
      transform: translateX(400px);
      opacity: 0;
    }
    60% {
      transform: translateX(-10px);
      opacity: 1;
    }
    100% {
      transform: translateX(0);
    }
  }

  @media (max-width: 768px) {
    top: 12px;
    right: 12px;
    left: 12px;
  }
`;

const SuccessIcon = styled.div`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.1rem;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
`;

const SuccessText = styled.span`
  color: #155724;
  font-weight: 600;
  flex: 1;
  font-size: 0.95rem;
`;

const CloseSuccessButton = styled.button`
  background: rgba(21, 87, 36, 0.1);
  border: none;
  font-size: 1.5rem;
  color: #155724;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(21, 87, 36, 0.2);
    transform: rotate(90deg) scale(1.1);
  }
`;

const HeaderBar = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 2.5rem;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  box-shadow: 0 4px 20px rgba(78, 205, 196, 0.25);
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1.2rem;
    position: relative;
    flex-wrap: wrap;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
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
      animation: slideDown 0.3s ease;
    }
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  color: white;
`;

const LogoIcon = styled.div`
  font-size: 2.2rem;
  background: rgba(255, 255, 255, 0.25);
  padding: 0.7rem;
  border-radius: 14px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.05) rotate(-5deg);
  }
`;

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
`;

const ClinicName = styled.span`
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
  letter-spacing: -0.5px;
`;

const LogoSubtext = styled.span`
  font-size: 0.8rem;
  opacity: 0.95;
  font-weight: 600;
  letter-spacing: 0.3px;
`;

const UserInfo = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-right: 1rem;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);

  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  background: rgba(255, 255, 255, 0.25);
  border: none;
  cursor: pointer;
  padding: 0.6rem;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.35);
  }
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const HamburgerIcon = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 26px;
  height: 20px;
  
  span {
    height: 3px;
    width: 100%;
    background-color: white;
    border-radius: 3px;
    transition: all 0.3s ease;
  }
  
  &.open span:nth-child(1) {
    transform: rotate(45deg) translate(7px, 7px);
  }
  
  &.open span:nth-child(2) {
    opacity: 0;
  }
  
  &.open span:nth-child(3) {
    transform: rotate(-45deg) translate(7px, -7px);
  }
`;

const ProfileContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ProfileIconButton = styled.div`
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }
`;

const ProfileAvatar = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
  
  ${ProfileIconButton}:hover & {
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 6px 16px rgba(0,0,0,0.25);
  }
`;

const ProfileImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DefaultAvatar = styled.div`
  font-size: 1.4rem;
  color: #4ecdc4;
`;

const DefaultAvatarLarge = styled(DefaultAvatar)`
  font-size: 4.5rem;
`;

const LogoutButton = styled.button`
  background: rgba(255, 255, 255, 0.25);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.4);
  padding: 0.7rem 1.4rem;
  border-radius: 25px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.35);
    border-color: rgba(255, 255, 255, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Content = styled.div`
  flex: 1;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    padding: 1.2rem;
    gap: 1.8rem;
  }
`;

const WelcomeSection = styled.div`
  background: white;
  padding: 2.8rem;
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  text-align: center;
  border-top: 5px solid #4ecdc4;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(78,205,196,0.05) 0%, transparent 70%);
    animation: rotate 20s linear infinite;
  }
  
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    padding: 2rem;
  }
`;

const WelcomeTitle = styled.h1`
  font-size: 2.3rem;
  font-weight: 800;
  color: #2c3e50;
  margin: 0 0 0.6rem 0;
  position: relative;
  z-index: 1;
  letter-spacing: -0.8px;

  @media (max-width: 768px) {
    font-size: 1.7rem;
  }
`;

const WelcomeSubtitle = styled.p`
  font-size: 1.15rem;
  color: #7f8c8d;
  margin: 0;
  position: relative;
  z-index: 1;
  font-weight: 500;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.8rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.2rem;
  }
`;

const Card = styled.div`
  background: white;
  border-radius: 20px;
  padding: 2.2rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  border: 2px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 1.6rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: linear-gradient(90deg, #4ecdc4, #44a08d);
    transform: scaleX(0);
    transition: transform 0.3s ease;
  }

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 16px 40px rgba(78, 205, 196, 0.2);
    border-color: #4ecdc4;
    
    &::before {
      transform: scaleX(1);
    }
  }

  @media (max-width: 768px) {
    padding: 1.8rem;
    gap: 1.2rem;
  }
`;

const CardIcon = styled.div`
  font-size: 2.8rem;
  color: #4ecdc4;
  background: linear-gradient(135deg, #e8f8f5 0%, #d4edda 100%);
  padding: 1.3rem;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 85px;
  height: 85px;
  box-shadow: 0 4px 16px rgba(78, 205, 196, 0.2);
  transition: all 0.3s ease;
  
  ${Card}:hover & {
    transform: scale(1.1) rotate(-5deg);
    box-shadow: 0 6px 20px rgba(78, 205, 196, 0.3);
  }

  @media (max-width: 768px) {
    font-size: 2.2rem;
    min-width: 70px;
    height: 70px;
    padding: 1rem;
  }
`;

const CardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const CardTitle = styled.h3`
  font-size: 1.4rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
  letter-spacing: -0.3px;

  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

const CardText = styled.p`
  font-size: 0.95rem;
  color: #6c757d;
  margin: 0;
  line-height: 1.5;
  font-weight: 500;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const AppointmentsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
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
  gap: 1.2rem;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 1.7rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
  letter-spacing: -0.5px;

  @media (max-width: 768px) {
    font-size: 1.4rem;
  }
`;

const AppointmentCount = styled.span`
  background: #4ecdc4;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
`;

const AppointmentsList = styled.div`
  display: grid;
  gap: 1.3rem;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AppointmentCard = styled.div`
  background: white;
  padding: 1.8rem;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  border: 2px solid #e9ecef;
  border-left: 6px solid #ffc107;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
  }

  @media (max-width: 768px) {
    padding: 1.4rem;
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
  gap: 0.6rem;
  flex: 1;
`;

const AppointmentStatus = styled.div`
  font-weight: 700;
  color: #2c3e50;
  font-size: 1.05rem;
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
  font-weight: 500;
`;

const AppointmentSeparator = styled.span`
  color: #dee2e6;
  margin: 0 0.25rem;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
    gap: 0.8rem;
  }
`;

const EditButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 0.75rem 1.4rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  transition: all 0.3s ease;
  flex: 1;
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);

  &:hover {
    background: #45b7b8;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(78, 205, 196, 0.4);
  }
`;

const DeleteButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.75rem 1.4rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  transition: all 0.3s ease;
  flex: 1;
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);

  &:hover {
    background: #c0392b;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
  }
`;

const NoAppointments = styled.div`
  text-align: center;
  padding: 3.5rem 2rem;
  background: white;
  border-radius: 24px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  border: 2px solid #e9ecef;
  border-top: 5px solid #4ecdc4;

  @media (max-width: 768px) {
    padding: 2.5rem 1.5rem;
  }
`;

const NoAppointmentsIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.6;
  filter: grayscale(0.3);
`;

const NoAppointmentsText = styled.p`
  font-size: 1.15rem;
  color: #6c757d;
  margin-bottom: 2rem;
  font-weight: 500;
`;

const ScheduleButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(78, 205, 196, 0.3);

  &:hover {
    background: #45b7b8;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(78, 205, 196, 0.4);
  }
`;

const MedicalRecordsSection = styled.div`
  padding: 2rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 16px;
  border-left: 5px solid #4ecdc4;
  text-align: center;
`;

const SectionSubtitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 1.5rem 0;
  letter-spacing: -0.3px;
`;

const ViewRecordsButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(78, 205, 196, 0.3);

  &:hover {
    background: #45b7b8;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(78, 205, 196, 0.4);
  }
`;

const NoHistoryMessage = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  background: #f8f9fa;
  border-radius: 16px;
  border: 2px solid #e9ecef;
`;

const NoHistoryIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1.5rem;
  opacity: 0.5;
`;

const NoHistoryText = styled.p`
  color: #6c757d;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 500;
`;

const PetName = styled.div`
  font-weight: 700;
  color: #2c3e50;
  font-size: 1rem;
  letter-spacing: -0.2px;
`;

const ServiceInfo = styled.div`
  color: #4ecdc4;
  font-size: 0.9rem;
  font-weight: 600;
`;

const DateInfo = styled.div`
  color: #6c757d;
  font-size: 0.85rem;
  font-weight: 500;
`;

const ClickHint = styled.div`
  font-size: 0.75rem;
  color: #4ecdc4;
  font-weight: 600;
  text-align: center;
  opacity: 0.8;
  margin-top: 0.3rem;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.3s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 24px;
  width: 90%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: slideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  
  @keyframes slideUp {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 0 24px 24px 0;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #4ecdc4;
    border-radius: 4px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem;
  border-bottom: 2px solid #e9ecef;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.5rem;
  color: #2c3e50;
  font-weight: 700;
  letter-spacing: -0.5px;
`;

const CloseButton = styled.button`
  background: #f8f9fa;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
  font-weight: 300;

  &:hover {
    background: #e9ecef;
    color: #2c3e50;
    transform: rotate(90deg);
  }
`;

const ModalContent = styled.div`
  padding: 2rem;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 2rem;
  border-top: 2px solid #e9ecef;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const CancelModalButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.85rem 1.8rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);

  &:hover {
    background: #5a6268;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(108, 117, 125, 0.4);
  }
`;

const ConfirmButton = styled.button`
  background: #4ecdc4;
  color: white;
  border: none;
  padding: 0.85rem 1.8rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);

  &:hover {
    background: #45b7b8;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(78, 205, 196, 0.4);
  }
`;

const DeleteModalButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.85rem 1.8rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);

  &:hover {
    background: #c0392b;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
  }
`;

const SaveProfileButton = styled(ConfirmButton)``;

const AppointmentInfoModal = styled.div`
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 1.5rem;
  border-radius: 16px;
  margin-bottom: 1.8rem;
  border-left: 5px solid #4ecdc4;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;

const InfoItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #dee2e6;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const InfoLabel = styled.span`
  font-weight: 700;
  color: #495057;
  font-size: 0.95rem;
`;

const InfoValue = styled.span`
  color: #2c3e50;
  font-weight: 600;
  font-size: 0.95rem;
`;

const WarningMessage = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border: 2px solid #ffc107;
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.8rem;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);
`;

const WarningIcon = styled.div`
  font-size: 2rem;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
`;

const WarningText = styled.p`
  color: #856404;
  margin: 0;
  line-height: 1.6;
  font-weight: 600;
  font-size: 0.95rem;
`;

const AppointmentDetails = styled.div`
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 1.5rem;
  border-radius: 16px;
  border-left: 5px solid #e74c3c;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #dee2e6;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const DetailLabel = styled.span`
  font-weight: 700;
  color: #495057;
  font-size: 0.95rem;
`;

const DetailValue = styled.span`
  color: #2c3e50;
  font-weight: 600;
  font-size: 0.95rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  font-weight: 700;
  color: #495057;
  font-size: 0.95rem;
`;

const DateInput = styled.input`
  padding: 0.9rem;
  border: 2px solid #ced4da;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: white;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 4px rgba(78, 205, 196, 0.15);
  }
`;

const SelectInput = styled.select`
  padding: 0.9rem;
  border: 2px solid #ced4da;
  border-radius: 12px;
  font-size: 1rem;
  background: white;
  transition: all 0.3s ease;
  cursor: pointer;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 4px rgba(78, 205, 196, 0.15);
  }
`;

const ProfileModalOverlay = styled(ModalOverlay)``;

const LargeProfileModal = styled(ModalContainer)`
  max-width: 640px;
`;

const ProfileImageSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1.2rem;
`;

const ProfileImagePreview = styled.div`
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #4ecdc4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  box-shadow: 0 8px 24px rgba(78, 205, 196, 0.3);
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 12px 32px rgba(78, 205, 196, 0.4);
  }
`;

const ImageUploadLabel = styled.label`
  padding: 0.8rem 1.6rem;
  background: #4ecdc4;
  color: white;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 700;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  
  &:hover {
    background: #45b7b8;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(78, 205, 196, 0.4);
  }
`;

const ImageUploadInput = styled.input`
  display: none;
`;

// FIXED EditInput component with proper styling
const EditInput = styled.input`
  padding: 0.9rem;
  border: 2px solid #ced4da;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: white;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 4px rgba(78, 205, 196, 0.15);
  }
  
  // Ensure the input is clickable and typeable
  pointer-events: auto;
  opacity: 1;
`;

const EmailDisplay = styled.div`
  padding: 0.9rem;
  background: #f8f9fa;
  border-radius: 12px;
  color: #6c757d;
  font-size: 1rem;
  border: 2px solid #e9ecef;
  font-weight: 500;
  width: 100%;
`;

const SecuritySection = styled.div`
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 2rem;
  border-radius: 16px;
  margin-top: 2rem;
  border: 2px solid #dee2e6;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
`;

const SecurityTitle = styled.h4`
  margin: 0 0 1.5rem 0;
  font-size: 1.2rem;
  color: #2c3e50;
  font-weight: 700;
  letter-spacing: -0.3px;
`;

const TwoFactorContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.2rem;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 2px solid #dee2e6;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;

const TwoFactorInfo = styled.div`
  flex: 1;
`;

const TwoFactorLabel = styled.div`
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 0.4rem;
  font-size: 1rem;
`;

const TwoFactorDescription = styled.div`
  font-size: 0.85rem;
  color: #6c757d;
  line-height: 1.5;
  font-weight: 500;
`;

const ToggleSwitch = styled.label`
  position: relative;
  display: inline-block;
  width: 64px;
  height: 36px;
  flex-shrink: 0;
  cursor: pointer;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background-color: #4ecdc4;
  }

  &:checked + span:before {
    transform: translateX(28px);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 36px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);

  &:before {
    position: absolute;
    content: "";
    height: 28px;
    width: 28px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  &.active {
    background-color: #4ecdc4;
    box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
  }
`;