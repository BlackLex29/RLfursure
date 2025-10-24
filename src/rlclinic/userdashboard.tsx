"use client"

import type React from "react"
import { useEffect, useState } from "react"
import styled, { createGlobalStyle } from "styled-components"
import { useRouter } from "next/navigation"
import { auth, db, storage } from "../firebaseConfig"
import { signOut } from "firebase/auth"
import { collection, onSnapshot, doc, deleteDoc, query, where, updateDoc, getDoc, setDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f8fafc;
    scroll-behavior: smooth;
  }
  
  * {
    box-sizing: border-box;
  }
`

const SidebarStatusBadge = styled.span<{ status: string }>`
  padding: 0.3rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Done":
        return "#26ee54"
      case "Not Attend":
        return "#99b145"
      case "Cancelled":
        return "#f8d7da"
      default:
        return "#d1ecf1"
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "Done":
        return "#155724"
      case "Not Attend":
        return "#721c24"
      case "Cancelled":
        return "#721c24"
      default:
        return "#0c5460"
    }
  }};
`

interface AppointmentType {
  id: string
  clientName: string
  petName: string
  date: string
  timeSlot: string
  status?: string
  paymentMethod?: string
  appointmentType?: string
  completedAt?: string
  notes?: string
  veterinarian?: string
}

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  profilePicture?: string
  twoFactorEnabled?: boolean
}

interface Pet {
  id: string
  name: string
  petType: string
  breed: string
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
  "5:00 PM–5:30 PM",
]

const UserDashboard: React.FC = () => {
  const router = useRouter()
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [completedAppointments, setCompletedAppointments] = useState<AppointmentType[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [editDate, setEditDate] = useState("")
  const [editSlot, setEditSlot] = useState("")
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  const [isSidebarVisible, setIsSidebarVisible] = useState(true)

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [profilePictureUrl, setProfilePictureUrl] = useState("")
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  // 2FA States
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [showOTPSetup, setShowOTPSetup] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [isSendingOTP, setIsSendingOTP] = useState(false)
  const [otpEmail, setOtpEmail] = useState("")

  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null)
  const [showHistorySidebar, setShowHistorySidebar] = useState(false)

  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  const [today, setToday] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // New state for active menu item
  const [activeMenuItem, setActiveMenuItem] = useState<string>("dashboard")

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setShowSuccessMessage(true)
    setTimeout(() => {
      setShowSuccessMessage(false)
    }, 3000)
  }

  useEffect(() => {
    setIsClient(true)
    setToday(new Date().toISOString().split("T")[0])

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserEmail(user.email)
        setUserId(user.uid)
        setOtpEmail(user.email || "")
      } else {
        router.push("/")
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!userEmail || !userId) return

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId))
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile
          setUserProfile(profileData)
          setEditFirstName(profileData.firstName || userEmail.split("@")[0])
          setEditLastName(profileData.lastName || "")
          setProfilePictureUrl(profileData.profilePicture || "")
          setTwoFactorEnabled(profileData.twoFactorEnabled || false)
        } else {
          const defaultProfile: UserProfile = {
            firstName: userEmail.split("@")[0],
            lastName: "",
            email: userEmail,
            twoFactorEnabled: false,
          }
          await setDoc(doc(db, "users", userId), defaultProfile)
          setUserProfile(defaultProfile)
          setEditFirstName(defaultProfile.firstName)
          setEditLastName("")
          setProfilePictureUrl("")
          setTwoFactorEnabled(false)
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)
        const defaultProfile: UserProfile = {
          firstName: userEmail.split("@")[0],
          lastName: "",
          email: userEmail,
          twoFactorEnabled: false,
        }
        setUserProfile(defaultProfile)
        setEditFirstName(defaultProfile.firstName)
        setEditLastName("")
        setProfilePictureUrl("")
        setTwoFactorEnabled(false)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()

    // Fetch pets for the current user
    const petsQuery = query(collection(db, "pets"), where("ownerId", "==", userId))

    const unsubscribePets = onSnapshot(petsQuery, (snapshot) => {
      const petsData: Pet[] = []
      snapshot.forEach((doc) => {
        const petData = doc.data()
        petsData.push({
          id: doc.id,
          name: petData.name || petData.petName || "Unnamed Pet",
          petType: petData.petType || "",
          breed: petData.petBreed || "",
        })
      })
      setPets(petsData)
    })

    const activeQuery = query(collection(db, "appointments"), where("clientName", "==", userEmail))

    const activeUnsub = onSnapshot(activeQuery, (snapshot) => {
      const data: AppointmentType[] = []
      snapshot.forEach((doc) => {
        const appointmentData = { id: doc.id, ...(doc.data() as Omit<AppointmentType, "id">) }
        if (!["Done", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData)
        }
      })
      data.sort((a, b) => a.date.localeCompare(b.date))
      setAppointments(data)
    })

    const completedQuery = query(collection(db, "appointments"), where("clientName", "==", userEmail))

    const completedUnsub = onSnapshot(completedQuery, (snapshot) => {
      const data: AppointmentType[] = []
      snapshot.forEach((doc) => {
        const appointmentData = { id: doc.id, ...(doc.data() as Omit<AppointmentType, "id">) }
        if (["Done", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData)
        }
      })
      data.sort((a, b) => {
        const dateA = a.completedAt || a.date
        const dateB = b.completedAt || b.date
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setCompletedAppointments(data)
    })

    return () => {
      unsubscribePets()
      activeUnsub()
      completedUnsub()
    }
  }, [userEmail, userId])

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/homepage")
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "appointments", id))
      setShowCancelModal(false)
      showSuccess("Appointment cancelled successfully!")
    } catch (error) {
      console.error(error)
      alert("Failed to cancel appointment.")
    }
  }

  const openCancelModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt)
    setShowCancelModal(true)
  }

  const openRescheduleModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt)
    setEditDate(appt.date || today)
    setEditSlot(appt.timeSlot)
    setShowRescheduleModal(true)
  }

  const openHistoryModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt)
    setShowHistoryModal(true)
  }

  const handleHistoryClick = () => {
    setShowHistorySidebar(true)
  }

  const handleProfileClick = () => {
    setShowProfileModal(true)
  }

  const handle2FAClick = () => {
    setShow2FAModal(true)
  }

  const saveEdit = async () => {
    if (!selectedAppointment || !editDate || !editSlot) {
      return alert("Please select date and time slot.")
    }

    const isTaken = appointments.some(
      (a) =>
        a.id !== selectedAppointment.id && a.date === editDate && a.timeSlot === editSlot && a.status !== "Cancelled",
    )

    if (isTaken) return alert("This time slot is already taken.")

    try {
      await updateDoc(doc(db, "appointments", selectedAppointment.id), {
        date: editDate,
        timeSlot: editSlot,
      })
      setShowRescheduleModal(false)
      setSelectedAppointment(null)
      showSuccess("Appointment rescheduled successfully!")
    } catch (error) {
      console.error(error)
      alert("Failed to reschedule appointment.")
    }
  }

  const uploadImageToStorage = async (file: File): Promise<string> => {
    if (!userId) throw new Error("No user ID")

    const fileExtension = file.name.split(".").pop()
    const fileName = `profile-picture-${Date.now()}.${fileExtension}`

    const storageRef = ref(storage, `profile-pictures/${userId}/${fileName}`)
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    return downloadURL
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file (JPEG, PNG, etc.)")
        event.target.value = ""
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Please select an image smaller than 5MB")
        event.target.value = ""
        return
      }

      setProfilePictureFile(file)
      const imageUrl = URL.createObjectURL(file)
      setProfilePictureUrl(imageUrl)
    }
  }

  const saveProfileChanges = async () => {
    if (!userId) {
      console.error("No user ID found")
      return
    }

    try {
      let imageUrl = profilePictureUrl

      if (profilePictureFile) {
        try {
          imageUrl = await uploadImageToStorage(profilePictureFile)
        } catch (error) {
          console.error("Error uploading image:", error)
          alert("Failed to upload profile picture. Please try again.")
          return
        }
      }

      const updatedProfile = {
        firstName: editFirstName.trim() || userEmail?.split("@")[0] || "User",
        lastName: editLastName.trim(),
        email: userEmail || "",
        profilePicture: imageUrl,
        updatedAt: new Date().toISOString(),
      }

      await updateDoc(doc(db, "users", userId), updatedProfile)

      setUserProfile((prevProfile) => ({
        ...prevProfile!,
        ...updatedProfile,
      }))

      setProfilePictureFile(null)
      setShowProfileModal(false)

      showSuccess("Profile updated successfully!")
    } catch (error) {
      console.error("Error updating profile:", error)
      alert("Failed to update profile. Please try again.")
    }
  }

  const cancelProfileEdit = () => {
    setShowProfileModal(false)
    setEditFirstName(userProfile?.firstName || userEmail?.split("@")[0] || "")
    setEditLastName(userProfile?.lastName || "")
    setProfilePictureUrl(userProfile?.profilePicture || "")
    setProfilePictureFile(null)
  }

  // 2FA Functions
  const handleSendOTP = async () => {
    if (!otpEmail) {
      alert("Please enter your email address")
      return
    }

    setIsSendingOTP(true)
    try {
      const response = await fetch("/api/send-email-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: otpEmail,
          name: userProfile?.firstName || "User",
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setOtpSent(true)
        alert("OTP sent successfully to your email!")
      } else {
        alert(data.error || "Failed to send OTP")
      }
    } catch (error) {
      console.error("Error sending OTP:", error)
      alert("Failed to send OTP. Please try again.")
    } finally {
      setIsSendingOTP(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (verificationCode.length !== 6) {
      alert("Please enter a valid 6-digit OTP")
      return
    }

    try {
      // Verify OTP logic here
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      // Update 2FA status in database
      if (userId) {
        await updateDoc(doc(db, "users", userId), {
          twoFactorEnabled: true,
        })
      }
      
      setTwoFactorEnabled(true)
      setShowOTPSetup(false)
      setShow2FAModal(false)
      setVerificationCode("")
      setOtpSent(false)
      showSuccess("Two-Factor Authentication enabled successfully!")
    } catch {
      alert("Failed to verify OTP. Please try again.")
    }
  }

  const handleDisable2FA = async () => {
    if (confirm("Are you sure you want to disable Two-Factor Authentication?")) {
      try {
        if (userId) {
          await updateDoc(doc(db, "users", userId), {
            twoFactorEnabled: false,
          })
        }
        setTwoFactorEnabled(false)
        showSuccess("Two-Factor Authentication disabled")
      } catch (error) {
        console.error("Error disabling 2FA:", error)
        alert("Failed to disable 2FA. Please try again.")
      }
    }
  }

  const reset2FAForm = () => {
    setShowOTPSetup(false)
    setVerificationCode("")
    setOtpSent(false)
  }

  const getAppointmentTypeLabel = (type?: string) => {
    const types: Record<string, string> = {
      vaccination: "Vaccination",
      checkup: "Check Up",
      antiRabies: "Anti Rabies",
      ultrasound: "Ultrasound",
      groom: "Grooming",
      spayNeuter: "Spay/Neuter",
      deworm: "Deworming",
    }
    return types[type || ""] || "General Consultation"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Render different content based on active menu item
  const renderContent = () => {
    switch (activeMenuItem) {
      case "pet-registration":
        return (
          <MainContent>
            <ContentHeader>
              <ContentTitle>Pet Registration</ContentTitle>
              <ContentSubtitle>Register your pets for veterinary services</ContentSubtitle>
            </ContentHeader>
            <PetRegistrationSection>
              <PetRegistrationCard>
                <PetRegistrationIcon>🐾</PetRegistrationIcon>
                <PetRegistrationContent>
                  <PetRegistrationTitle>Register New Pet</PetRegistrationTitle>
                  <PetRegistrationText>
                    Add your pet&apos;s information to get started with appointments and medical records. Fill out the pet
                    registration form with details like name, breed, age, and medical history.
                  </PetRegistrationText>
                  <PetRegistrationButton onClick={() => router.push("/petregistration")}>
                    Start Registration
                  </PetRegistrationButton>
                </PetRegistrationContent>
              </PetRegistrationCard>

              {pets.length > 0 && (
                <ExistingPetsSection>
                  <SectionHeader>
                    <SectionTitle>Your Registered Pets ({pets.length})</SectionTitle>
                  </SectionHeader>
                  <PetsList>
                    {pets.map((pet) => (
                      <PetListItem key={pet.id}>
                        <PetItemIcon>{pet.petType === "Cat" ? "🐱" : "🐕"}</PetItemIcon>
                        <PetItemInfo>
                          <PetItemName>{pet.name}</PetItemName>
                          <PetItemDetails>
                            {pet.petType} • {pet.breed}
                          </PetItemDetails>
                        </PetItemInfo>
                        <PetItemActions>
                          <ViewRecordsButton onClick={() => router.push("/usermedicalrecord")}>
                            View Records
                          </ViewRecordsButton>
                        </PetItemActions>
                      </PetListItem>
                    ))}
                  </PetsList>
                </ExistingPetsSection>
              )}
            </PetRegistrationSection>
          </MainContent>
        )

      case "appointments":
        return (
          <MainContent>
            <ContentHeader>
              <ContentTitle>Appointment Management</ContentTitle>
              <ContentSubtitle>Schedule and manage your pet&apos;s appointments</ContentSubtitle>
            </ContentHeader>
            <AppointmentsSection>
              <SectionHeader>
                <SectionTitleGroup>
                  <SectionTitle>Active Appointments</SectionTitle>
                  {isClient && <AppointmentCount>{appointments.length} scheduled</AppointmentCount>}
                </SectionTitleGroup>
                <NewAppointmentButton onClick={() => router.push("/appointment")}>
                  + New Appointment
                </NewAppointmentButton>
              </SectionHeader>

              {appointments.length === 0 ? (
                <NoAppointments>
                  <NoAppointmentsIcon>📅</NoAppointmentsIcon>
                  <NoAppointmentsText>No active appointments</NoAppointmentsText>
                  <ScheduleButton onClick={() => router.push("/appointment")}>Schedule an Appointment</ScheduleButton>
                </NoAppointments>
              ) : (
                <AppointmentsList>
                  {appointments
                    .filter((a) => a.petName)
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
          </MainContent>
        )

      case "medical-records":
        return (
          <MainContent>
            <ContentHeader>
              <ContentTitle>Medical Records</ContentTitle>
              <ContentSubtitle>Access your pet&apos;s health history and documents</ContentSubtitle>
            </ContentHeader>
            <MedicalRecordsDashboard>
              <MedicalRecordsCard>
                <MedicalRecordsIcon>📋</MedicalRecordsIcon>
                <MedicalRecordsContent>
                  <MedicalRecordsTitle>View Medical Records</MedicalRecordsTitle>
                  <MedicalRecordsText>
                    Access complete medical history, vaccination records, treatment plans, and diagnostic reports for
                    all your registered pets.
                  </MedicalRecordsText>
                  <MedicalRecordsButton onClick={() => router.push("/usermedicalrecord")}>
                    Open Medical Records
                  </MedicalRecordsButton>
                </MedicalRecordsContent>
              </MedicalRecordsCard>
            </MedicalRecordsDashboard>
          </MainContent>
        )

      case "profile":
        return (
          <MainContent>
            <ContentHeader>
              <ContentTitle>Settings</ContentTitle>
              <ContentSubtitle>Manage your account settings and security preferences</ContentSubtitle>
            </ContentHeader>
            <ProfileDashboard>
              <ProfileInfoCard>
                <ProfileAvatarSection>
                  <ProfileAvatarLarge>
                    {userProfile?.profilePicture ? (
                      <ProfileImage src={userProfile.profilePicture} alt="Profile" />
                    ) : (
                      <DefaultAvatarLarge>👤</DefaultAvatarLarge>
                    )}
                  </ProfileAvatarLarge>
                  <ProfileName>
                    {userProfile?.firstName || "User"} {userProfile?.lastName || ""}
                  </ProfileName>
                  <ProfileEmail>{userEmail}</ProfileEmail>
                </ProfileAvatarSection>

                <ProfileDetails>
                  <DetailItem>
                    <DetailLabel>First Name:</DetailLabel>
                    <DetailValue>{userProfile?.firstName || "Not set"}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Last Name:</DetailLabel>
                    <DetailValue>{userProfile?.lastName || "Not set"}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>2FA Status:</DetailLabel>
                    <DetailValue>
                      <SecurityStatus $enabled={twoFactorEnabled}>
                        {twoFactorEnabled ? "🟢 Enabled" : "🔴 Disabled"}
                      </SecurityStatus>
                    </DetailValue>
                  </DetailItem>
                </ProfileDetails>

                <ActionButtons>
                  <EditProfileButton onClick={handleProfileClick}>Edit Profile</EditProfileButton>
                  <SecurityButton onClick={handle2FAClick}>Security Settings</SecurityButton>
                </ActionButtons>
              </ProfileInfoCard>

              <SecurityCard>
                <SecurityTitle>🔐 Security Overview</SecurityTitle>
                <SecurityFeatures>
                  <SecurityFeature>
                    <SecurityFeatureIcon>📧</SecurityFeatureIcon>
                    <SecurityFeatureInfo>
                      <SecurityFeatureTitle>Email Verification</SecurityFeatureTitle>
                      <SecurityFeatureStatus>Verified</SecurityFeatureStatus>
                    </SecurityFeatureInfo>
                  </SecurityFeature>
                  <SecurityFeature>
                    <SecurityFeatureIcon>🔒</SecurityFeatureIcon>
                    <SecurityFeatureInfo>
                      <SecurityFeatureTitle>Two-Factor Authentication</SecurityFeatureTitle>
                      <SecurityFeatureStatus>{twoFactorEnabled ? "Enabled" : "Disabled"}</SecurityFeatureStatus>
                    </SecurityFeatureInfo>
                    <SecurityActionButton onClick={handle2FAClick}>
                      {twoFactorEnabled ? "Manage" : "Enable"}
                    </SecurityActionButton>
                  </SecurityFeature>
                </SecurityFeatures>
              </SecurityCard>
            </ProfileDashboard>
          </MainContent>
        )

      default: // dashboard
        return (
          <MainContent>
            <ContentHeader>
              <ContentTitle>Dashboard Overview</ContentTitle>
              <ContentSubtitle>Welcome back! Here&apos;s your pet care summary</ContentSubtitle>
            </ContentHeader>

            <QuickStatsGrid>
              <StatCard>
                <StatIcon>📅</StatIcon>
                <StatContent>
                  <StatNumber>{appointments.length}</StatNumber>
                  <StatLabel>Active Appointments</StatLabel>
                </StatContent>
              </StatCard>
              <StatCard>
                <StatIcon>✅</StatIcon>
                <StatContent>
                  <StatNumber>{completedAppointments.length}</StatNumber>
                  <StatLabel>Completed Visits</StatLabel>
                </StatContent>
              </StatCard>
              <StatCard>
                <StatIcon>🐾</StatIcon>
                <StatContent>
                  <StatNumber>{pets.length}</StatNumber>
                  <StatLabel>Registered Pets</StatLabel>
                </StatContent>
              </StatCard>
            </QuickStatsGrid>

            {pets.length > 0 && (
              <RecentActivitySection>
                <SectionHeader>
                  <SectionTitle>Your Pets</SectionTitle>
                </SectionHeader>
                <PetsGrid>
                  {pets.slice(0, 3).map((pet) => (
                    <PetCard key={pet.id}>
                      <PetIcon>{pet.petType === "Cat" ? "🐱" : "🐕"}</PetIcon>
                      <PetInfo>
                        <PetName>{pet.name}</PetName>
                        <PetDetails>
                          {pet.petType} • {pet.breed}
                        </PetDetails>
                      </PetInfo>
                    </PetCard>
                  ))}
                  {pets.length > 3 && (
                    <ViewAllPetsCard onClick={() => setActiveMenuItem("pet-registration")}>
                      <ViewAllIcon>➕</ViewAllIcon>
                      <ViewAllText>View All {pets.length} Pets</ViewAllText>
                    </ViewAllPetsCard>
                  )}
                </PetsGrid>
              </RecentActivitySection>
            )}

            <ActionCardsGrid>
              <ActionCard onClick={() => setActiveMenuItem("profile")}>
                <ActionCardIcon>👤</ActionCardIcon>
                <ActionCardContent>
                  <ActionCardTitle>Profile & Security</ActionCardTitle>
                  <ActionCardText>Manage your profile and security settings</ActionCardText>
                </ActionCardContent>
              </ActionCard>
            </ActionCardsGrid>

            <RecentActivitySection>
              <SectionHeader>
                <SectionTitle>Recent Appointments</SectionTitle>
              </SectionHeader>
              {appointments.length === 0 ? (
                <NoActivity>
                  <NoActivityIcon>📅</NoActivityIcon>
                  <NoActivityText>No recent appointments</NoActivityText>
                </NoActivity>
              ) : (
                <ActivityList>
                  {appointments.slice(0, 3).map((appt) => (
                    <ActivityItem key={appt.id}>
                      <ActivityIcon>🐕</ActivityIcon>
                      <ActivityContent>
                        <ActivityTitle>
                          {appt.petName} - {getAppointmentTypeLabel(appt.appointmentType)}
                        </ActivityTitle>
                        <ActivityDate>
                          {formatDate(appt.date)} • {appt.timeSlot}
                        </ActivityDate>
                      </ActivityContent>
                      <ActivityStatus status={appt.status || "Pending"}>{appt.status || "Pending"}</ActivityStatus>
                    </ActivityItem>
                  ))}
                </ActivityList>
              )}
            </RecentActivitySection>
          </MainContent>
        )
    }
  }

  if (!isClient) {
    return (
      <>
        <GlobalStyle />
        <PageContainer>
          <HeaderBar>
            <HeaderLeft>
              <Logo>
                <LogoImage src="/RL.jpg" alt="RL Clinic Logo" />
                <LogoText>
                  <ClinicName>RL Clinic</ClinicName>
                  <LogoSubtext>Fursure Care - User Dashboard</LogoSubtext>
                </LogoText>
              </Logo>
            </HeaderLeft>
          </HeaderBar>
        </PageContainer>
      </>
    )
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
          <BrandSection>
            <MenuToggle 
              onClick={() => setIsSidebarVisible(!isSidebarVisible)} 
              $isOpen={isSidebarVisible}
            >
              <span></span>
              <span></span>
              <span></span>
            </MenuToggle>

            <Logo>
              <LogoImage src="/RL.jpg" alt="RL Clinic Logo" />
              <LogoText>
                <ClinicName>RL Clinic</ClinicName>
                <LogoSubtext>Fursure Care - User Dashboard</LogoSubtext>
              </LogoText>
            </Logo>
          </BrandSection>

          <UserSection>
            <UserInfo>
              {loading ? "Loading..." : `${userProfile?.firstName || "User"} ${userProfile?.lastName || ""}`.trim()}
            </UserInfo>

            <ProfileContainer>
              <ProfileIconButton onClick={handleProfileClick}>
                <ProfileAvatar>
                  {userProfile?.profilePicture ? (
                    <ProfileImage src={userProfile.profilePicture} alt="Profile" />
                  ) : (
                    <DefaultAvatar>👤</DefaultAvatar>
                  )}
                </ProfileAvatar>
              </ProfileIconButton>
            </ProfileContainer>

            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </UserSection>
        </HeaderBar>

        <DashboardLayout>
          {/* LEFT SIDEBAR MENU */}
          <Sidebar $isOpen={isSidebarVisible}>
            <SidebarHeader>
              <SidebarTitleRow>
                <SidebarTitle>Main Menu</SidebarTitle>
              </SidebarTitleRow>
            </SidebarHeader>

            <MenuList>
              <MenuItem $active={activeMenuItem === "dashboard"} onClick={() => setActiveMenuItem("dashboard")}>
                <MenuIcon>📊</MenuIcon>
                <MenuText>Dashboard</MenuText>
              </MenuItem>

              <MenuItem
                $active={activeMenuItem === "pet-registration"}
                onClick={() => setActiveMenuItem("pet-registration")}
              >
                <MenuIcon>🐾</MenuIcon>
                <MenuText>Pet Registration</MenuText>
                <MenuBadge $primary={true}>Primary</MenuBadge>
              </MenuItem>

              <MenuItem $active={activeMenuItem === "appointments"} onClick={() => setActiveMenuItem("appointments")}>
                <MenuIcon>📅</MenuIcon>
                <MenuText>Appointments</MenuText>
                {appointments.length > 0 && <MenuCount>{appointments.length}</MenuCount>}
              </MenuItem>

              <MenuItem
                $active={activeMenuItem === "medical-records"}
                onClick={() => setActiveMenuItem("medical-records")}
              >
                <MenuIcon>📋</MenuIcon>
                <MenuText>Medical Records</MenuText>
              </MenuItem>

              <MenuItem $active={activeMenuItem === "profile"} onClick={() => setActiveMenuItem("profile")}>
                <MenuIcon>👤</MenuIcon>
                <MenuText>Profile & Security</MenuText>
              </MenuItem>
            </MenuList>

            <SidebarFooter>
              <SupportSection>
                <SupportTitle>Need Help?</SupportTitle>
                <SupportText>Contact our support team for assistance</SupportText>
                <SupportButton onClick={() => router.push("/support")}>Get Support</SupportButton>
              </SupportSection>
            </SidebarFooter>
          </Sidebar>

          {/* Floating Menu Button for Mobile */}
          {!isSidebarVisible && (
            <FloatingMenuButton onClick={() => setIsSidebarVisible(true)}>
              ☰
            </FloatingMenuButton>
          )}

          {/* MAIN CONTENT AREA */}
          <ContentArea $sidebarOpen={isSidebarVisible}>
            {renderContent()}
          </ContentArea>
        </DashboardLayout>

        {/* HISTORY SIDEBAR TOGGLE */}
        <HistorySidebarToggle onClick={handleHistoryClick}>
          <HistoryIcon>📋</HistoryIcon>
          <HistoryText>History</HistoryText>
          {completedAppointments.length > 0 && <HistoryBadgeSmall>{completedAppointments.length}</HistoryBadgeSmall>}
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
                      <SidebarHistoryCard
                        key={appt.id}
                        onClick={() => {
                          setShowHistorySidebar(false)
                          openHistoryModal(appt)
                        }}
                      >
                        <SidebarCardHeader>
                          <PetName>{appt.petName}</PetName>
                          <SidebarStatusBadge status={appt.status || "Completed"}>
                            {appt.status === "Done"
                              ? "✅"
                              : appt.status === "Not Attend"
                                ? "❌"
                                : appt.status === "Cancelled"
                                  ? "🚫"
                                  : "✅"}
                          </SidebarStatusBadge>
                        </SidebarCardHeader>
                        <ServiceInfo>{getAppointmentTypeLabel(appt.appointmentType)}</ServiceInfo>
                        <DateInfo>
                          {formatDate(appt.date)} • {appt.timeSlot}
                        </DateInfo>
                        <ClickHint>Click for details</ClickHint>
                      </SidebarHistoryCard>
                    ))}
                  </SidebarHistoryList>
                )}
              </SidebarContent>
            </HistorySidebar>
          </>
        )}

        {/* PROFILE MODAL */}
        {showProfileModal && (
          <ModalOverlay onClick={cancelProfileEdit}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Profile Settings</ModalTitle>
                <CloseButton onClick={cancelProfileEdit}>×</CloseButton>
              </ModalHeader>

              <ModalContent>
                <ProfileSection>
                  <SectionTitle>👤 Profile Information</SectionTitle>

                  <ProfileImageSection>
                    <ProfileImagePreview>
                      {profilePictureUrl ? (
                        <ProfileImage src={profilePictureUrl} alt="Profile Preview" />
                      ) : (
                        <DefaultAvatarLarge>👤</DefaultAvatarLarge>
                      )}
                    </ProfileImagePreview>
                    <ImageUploadLabel htmlFor="profile-pic">
                      Change Photo
                      <ImageUploadInput type="file" accept="image/*" onChange={handleImageUpload} id="profile-pic" />
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
                </ProfileSection>
              </ModalContent>

              <ModalActions>
                <CancelModalButton onClick={cancelProfileEdit}>Cancel</CancelModalButton>
                <SaveProfileButton onClick={saveProfileChanges}>Save Changes</SaveProfileButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}

        {/* 2FA MODAL */}
        {show2FAModal && (
          <ModalOverlay onClick={() => setShow2FAModal(false)}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>Two-Factor Authentication</ModalTitle>
                <CloseButton onClick={() => setShow2FAModal(false)}>×</CloseButton>
              </ModalHeader>

              <ModalContent>
                <SecuritySection>
                  <SectionTitle>🔐 Security Settings</SectionTitle>
                  
                  {!showOTPSetup ? (
                    <TwoFactorContainer>
                      <TwoFactorInfo>
                        <TwoFactorLabel>Two-Factor Authentication (2FA)</TwoFactorLabel>
                        <TwoFactorDescription>
                          {twoFactorEnabled
                            ? "✅ Enabled - Verification code will be sent to your email on each login"
                            : "⚠️ Disabled - Enable 2FA for extra security"}
                        </TwoFactorDescription>
                      </TwoFactorInfo>
                      
                      {!twoFactorEnabled ? (
                        <Enable2FAButton onClick={() => setShowOTPSetup(true)}>
                          Enable 2FA
                        </Enable2FAButton>
                      ) : (
                        <Disable2FAButton onClick={handleDisable2FA}>
                          Disable 2FA
                        </Disable2FAButton>
                      )}
                    </TwoFactorContainer>
                  ) : (
                    <OTPSetupSection>
                      <OTPSetupTitle>Set up Two-Factor Authentication</OTPSetupTitle>

                      {!otpSent ? (
                        <OTPEmailSection>
                          <FormGroup>
                            <Label>Email Address for OTP</Label>
                            <EmailInput
                              type="email"
                              value={otpEmail}
                              onChange={(e) => setOtpEmail(e.target.value)}
                              placeholder="Enter your email"
                              disabled={isSendingOTP}
                            />
                          </FormGroup>
                          <SendOTPButton onClick={handleSendOTP} disabled={isSendingOTP || !otpEmail}>
                            {isSendingOTP ? "Sending OTP..." : "Send OTP"}
                          </SendOTPButton>
                        </OTPEmailSection>
                      ) : (
                        <OTPVerificationSection>
                          <OTPInstructions>
                            We&apos;ve sent a 6-digit verification code to your email. Please enter it below to enable
                            2FA.
                          </OTPInstructions>

                          <OTPInputGroup>
                            <FormGroup>
                              <Label>Enter 6-digit OTP</Label>
                              <OTPInput
                                type="text"
                                maxLength={6}
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="000000"
                              />
                            </FormGroup>
                            <ResendOTPText>
                              Didn&apos;t receive the code?{" "}
                              <ResendLink onClick={handleSendOTP} disabled={isSendingOTP}>
                                {isSendingOTP ? "Sending..." : "Resend OTP"}
                              </ResendLink>
                            </ResendOTPText>
                          </OTPInputGroup>

                          <OTPButtonGroup>
                            <CancelModalButton onClick={reset2FAForm}>
                              Cancel
                            </CancelModalButton>
                            <SubmitButton onClick={handleVerifyOTP} disabled={verificationCode.length !== 6}>
                              Verify & Enable 2FA
                            </SubmitButton>
                          </OTPButtonGroup>
                        </OTPVerificationSection>
                      )}
                    </OTPSetupSection>
                  )}
                </SecuritySection>
              </ModalContent>

              {!showOTPSetup && (
                <ModalActions>
                  <CancelModalButton onClick={() => setShow2FAModal(false)}>Close</CancelModalButton>
                </ModalActions>
              )}
            </ModalContainer>
          </ModalOverlay>
        )}

        {/* OTHER MODALS */}
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
                  <DateInput type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} min={today} />
                </FormGroup>

                <FormGroup>
                  <Label>New Time Slot:</Label>
                  <SelectInput value={editSlot} onChange={(e) => setEditSlot(e.target.value)}>
                    <option value="">Select a time slot</option>
                    {timeSlots.map((slot) => {
                      const isTaken = appointments.some(
                        (a) =>
                          a.id !== selectedAppointment.id &&
                          a.date === editDate &&
                          a.timeSlot === slot &&
                          a.status !== "Cancelled",
                      )
                      return (
                        <option key={slot} value={slot} disabled={isTaken}>
                          {slot} {isTaken ? "(Taken)" : ""}
                        </option>
                      )
                    })}
                  </SelectInput>
                </FormGroup>
              </ModalContent>

              <ModalActions>
                <CancelModalButton onClick={() => setShowRescheduleModal(false)}>Cancel</CancelModalButton>
                <ConfirmButton onClick={saveEdit}>Confirm Reschedule</ConfirmButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}

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
                <CancelModalButton onClick={() => setShowCancelModal(false)}>Keep Appointment</CancelModalButton>
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
                        {selectedAppointment.status === "Done"
                          ? "✅ Completed"
                          : selectedAppointment.status === "Not Attend"
                            ? "❌ No Show"
                            : selectedAppointment.status === "Cancelled"
                              ? "🚫 Cancelled"
                              : selectedAppointment.status}
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
                <CancelModalButton onClick={() => setShowHistoryModal(false)}>Close</CancelModalButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        )}
      </PageContainer>
    </>
  )
}

export default UserDashboard

// STYLED COMPONENTS - UPDATED WITH SIDEBAR TOGGLE FUNCTIONALITY

const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`

const HeaderBar = styled.header`
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 1rem 2rem; 
  background: #4ECDC4;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-bottom: 1px solid #e9ecef;
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
`

const BrandSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const MenuToggle = styled.div<{ $isOpen?: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 28px;
  height: 22px;
  cursor: pointer;
  position: relative;

  span {
    height: 3px;
    width: 100%;
    background-color: #2c3e50;
    border-radius: 3px;
    transition: all 0.3s ease;
    transform-origin: center;
    
    &:nth-child(1) {
      transform: ${(props) => (props.$isOpen ? "translateY(9.5px) rotate(45deg)" : "translateY(0) rotate(0)")};
    }
    
    &:nth-child(2) {
      opacity: ${(props) => (props.$isOpen ? "0" : "1")};
      transform: ${(props) => (props.$isOpen ? "translateX(-20px)" : "translateX(0)")};
    }
    
    &:nth-child(3) {
      transform: ${(props) => (props.$isOpen ? "translateY(-9.5px) rotate(-45deg)" : "translateY(0) rotate(0)")};
    }
  }

  &:hover span {
    background-color: #34B89C;
  }
`

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const LogoImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
`

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
`

const ClinicName = styled.div`
  font-weight: 800;
  font-size: 1.8rem;
  color: #2c3e50;
  letter-spacing: -0.5px;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`

const LogoSubtext = styled.div`
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 500;

  @media (max-width: 768px) {
    display: none;
  }
`

const UserSection = styled.div`
  display: flex; 
  align-items: center; 
  gap: 1rem;

  @media (max-width: 480px) {
    gap: 0.7rem;
  }
`

const UserInfo = styled.div`
  font-weight: 600;
  color: #2c3e50;
  
  @media (max-width: 768px) {
    display: none;
  }
`

const ProfileContainer = styled.div`
  display: flex;
  align-items: center;
`

const ProfileIconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 50%;
  transition: background 0.3s ease;
  
  &:hover {
    background: #f8f9fa;
  }
`

const ProfileAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f9f7;
`

const ProfileImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const DefaultAvatar = styled.div`
  font-size: 1.2rem;
  color: #6c757d;
`

const DefaultAvatarLarge = styled(DefaultAvatar)`
  font-size: 3rem;
`

const LogoutButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #c0392b;
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }
`

const DashboardLayout = styled.div`
  display: flex;
  min-height: calc(100vh - 80px);
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`

const Sidebar = styled.aside<{ $isOpen: boolean }>`
  width: 280px;
  background: white;
  border-right: 1px solid #e9ecef;
  display: flex;  
  flex-direction: column;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 90;

  @media (max-width: 1024px) {
    position: fixed;
    left: 0;
    top: 80px;
    height: calc(100vh - 80px);
    transform: translateX(${(props) => (props.$isOpen ? "0" : "-100%")});
    box-shadow: ${(props) => (props.$isOpen ? "4px 0 20px rgba(0,0,0,0.15)" : "none")};
  }

  @media (min-width: 1025px) {
    transform: translateX(${(props) => (props.$isOpen ? "0" : "-280px")});
    position: ${(props) => (props.$isOpen ? "static" : "fixed")};
  }
`

const SidebarHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const SidebarTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`

const SidebarTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #2c3e50;
  letter-spacing: -0.3px;
`

const MenuList = styled.div`
  flex: 1;
  padding: 1rem 0;
`

const MenuItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid ${(props) => (props.$active ? "#34B89C" : "transparent")};
  background: ${(props) => (props.$active ? "#f8f9fa" : "transparent")};
  
  &:hover {
    background: #f8f9fa;
    border-left-color: #34B89C;
  }
`

const MenuIcon = styled.div`
  font-size: 1.3rem;
  color: #2c3e50;
`

const MenuText = styled.span`
  flex: 1;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
`

const MenuBadge = styled.span<{ $primary: boolean }>`
  background: ${(props) => (props.$primary ? "#34B89C" : "#6c757d")};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
`

const MenuCount = styled.span`
  background: #e74c3c;
  color: white;
  padding: 0.25rem 0.6rem;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const SidebarFooter = styled.div`
  padding: 1.5rem;
  border-top: 1px solid #e9ecef;
  background: #ffffff;
`

const SupportSection = styled.div`
  text-align: center;
`

const SupportTitle = styled.h4`
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #2c3e50;
  font-weight: 600;
`

const SupportText = styled.p`
  margin: 0 0 1rem 0;
  font-size: 0.8rem;
  color: #6c757d;
  line-height: 1.4;
`

const SupportButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  
  &:hover {
    background: #5a6268;
    transform: translateY(-1px);
  }
`

const FloatingMenuButton = styled.button`
  position: fixed;
  top: 90px;
  left: 15px;
  z-index: 80;
  background: #34B89C;
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #2a9d7f;
    transform: scale(1.1);
  }

  @media (min-width: 1025px) {
    display: none;
  }
`

const ContentArea = styled.main<{ $sidebarOpen: boolean }>`
  flex: 1;
  background: #f8fafc;
  overflow-y: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  padding: 2rem;
  
  @media (min-width: 1025px) {
    margin-left: ${(props) => (props.$sidebarOpen ? "280px" : "0")};
    width: ${(props) => (props.$sidebarOpen ? "calc(100% - 280px)" : "100%")};
  }

  @media (max-width: 1024px) {
    margin-left: 0;
    width: 100%;
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
  }

  @media (max-width: 480px) {
    padding: 1rem;
  }
`

const MainContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
`

const ContentHeader = styled.div`
  margin-bottom: 2rem;
  padding: 0;
`

const ContentTitle = styled.h1`
  margin: 0 0 0.5rem 0;
  font-size: 2.2rem;
  font-weight: 800;
  color: #2c3e50;
  letter-spacing: -0.8px;
  
  @media (max-width: 768px) {
    font-size: 1.8rem;
  }
`

const ContentSubtitle = styled.p`
  margin: 0;
  font-size: 1.1rem;
  color: #6c757d;
  font-weight: 500;
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`

const QuickStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`

const StatCard = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`

const StatIcon = styled.div`
  font-size: 2.5rem;
  color: #34B89C;
`

const StatContent = styled.div`
  display: flex;
  flex-direction: column;
`

const StatNumber = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: #2c3e50;
  line-height: 1;
`

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 600;
`

const ActionCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`

const ActionCard = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 1rem;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #34B89C;
  }
`

const ActionCardIcon = styled.div`
  font-size: 2.2rem;
  color: #34B89C;
  background: #f0f9f7;
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 70px;
  height: 70px;
  border: 1px solid #e0f2ed;
`

const ActionCardContent = styled.div`
  flex: 1;
`

const ActionCardTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
`

const ActionCardText = styled.p`
  font-size: 0.9rem;
  color: #6c757d;
  margin: 0;
  line-height: 1.4;
`

const RecentActivitySection = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  margin-bottom: 2rem;
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
`

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
`

const NoActivity = styled.div`
  text-align: center;
  padding: 2rem;
  color: #6c757d;
`

const NoActivityIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`

const NoActivityText = styled.p`
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
`

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`

const ActivityIcon = styled.div`
  font-size: 1.5rem;
  color: #34B89C;
`

const ActivityContent = styled.div`
  flex: 1;
`

const ActivityTitle = styled.div`
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.25rem;
`

const ActivityDate = styled.div`
  font-size: 0.85rem;
  color: #6c757d;
`

const ActivityStatus = styled.span<{ status: string }>`
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Confirmed":
        return "#d4edda"
      case "Cancelled":
        return "#f8d7da"
      case "Completed":
        return "#d1ecf1"
      default:
        return "#fff3cd"
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "Confirmed":
        return "#155724"
      case "Cancelled":
        return "#721c24"
      case "Completed":
        return "#0c5460"
      default:
        return "#856404"
    }
  }};
`

// PET REGISTRATION SECTION
const PetRegistrationSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`

const PetRegistrationCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-left: 4px solid #34B89C;
  
  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    padding: 2rem;
  }
`

const PetRegistrationIcon = styled.div`
  font-size: 4rem;
  color: #34B89C;
  background: #f0f9f7;
  padding: 1.5rem;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  height: 100px;
  border: 1px solid #e0f2ed;
`

const PetRegistrationContent = styled.div`
  flex: 1;
`

const PetRegistrationTitle = styled.h2`
  font-size: 1.8rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 1rem 0;
  letter-spacing: -0.5px;
`

const PetRegistrationText = styled.p`
  font-size: 1.05rem;
  color: #6c757d;
  margin: 0 0 2rem 0;
  line-height: 1.6;
`

const PetRegistrationButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
`

const ExistingPetsSection = styled.div`
  margin-top: 2rem;
`

const PetsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const PetListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #34B89C;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const PetItemIcon = styled.div`
  font-size: 2rem;
  color: #34B89C;
`

const PetItemInfo = styled.div`
  flex: 1;
`

const PetItemName = styled.div`
  font-weight: 700;
  color: #2c3e50;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
`

const PetItemDetails = styled.div`
  color: #6c757d;
  font-size: 0.9rem;
`

const PetItemActions = styled.div`
  display: flex;
  gap: 0.5rem;
`

const ViewRecordsButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-1px);
  }
`



// PETS GRID COMPONENTS
const PetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`

const PetCard = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #34B89C;
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const PetIcon = styled.div`
  font-size: 2rem;
  color: #34B89C;
`

const PetInfo = styled.div`
  flex: 1;
`

const PetName = styled.div`
  font-weight: 700;
  color: #2c3e50;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
`

const PetDetails = styled.div`
  color: #6c757d;
  font-size: 0.85rem;
`

const ViewAllPetsCard = styled(PetCard)`
  cursor: pointer;
  background: #f0f9f7;
  border-color: #34B89C;
  text-align: center;
  flex-direction: column;
  gap: 0.5rem;
  
  &:hover {
    background: #e0f2ed;
  }
`

const ViewAllIcon = styled.div`
  font-size: 1.5rem;
  color: #34B89C;
`

const ViewAllText = styled.div`
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
`

// MEDICAL RECORDS SECTION
const MedicalRecordsDashboard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`

const MedicalRecordsCard = styled(PetRegistrationCard)``

const MedicalRecordsIcon = styled(PetRegistrationIcon)``

const MedicalRecordsContent = styled(PetRegistrationContent)``

const MedicalRecordsTitle = styled(PetRegistrationTitle)``

const MedicalRecordsText = styled(PetRegistrationText)``

const MedicalRecordsButton = styled(PetRegistrationButton)``



// PROFILE SECTION
const ProfileDashboard = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const ProfileInfoCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  text-align: center;
`

const ProfileAvatarSection = styled.div`
  margin-bottom: 2rem;
`

const ProfileAvatarLarge = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #34B89C;
  margin: 0 auto 1rem auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f9f7;
`

const ProfileName = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
`

const ProfileEmail = styled.p`
  color: #6c757d;
  margin: 0;
  font-size: 0.95rem;
`

const ProfileDetails = styled.div`
  text-align: left;
  margin-bottom: 2rem;
`

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
  
  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`

const DetailLabel = styled.span`
  font-weight: 600;
  color: #6c757d;
  font-size: 0.9rem;
`

const DetailValue = styled.span`
  color: #2c3e50;
  font-weight: 500;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`

const EditProfileButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
`

const SecurityButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: #5a6268;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
`

const SecurityCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
`

const SecurityTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 1.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const SecurityFeatures = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const SecurityFeature = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`

const SecurityFeatureIcon = styled.div`
  font-size: 1.5rem;
  color: #34B89C;
`

const SecurityFeatureInfo = styled.div`
  flex: 1;
`

const SecurityFeatureTitle = styled.div`
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.25rem;
`

const SecurityFeatureStatus = styled.div`
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: 500;
`

const SecurityActionButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a9d7f;
  }
`

const SecurityStatus = styled.span<{ $enabled: boolean }>`
  color: ${(props) => (props.$enabled ? "#28a745" : "#dc3545")};
  font-weight: 600;
`

// APPOINTMENTS SECTION
const AppointmentsSection = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
`

const SectionTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const AppointmentCount = styled.span`
  background: #34B89C;
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 700;
`

const NewAppointmentButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
`

const NoAppointments = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  color: #6c757d;
`

const NoAppointmentsIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`

const NoAppointmentsText = styled.p`
  font-size: 1.1rem;
  margin: 0 0 1.5rem 0;
  font-weight: 500;
`

const ScheduleButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
`

const AppointmentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const AppointmentCard = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #34B89C;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const AppointmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`

const AppointmentLeftSide = styled.div`
  flex: 1;
`

const AppointmentStatus = styled.div`
  font-weight: 700;
  color: #2c3e50;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
`

const AppointmentInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
`

const AppointmentLabel = styled.span`
  font-weight: 600;
  color: #6c757d;
  font-size: 0.9rem;
`

const AppointmentValue = styled.span`
  color: #2c3e50;
  font-weight: 500;
  font-size: 0.9rem;
`

const AppointmentSeparator = styled.span`
  color: #dee2e6;
  font-weight: 300;
`

const StatusBadge = styled.span<{ status: string }>`
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Confirmed":
        return "#d4edda"
      case "Pending Payment":
        return "#fff3cd"
      case "Cancelled":
        return "#f8d7da"
      case "Completed":
        return "#d1ecf1"
      default:
        return "#e2e3e5"
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "Confirmed":
        return "#155724"
      case "Pending Payment":
        return "#856404"
      case "Cancelled":
        return "#721c24"
      case "Completed":
        return "#0c5460"
      default:
        return "#383d41"
    }
  }};
  white-space: nowrap;
  
  @media (max-width: 768px) {
    align-self: flex-start;
  }
`

const ButtonRow = styled.div`
  display: flex;
  gap: 0.75rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`

const EditButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-1px);
  }
`

const DeleteButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #c0392b;
    transform: translateY(-1px);
  }
`

// HISTORY SIDEBAR COMPONENTS
const HistorySidebarToggle = styled.button`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: #34B89C;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.2s ease;
  z-index: 100;
  
  &:hover {
    background: #2a9d7f;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
`

const HistoryIcon = styled.div`
  font-size: 1.2rem;
`

const HistoryText = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
`

const HistoryBadgeSmall = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`

const SidebarOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1998;
`

const HistorySidebar = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  background: white;
  box-shadow: -4px 0 16px rgba(0,0,0,0.1);
  z-index: 1999;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 480px) {
    width: 100%;
  }
`

const SidebarCloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0.25rem;
  
  &:hover {
    color: #2c3e50;
  }
`

const SidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`

const NoHistoryMessage = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  color: #6c757d;
`

const NoHistoryIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`

const NoHistoryText = styled.p`
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
`

const SidebarHistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const SidebarHistoryCard = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #e9ecef;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #34B89C;
    transform: translateX(-4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const SidebarCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`

const ServiceInfo = styled.div`
  color: #6c757d;
  font-weight: 500;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
`

const DateInfo = styled.div`
  color: #6c757d;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
`

const ClickHint = styled.div`
  color: #34B89C;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: right;
`

// MODAL COMPONENTS
const SuccessNotification = styled.div`
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: #d4edda;
  color: #155724;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 2000;
  border: 1px solid #c3e6cb;
  animation: slideInRight 0.3s ease;
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`

const SuccessIcon = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
`

const SuccessText = styled.div`
  font-weight: 600;
  flex: 1;
`

const CloseSuccessButton = styled.button`
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #155724;
  padding: 0.25rem;
  
  &:hover {
    opacity: 0.7;
  }
`

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
`

const ModalContainer = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalAppear 0.3s ease;
  
  @keyframes modalAppear {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e9ecef;
`

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #2c3e50;
`

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0.25rem;
  
  &:hover {
    color: #2c3e50;
  }
`

const ModalContent = styled.div`
  padding: 2rem;
`

const ModalActions = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e9ecef;
  justify-content: flex-end;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`

// FORM COMPONENTS
const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
`

const EditInput = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid rgba(107, 193, 225, 0.3);
  border-radius: 8px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
`

const DateInput = styled(EditInput)``

const SelectInput = styled.select`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid rgba(107, 193, 225, 0.3);
  border-radius: 8px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
`

const EmailDisplay = styled.div`
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
  border: 2px solid rgba(107, 193, 225, 0.2);
  border-radius: 8px;
  color: #6c757d;
  font-size: 0.9rem;
`

// PROFILE MODAL COMPONENTS
const ProfileSection = styled.div`
  margin-bottom: 2rem;
`

const SecuritySection = styled.div`
  margin-bottom: 1rem;
`

const ProfileImageSection = styled.div`
  text-align: center;
  margin-bottom: 1.5rem;
`

const ProfileImagePreview = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #34B89C;
  margin: 0 auto 1rem auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f9f7;
`

const ImageUploadLabel = styled.label`
  display: inline-block;
  background: #34B89C;
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a9d7f;
  }
`

const ImageUploadInput = styled.input`
  display: none;
`

const ImageUploadHint = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 0.5rem;
`

const TwoFactorContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
`

const TwoFactorInfo = styled.div`
  flex: 1;
`

const TwoFactorLabel = styled.div`
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.25rem;
`

const TwoFactorDescription = styled.div`
  font-size: 0.85rem;
  color: #6c757d;
  line-height: 1.4;
`

const Enable2FAButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a9d7f;
  }
`

const Disable2FAButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #c82333;
  }
`

const OTPSetupSection = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  background: #f8f9fa;
  margin-top: 1rem;
`

const OTPSetupTitle = styled.h4`
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #2c3e50;
  font-weight: 600;
`

const OTPEmailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const EmailInput = styled.input`
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  width: 100%;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }

  &:disabled {
    background-color: #f5f5f5;
  }
`

const SendOTPButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: #34B89C;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-start;

  &:hover:not(:disabled) {
    background: #2a9d7f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const OTPVerificationSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const OTPInstructions = styled.p`
  margin: 0;
  color: #666;
  line-height: 1.5;
  font-size: 0.9rem;
`

const OTPInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const OTPInput = styled.input`
  padding: 0.8rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1.2rem;
  text-align: center;
  letter-spacing: 0.5rem;
  font-weight: 600;
  font-family: monospace;
  width: 100%;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
`

const ResendOTPText = styled.p`
  margin: 0.5rem 0 0 0;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
`

const ResendLink = styled.button`
  background: none;
  border: none;
  color: #34B89C;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.9rem;

  &:hover:not(:disabled) {
    color: #2a9d7f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const OTPButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`

const SubmitButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: #34B89C;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2a9d7f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

// BUTTON COMPONENTS
const CancelModalButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #5a6268;
  }
  
  @media (max-width: 480px) {
    order: 2;
  }
`

const SaveProfileButton = styled.button`
  background: #34B89C;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a9d7f;
  }
`

const ConfirmButton = styled(SaveProfileButton)``

const DeleteModalButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #c0392b;
  }
`

// APPOINTMENT INFO COMPONENTS
const AppointmentInfoModal = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e9ecef;
`

const InfoItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e9ecef;
  
  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`

const InfoLabel = styled.span`
  font-weight: 600;
  color: #6c757d;
  font-size: 0.9rem;
`

const InfoValue = styled.span`
  color: #2c3e50;
  font-weight: 500;
  text-align: right;
  flex: 1;
  margin-left: 1rem;
`

const WarningMessage = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`

const WarningIcon = styled.div`
  font-size: 1.5rem;
  color: #856404;
`

const WarningText = styled.div`
  color: #856404;
  font-weight: 500;
  line-height: 1.4;
  flex: 1;
`

const AppointmentDetails = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
`

const HistoryStatusBadge = styled.span<{ status: string }>`
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Done":
        return "#d4edda"
      case "Not Attend":
        return "#f8d7da"
      case "Cancelled":
        return "#f8d7da"
      default:
        return "#d1ecf1"
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "Done":
        return "#155724"
      case "Not Attend":
        return "#721c24"
      case "Cancelled":
        return "#721c24"
      default:
        return "#0c5460"
    }
  }};
`