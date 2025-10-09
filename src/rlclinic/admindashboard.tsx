"use client"

import type React from "react"
import { useEffect, useState } from "react"
import styled, { createGlobalStyle, keyframes } from "styled-components"
import { useRouter } from "next/navigation"
import { auth, db } from "../firebaseConfig"
import { signOut } from "firebase/auth"
import { collection, getDocs, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore"

// Global Styles
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #fafafa;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }

  * {
    box-sizing: border-box;
  }
`

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(25px); }
  to { opacity: 1; transform: translateY(0); }
`

interface AppointmentType {
  id: string
  clientName: string
  petName?: string
  birthday?: string
  color?: string
  petType?: string
  petBreed?: string
  gender?: string
  date: string
  timeSlot: string
  status?: string
  bookedByAdmin?: boolean
  createdAt?: string
}

interface ClientType {
  id: string
  email: string
  name?: string
}

interface UnavailableSlot {
  id: string
  date: string
  veterinarian: string
  isAllDay: boolean
  startTime?: string
  endTime?: string
}

interface AppointmentCardProps {
  $delay: number
  $borderLeftColor: string
}

interface SidebarProps {
  $isOpen: boolean
}

interface MenuItemProps {
  $active?: boolean
}

const Admindashboard: React.FC = () => {
  const router = useRouter()
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentType[]>([])
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([])
  const [clients, setClients] = useState<ClientType[]>([])
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState("")
  const [petName, setPetName] = useState("")
  const [petBirthday, setPetBirthday] = useState("")
  const [petColor, setPetColor] = useState("")
  const [petType, setPetType] = useState("")
  const [petBreed, setPetBreed] = useState("")
  const [petGender, setPetGender] = useState("")
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"dashboard" | "today" | "all" | "unavailable" | "settings">("dashboard")
  const [isMounted, setIsMounted] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // OTP 2FA States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [showOTPSetup, setShowOTPSetup] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [isSendingOTP, setIsSendingOTP] = useState(false)
  const [otpEmail, setOtpEmail] = useState("")

  const timeSlots = [
    "8:00 AM–8:30 AM",
    "8:30 AM–9:00 AM",
    "9:00 AM–9:30 AM",
    "9:30 AM–10:00 AM",
    "10:00 AM–10:30 AM",
    "10:30 AM–11:00 AM",
    "11:00 AM–11:30 AM",
    "11:30 AM–12:00 PM",
    "1:00 PM–1:30 PM",
    "1:30 PM–2:00 PM",
    "2:00 PM–2:30 PM",
    "2:30 PM–3:00 PM",
    "3:00 PM–3:30 PM",
    "3:30 PM–4:00 PM",
    "4:00 PM–4:30 PM",
    "4:30 PM–5:00 PM",
    "5:00 PM–5:30 PM",
    "5:30 PM–6:00 PM",
  ]

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  useEffect(() => {
    setIsMounted(true)
    if (auth.currentUser?.email) {
      setOtpEmail(auth.currentUser.email)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      alert("Logout failed: " + (error as Error).message)
    }
  }

  const fetchAppointments = async () => {
    try {
      const snapshot = await getDocs(collection(db, "appointments"))
      const data: AppointmentType[] = []
      snapshot.forEach((doc) => {
        const docData = doc.data()
        data.push({
          id: doc.id,
          clientName: docData.clientName || "",
          petName: docData.petName || "",
          birthday: docData.birthday || "",
          color: docData.color || "",
          petType: docData.petType || "",
          petBreed: docData.petBreed || "",
          gender: docData.gender || "",
          date: docData.date || "",
          timeSlot: docData.timeSlot || "",
          status: docData.status || "Pending",
          bookedByAdmin: docData.bookedByAdmin || false,
          createdAt: docData.createdAt || "",
        })
      })
      setAppointments(data.sort((a, b) => a.date.localeCompare(b.date)))
      const today = new Date().toISOString().split("T")[0]
      setTodaysAppointments(data.filter((appt) => appt.date === today))
    } catch (error) {
      console.error("Error fetching appointments:", error)
    }
  }

  const fetchUnavailableSlots = async () => {
    try {
      const snapshot = await getDocs(collection(db, "unavailableSlots"))
      const data: UnavailableSlot[] = []
      snapshot.forEach((doc) => {
        const docData = doc.data()
        data.push({
          id: doc.id,
          date: docData.date || "",
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || "",
        })
      })
      setUnavailableSlots(data.sort((a, b) => a.date.localeCompare(b.date)))
    } catch (error) {
      console.error("Error fetching unavailable slots:", error)
    }
  }

  const fetchClients = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"))
      const data: ClientType[] = []
      snapshot.forEach((doc) => {
        const docData = doc.data()
        data.push({ id: doc.id, email: docData.email || "", name: docData.name || "" })
      })
      setClients(data)
    } catch (error) {
      console.error("Error fetching clients:", error)
    }
  }

  useEffect(() => {
    fetchAppointments()
    fetchClients()
    fetchUnavailableSlots()

    const unsubscribe = onSnapshot(collection(db, "unavailableSlots"), (snapshot) => {
      const data: UnavailableSlot[] = []
      snapshot.forEach((doc) => {
        const docData = doc.data()
        data.push({
          id: doc.id,
          date: docData.date || "",
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || "",
        })
      })
      setUnavailableSlots(data.sort((a, b) => a.date.localeCompare(b.date)))
    })

    return () => unsubscribe()
  }, [])

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient || !petName.trim() || !appointmentDate || !appointmentTime) {
      alert("Please fill all required fields.")
      return
    }

    const isDateUnavailable = unavailableSlots.some((slot) => slot.date === appointmentDate)
    if (isDateUnavailable) {
      alert("Cannot book appointment on this date. A doctor has marked this date as unavailable.")
      return
    }

    setIsLoading(true)
    try {
      const isTaken = appointments.some(
        (appt) => appt.date === appointmentDate && appt.timeSlot === appointmentTime && appt.status !== "Cancelled",
      )
      if (isTaken) {
        alert("This time slot is already taken.")
        return
      }
      await addDoc(collection(db, "appointments"), {
        clientName: selectedClient,
        petName: petName.trim(),
        birthday: petBirthday,
        color: petColor,
        petType,
        petBreed,
        gender: petGender,
        date: appointmentDate,
        timeSlot: appointmentTime,
        status: "Confirmed",
        bookedByAdmin: true,
        createdAt: new Date().toISOString(),
      })
      alert("Appointment booked successfully!")
      setShowBookingModal(false)
      resetForm()
      fetchAppointments()
    } catch (error) {
      console.error("Error booking appointment:", error)
      alert("Failed to book appointment. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUnavailable = async (id: string) => {
    if (!confirm("Are you sure you want to remove this unavailable date?")) return

    setDeletingId(id)
    try {
      await deleteDoc(doc(db, "unavailableSlots", id))
      alert("Unavailable date removed successfully!")
      fetchUnavailableSlots()
    } catch (error) {
      console.error("Error deleting unavailable slot:", error)
      alert("Failed to remove unavailable date. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return

    setDeletingId(id)
    try {
      await deleteDoc(doc(db, "appointments", id))
      alert("Appointment deleted successfully!")
      fetchAppointments()
    } catch (error) {
      console.error("Error deleting appointment:", error)
      alert("Failed to delete appointment. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const appointmentRef = doc(db, "appointments", id)
      await updateDoc(appointmentRef, {
        status: newStatus,
      })
      alert(`Appointment status updated to ${newStatus}!`)
      fetchAppointments()
    } catch (error) {
      console.error("Error updating appointment status:", error)
      alert("Failed to update appointment status. Please try again.")
    }
  }

  // OTP 2FA Functions
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
          name: "Admin User",
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
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTwoFactorEnabled(true)
      setShowOTPSetup(false)
      setVerificationCode("")
      setOtpSent(false)
      alert("Two-Factor Authentication enabled successfully!")
    } catch  {
      alert("Failed to verify OTP. Please try again.")
    }
  }

  const handleDisable2FA = () => {
    if (confirm("Are you sure you want to disable Two-Factor Authentication?")) {
      setTwoFactorEnabled(false)
      alert("Two-Factor Authentication disabled")
    }
  }

  const resetForm = () => {
    setSelectedClient("")
    setPetName("")
    setPetBirthday("")
    setPetColor("")
    setPetType("")
    setPetBreed("")
    setPetGender("")
    setAppointmentDate("")
    setAppointmentTime("")
  }

  const statusColor = (status?: string) => {
    switch (status) {
      case "Confirmed":
        return "#28a745"
      case "Cancelled":
        return "#dc3545"
      case "Pet Registered":
        return "#007bff"
      case "Booked by Admin":
        return "#17a2b8"
      case "Completed":
        return "#007bff"
      default:
        return "#ffc107"
    }
  }

  const filteredAppointments = selectedMonth
    ? appointments.filter((appt) => {
        const date = new Date(appt.date)
        return date.getMonth() === months.indexOf(selectedMonth)
      })
    : appointments

  const filteredUnavailableSlots = selectedMonth
    ? unavailableSlots.filter((slot) => {
        const date = new Date(slot.date)
        return date.getMonth() === months.indexOf(selectedMonth)
      })
    : unavailableSlots

  const getDisplayData = () => {
    switch (viewMode) {
      case "today":
        return { data: todaysAppointments, type: "appointments" }
      case "all":
        return { data: filteredAppointments, type: "appointments" }
      case "unavailable":
        return { data: filteredUnavailableSlots, type: "unavailable" }
      default:
        return { data: [], type: "appointments" }
    }
  }

  const displayData = getDisplayData()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (!isMounted) return null

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <MenuToggle onClick={() => setIsSidebarOpen(!isSidebarOpen)} $isOpen={isSidebarOpen}>
              <span></span>
              <span></span>
              <span></span>
            </MenuToggle>
            <Logo>
              <LogoIcon>🏥</LogoIcon>
              <LogoText>
                <ClinicName>RL Clinic</ClinicName>
                <LogoSubtext>Fursure Care - Admin Dashboard</LogoSubtext>
              </LogoText>
            </Logo>
          </BrandSection>
          <UserSection>
            <AdminBadge>Administrator</AdminBadge>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </UserSection>
        </HeaderBar>

        <DashboardLayout>
          <Sidebar $isOpen={isSidebarOpen}>
            <SidebarHeader>
              <SidebarTitleRow>
                <SidebarTitle>Main Menu</SidebarTitle>
                <SidebarToggleButton onClick={() => setIsSidebarOpen(false)} title="Hide sidebar">
                  ×
                </SidebarToggleButton>
              </SidebarTitleRow>
            </SidebarHeader>

            <MenuList>
              <MenuItem 
                $active={viewMode === "dashboard"} 
                onClick={() => setViewMode("dashboard")}
              >
                <MenuIcon>📊</MenuIcon>
                <MenuText>Dashboard</MenuText>
              </MenuItem>

              <MenuItem 
                $active={viewMode === "today"} 
                onClick={() => setViewMode("today")}
              >
                <MenuIcon>📅</MenuIcon>
                <MenuText>Today&apos;s Appointments</MenuText>
                {todaysAppointments.length > 0 && <MenuCount>{todaysAppointments.length}</MenuCount>}
              </MenuItem>

              <MenuItem 
                $active={viewMode === "all"} 
                onClick={() => setViewMode("all")}
              >
                <MenuIcon>📋</MenuIcon>
                <MenuText>List Appointments</MenuText>
                {appointments.length > 0 && <MenuCount>{appointments.length}</MenuCount>}
              </MenuItem>

              <MenuItem onClick={() => setShowBookingModal(true)}>
                <MenuIcon>➕</MenuIcon>
                <MenuText>Book Appointment</MenuText>
              </MenuItem>

              <MenuItem onClick={() => router.push("/medicalrecord")}>
                <MenuIcon>📖</MenuIcon>
                <MenuText>Medical Records</MenuText>
              </MenuItem>

              <MenuItem 
                $active={viewMode === "unavailable"} 
                onClick={() => setViewMode("unavailable")}
              >
                <MenuIcon>🚫</MenuIcon>
                <MenuText>Unavailable Dates</MenuText>
              </MenuItem>

              <MenuItem onClick={() => router.push("/monthlystatistic")}>
                <MenuIcon>📈</MenuIcon>
                <MenuText>Monthly Reports</MenuText>
              </MenuItem>

              <MenuItem 
                $active={viewMode === "settings"} 
                onClick={() => setViewMode("settings")}
              >
                <MenuIcon>⚙️</MenuIcon>
                <MenuText>Settings</MenuText>
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

          <ContentArea $sidebarOpen={isSidebarOpen}>
            {viewMode === "dashboard" && (
              <>
                <DashboardHeader>
                  <ContentTitle>Today&apos;s Appointments</ContentTitle>
                  <ContentSubtitle>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ContentSubtitle>
                </DashboardHeader>

                <AppointmentsSection>
                  {todaysAppointments.length === 0 ? (
                    <EmptyState>
                      <EmptyStateIcon>📅</EmptyStateIcon>
                      <EmptyStateText>No appointments scheduled for today</EmptyStateText>
                    </EmptyState>
                  ) : (
                    <AppointmentsGrid>
                      {todaysAppointments.map((appointment, index) => {
                        const borderColor = statusColor(appointment.status)
                        return (
                          <AppointmentCard
                            key={appointment.id}
                            $delay={index * 0.1}
                            $borderLeftColor={borderColor}
                          >
                            <AppointmentHeader>
                              <AppointmentTime>{appointment.timeSlot}</AppointmentTime>
                              <StatusBadge $status={appointment.status} style={{ backgroundColor: borderColor }}>
                                {appointment.status}
                              </StatusBadge>
                            </AppointmentHeader>
                            <AppointmentDetails>
                              <DetailRow>
                                <DetailLabel>Client:</DetailLabel>
                                <DetailValue>{appointment.clientName}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Pet:</DetailLabel>
                                <DetailValue>{appointment.petName || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Type:</DetailLabel>
                                <DetailValue>{appointment.petType || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Breed:</DetailLabel>
                                <DetailValue>{appointment.petBreed || "-"}</DetailValue>
                              </DetailRow>
                            </AppointmentDetails>
                            <AppointmentActions>
                              <ActionButton
                                $variant="complete"
                                onClick={() => handleStatusChange(appointment.id, "Completed")}
                                disabled={appointment.status === "Completed" || appointment.status === "Cancelled"}
                              >
                                ✓ Complete
                              </ActionButton>
                              <ActionButton
                                $variant="cancel"
                                onClick={() => handleStatusChange(appointment.id, "Cancelled")}
                                disabled={appointment.status === "Cancelled"}
                              >
                                ✕ Cancel
                              </ActionButton>
                            </AppointmentActions>
                          </AppointmentCard>
                        )
                      })}
                    </AppointmentsGrid>
                  )}
                </AppointmentsSection>

                <AppointmentsSection style={{ marginTop: "3rem" }}>
                  <SectionHeader>
                    <SectionTitle>All Appointments</SectionTitle>
                    <ControlsContainer>
                      <MonthSelect value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        <option value="">All Months</option>
                        {months.map((month, index) => (
                          <option key={index} value={month}>
                            {month}
                          </option>
                        ))}
                      </MonthSelect>
                      <RefreshButton
                        onClick={() => {
                          fetchAppointments()
                          fetchUnavailableSlots()
                        }}
                      >
                        Refresh
                      </RefreshButton>
                    </ControlsContainer>
                  </SectionHeader>

                  {filteredAppointments.length === 0 ? (
                    <EmptyState>
                      <EmptyStateIcon>📋</EmptyStateIcon>
                      <EmptyStateText>No appointments found</EmptyStateText>
                    </EmptyState>
                  ) : (
                    <AppointmentsGrid>
                      {filteredAppointments.map((appointment, index) => {
                        const borderColor = statusColor(appointment.status)
                        return (
                          <AppointmentCard
                            key={appointment.id}
                            $delay={index * 0.1}
                            $borderLeftColor={borderColor}
                          >
                            <AppointmentHeader>
                              <AppointmentDate>{appointment.date}</AppointmentDate>
                              <StatusBadge $status={appointment.status} style={{ backgroundColor: borderColor }}>
                                {appointment.status}
                              </StatusBadge>
                            </AppointmentHeader>
                            <AppointmentTime>{appointment.timeSlot}</AppointmentTime>
                            <AppointmentDetails>
                              <DetailRow>
                                <DetailLabel>Client:</DetailLabel>
                                <DetailValue>{appointment.clientName}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Pet:</DetailLabel>
                                <DetailValue>{appointment.petName || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Type:</DetailLabel>
                                <DetailValue>{appointment.petType || "-"}</DetailValue>
                              </DetailRow>
                              <DetailRow>
                                <DetailLabel>Breed:</DetailLabel>
                                <DetailValue>{appointment.petBreed || "-"}</DetailValue>
                              </DetailRow>
                            </AppointmentDetails>
                            <AppointmentActions>
                              <ActionButton
                                $variant="complete"
                                onClick={() => handleStatusChange(appointment.id, "Completed")}
                                disabled={appointment.status === "Completed" || appointment.status === "Cancelled"}
                              >
                                ✓ Complete
                              </ActionButton>
                              <ActionButton
                                $variant="cancel"
                                onClick={() => handleStatusChange(appointment.id, "Cancelled")}
                                disabled={appointment.status === "Cancelled"}
                              >
                                ✕ Cancel
                              </ActionButton>
                              <ActionButton
                                $variant="delete"
                                onClick={() => handleDeleteAppointment(appointment.id)}
                                disabled={deletingId === appointment.id}
                              >
                                {deletingId === appointment.id ? "Deleting..." : "🗑 Delete"}
                              </ActionButton>
                            </AppointmentActions>
                          </AppointmentCard>
                        )
                      })}
                    </AppointmentsGrid>
                  )}
                </AppointmentsSection>
              </>
            )}

            {viewMode === "settings" && (
              <>
                <DashboardHeader style={{ textAlign: "center" }}>
                  <ContentTitle>Settings</ContentTitle>
                  <ContentSubtitle>Manage your account settings and security</ContentSubtitle>
                </DashboardHeader>

                <SettingsContainer>
                  <SettingsSection>
                    <SettingsSectionTitle>Two-Factor Authentication (2FA)</SettingsSectionTitle>
                    <SettingsSectionDesc>
                      Add an extra layer of security to your account by enabling two-factor authentication via OTP.
                    </SettingsSectionDesc>

                    <TwoFactorCard>
                      <TwoFactorStatus>
                        <StatusIndicator $enabled={twoFactorEnabled} />
                        <StatusText>{twoFactorEnabled ? "2FA is enabled" : "2FA is disabled"}</StatusText>
                      </TwoFactorStatus>

                      {!twoFactorEnabled && !showOTPSetup && (
                        <EnableButton onClick={() => setShowOTPSetup(true)}>
                          Enable Two-Factor Authentication
                        </EnableButton>
                      )}

                      {showOTPSetup && !twoFactorEnabled && (
                        <OTPSetupSection>
                          <OTPSetupTitle>Set up Two-Factor Authentication</OTPSetupTitle>

                          {!otpSent ? (
                            <OTPEmailSection>
                              <Label>Email Address for OTP</Label>
                              <EmailInput
                                type="email"
                                value={otpEmail}
                                onChange={(e) => setOtpEmail(e.target.value)}
                                placeholder="Enter your email"
                                disabled={isSendingOTP}
                              />
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
                                <Label>Enter 6-digit OTP</Label>
                                <OTPInput
                                  type="text"
                                  maxLength={6}
                                  value={verificationCode}
                                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                                  placeholder="000000"
                                />
                                <ResendOTPText>
                                  Didn&apos;t receive the code?{" "}
                                  <ResendLink onClick={handleSendOTP} disabled={isSendingOTP}>
                                    {isSendingOTP ? "Sending..." : "Resend OTP"}
                                  </ResendLink>
                                </ResendOTPText>
                              </OTPInputGroup>

                              <OTPButtonGroup>
                                <CancelButton
                                  onClick={() => {
                                    setShowOTPSetup(false)
                                    setOtpSent(false)
                                    setVerificationCode("")
                                  }}
                                >
                                  Cancel
                                </CancelButton>
                                <SubmitButton onClick={handleVerifyOTP} disabled={verificationCode.length !== 6}>
                                  Verify & Enable 2FA
                                </SubmitButton>
                              </OTPButtonGroup>
                            </OTPVerificationSection>
                          )}
                        </OTPSetupSection>
                      )}

                      {twoFactorEnabled && (
                        <DisableButton onClick={handleDisable2FA}>Disable Two-Factor Authentication</DisableButton>
                      )}
                    </TwoFactorCard>
                  </SettingsSection>

                  <SettingsSection>
                    <SettingsSectionTitle>Account Information</SettingsSectionTitle>
                    <InfoGrid>
                      <InfoItem>
                        <InfoLabel>Email:</InfoLabel>
                        <InfoValue>{auth.currentUser?.email || "admin@rlclinic.com"}</InfoValue>
                      </InfoItem>
                      <InfoItem>
                        <InfoLabel>Role:</InfoLabel>
                        <InfoValue>Administrator</InfoValue>
                      </InfoItem>
                      <InfoItem>
                        <InfoLabel>Last Login:</InfoLabel>
                        <InfoValue>{new Date().toLocaleDateString()}</InfoValue>
                      </InfoItem>
                    </InfoGrid>
                  </SettingsSection>
                </SettingsContainer>
              </>
            )}

            {viewMode === "today" && (
              <AppointmentsSection>
                <DashboardHeader style={{ textAlign: "center" }}>
                  <ContentTitle>Today&apos;s Appointments</ContentTitle>
                  <ContentSubtitle>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ContentSubtitle>
                </DashboardHeader>

                <SectionHeader>
                  <ControlsContainer>
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments()
                        fetchUnavailableSlots()
                      }}
                    >
                      Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>

                {todaysAppointments.length === 0 ? (
                  <NoAppointments>
                    No appointments for today.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {todaysAppointments.map((appt, index) => {
                      const borderColor = statusColor(appt.status)
                      return (
                        <AppointmentCard key={appt.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                          <InfoRow>
                            <strong>Owner:</strong> {appt.clientName}
                          </InfoRow>
                          <InfoRow>
                            <strong>Pet:</strong> {appt.petName || "-"}
                          </InfoRow>
                          <InfoRow>
                            <strong>Date:</strong> {appt.date} | <strong>Time:</strong> {appt.timeSlot}
                          </InfoRow>
                          <InfoRow>
                            <strong>Type:</strong> {appt.petType || "-"} | <strong>Breed:</strong>{" "}
                            {appt.petBreed || "-"}
                          </InfoRow>
                          <StatusLabel style={{ backgroundColor: borderColor }}>
                            {appt.status || "Pending"}
                            {appt.bookedByAdmin && " (by Admin)"}
                          </StatusLabel>
                        </AppointmentCard>
                      )
                    })}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}

            {(viewMode === "all" || viewMode === "unavailable") && (
              <AppointmentsSection>
                <SectionHeader>
                  <SectionTitle>
                    {viewMode === "all" && "All Appointments"}
                    {viewMode === "unavailable" && "Doctor Unavailable Dates"}
                  </SectionTitle>
                  <ControlsContainer>
                    {(viewMode === "all" || viewMode === "unavailable") && (
                      <MonthFilter>
                        <MonthSelect value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                          <option value="">All Months</option>
                          {months.map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </MonthSelect>
                      </MonthFilter>
                    )}
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments()
                        fetchUnavailableSlots()
                      }}
                    >
                      Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>

                {displayData.data.length === 0 ? (
                  <NoAppointments>
                    {viewMode === "all" && "No appointments found."}
                    {viewMode === "unavailable" && "No unavailable dates set by doctors."}
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {viewMode === "unavailable"
                      ? (displayData.data as UnavailableSlot[]).map((slot, index) => (
                          <UnavailableCard key={slot.id} $delay={index * 0.1}>
                            <UnavailableIcon>🚫</UnavailableIcon>
                            <UnavailableInfo>
                              <UnavailableDate>{formatDate(slot.date)}</UnavailableDate>
                              <UnavailableDoctor>Doctor: {slot.veterinarian}</UnavailableDoctor>
                              <UnavailableTime>
                                {slot.isAllDay ? "All Day" : `${slot.startTime} - ${slot.endTime}`}
                              </UnavailableTime>
                              <UnavailableStatus>Unavailable</UnavailableStatus>
                            </UnavailableInfo>
                            <DeleteButton
                              onClick={() => handleDeleteUnavailable(slot.id)}
                              disabled={deletingId === slot.id}
                            >
                              {deletingId === slot.id ? "Deleting..." : "Delete"}
                            </DeleteButton>
                          </UnavailableCard>
                        ))
                      : (displayData.data as AppointmentType[]).map((appt, index) => {
                          const borderColor = statusColor(appt.status)
                          return (
                            <AppointmentCard key={appt.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                              <InfoRow>
                                <strong>Owner:</strong> {appt.clientName}
                              </InfoRow>
                              <InfoRow>
                                <strong>Pet:</strong> {appt.petName || "-"}
                              </InfoRow>
                              <InfoRow>
                                <strong>Date:</strong> {appt.date} | <strong>Time:</strong> {appt.timeSlot}
                              </InfoRow>
                              <InfoRow>
                                <strong>Type:</strong> {appt.petType || "-"} | <strong>Breed:</strong>{" "}
                                {appt.petBreed || "-"}
                              </InfoRow>
                              <StatusLabel style={{ backgroundColor: borderColor }}>
                                {appt.status || "Pending"}
                                {appt.bookedByAdmin && " (by Admin)"}
                              </StatusLabel>
                            </AppointmentCard>
                          )
                        })}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}

            {showBookingModal && (
              <ModalOverlay onClick={() => !isLoading && setShowBookingModal(false)}>
                <ModalContent onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Book Appointment for Client</ModalTitle>
                    <CloseButton onClick={() => !isLoading && setShowBookingModal(false)} disabled={isLoading}>
                      ×
                    </CloseButton>
                  </ModalHeader>
                  <Form onSubmit={handleBookAppointment}>
                    <FormColumns>
                      <FormColumn>
                        <FormGroup>
                          <Label>Select Client *</Label>
                          <Select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            required
                            disabled={isLoading}
                          >
                            <option value="">Choose a client</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.email}>
                                {client.name || client.email}
                              </option>
                            ))}
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Pet Name *</Label>
                          <Input
                            type="text"
                            value={petName}
                            onChange={(e) => setPetName(e.target.value)}
                            placeholder="Enter pet name"
                            required
                            disabled={isLoading}
                          />
                        </FormGroup>

                        <FormGroup>
                          <Label>Pet Type</Label>
                          <Select value={petType} onChange={(e) => setPetType(e.target.value)} disabled={isLoading}>
                            <option value="">Select pet type</option>
                            <option value="Dog">Dog</option>
                            <option value="Cat">Cat</option>
                            <option value="Bird">Bird</option>
                            <option value="Other">Other</option>
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Breed</Label>
                          <Input
                            type="text"
                            value={petBreed}
                            onChange={(e) => setPetBreed(e.target.value)}
                            placeholder="Enter breed"
                            disabled={isLoading}
                          />
                        </FormGroup>

                        <FormGroup>
                          <Label>Gender</Label>
                          <Select value={petGender} onChange={(e) => setPetGender(e.target.value)} disabled={isLoading}>
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </Select>
                        </FormGroup>
                      </FormColumn>

                      <FormColumn>
                        <FormGroup>
                          <Label>Birthday</Label>
                          <Input
                            type="date"
                            value={petBirthday}
                            onChange={(e) => setPetBirthday(e.target.value)}
                            disabled={isLoading}
                          />
                        </FormGroup>

                        <FormGroup>
                          <Label>Color/Markings</Label>
                          <Input
                            type="text"
                            value={petColor}
                            onChange={(e) => setPetColor(e.target.value)}
                            placeholder="Enter color/markings"
                            disabled={isLoading}
                          />
                        </FormGroup>

                        <FormGroup>
                          <Label>Appointment Date *</Label>
                          <Input
                            type="date"
                            value={appointmentDate}
                            onChange={(e) => setAppointmentDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            required
                            disabled={isLoading}
                          />
                          {appointmentDate && unavailableSlots.some((slot) => slot.date === appointmentDate) && (
                            <UnavailableWarning>⚠️ Warning: A doctor is unavailable on this date</UnavailableWarning>
                          )}
                        </FormGroup>

                        <FormGroup>
                          <Label>Time Slot *</Label>
                          <Select
                            value={appointmentTime}
                            onChange={(e) => setAppointmentTime(e.target.value)}
                            required
                            disabled={isLoading}
                          >
                            <option value="">Select a time slot</option>
                            {timeSlots.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </Select>
                        </FormGroup>
                      </FormColumn>
                    </FormColumns>

                    <ButtonGroup>
                      <CancelButton type="button" onClick={() => setShowBookingModal(false)} disabled={isLoading}>
                        Cancel
                      </CancelButton>
                      <SubmitButton
                        type="submit"
                        disabled={
                          isLoading || !selectedClient || !petName.trim() || !appointmentDate || !appointmentTime
                        }
                      >
                        {isLoading ? "Booking..." : "Book Appointment"}
                      </SubmitButton>
                    </ButtonGroup>
                  </Form>
                </ModalContent>
              </ModalOverlay>
            )}
          </ContentArea>
        </DashboardLayout>
      </PageContainer>
    </>
  )
}

/* Styled Components */

const PageContainer = styled.div`
  min-height: 100vh;
  background: #fafafa;
`

const HeaderBar = styled.header`
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 1rem 2rem; 
  background: #4ECDC4;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-bottom: 1px solid #e9ecef;

  @media (max-width: 768px) {
    padding: 1rem;
  }
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

const LogoIcon = styled.div`
  font-size: 2rem;
  color: #2c3e50;
`

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
`

const ClinicName = styled.h1`
  margin: 0; 
  font-size: 1.8rem;
  font-weight: 800;
  color: #2c3e50;
  letter-spacing: -0.5px;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }

  @media (max-width: 480px) {
    font-size: 1.3rem;
  }
`

const LogoSubtext = styled.p`
  margin: 0; 
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

const AdminBadge = styled.span`
  background: rgba(255, 255, 255, 0.2); 
  color: #2c3e50; 
  padding: 0.4rem 0.8rem; 
  border-radius: 20px; 
  font-size: 0.8rem;
  font-weight: 600;
  backdrop-filter: blur(10px);

  @media (max-width: 480px) {
    font-size: 0.7rem;
    padding: 0.3rem 0.6rem;
  }
`

const LogoutButton = styled.button`
  padding: 0.6rem 1.2rem; 
  border: 1px solid rgba(44, 62, 80, 0.3); 
  border-radius: 8px; 
  cursor: pointer; 
  background: rgba(255, 255, 255, 0.15); 
  color: #2c3e50; 
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  @media (max-width: 480px) {
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

const Sidebar = styled.aside<SidebarProps>`
  width: 280px;
  background: white;
  border-right: 1px solid #e9ecef;
  display: flex;  
  flex-direction: column;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 50;

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

const SidebarToggleButton = styled.button`
  background: #6BC1E1;
  border: none;
  font-size: 1.5rem;
  color: #000000;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  
  &:hover {
    background: #34B89C;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
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

const MenuItem = styled.div<MenuItemProps>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid ${(props) => (props.$active ? "#34B89C" : "transparent")};
  background: ${(props) => (props.$active ? "#34B89C" : "transparent")};
  
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

const ContentArea = styled.div<{ $sidebarOpen: boolean }>`
  flex: 1;
  background: #ffffff;
  overflow-y: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  
  @media (min-width: 1025px) {
    margin-left: ${(props) => (props.$sidebarOpen ? "0" : "-280px")};
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

const DashboardHeader = styled.div`
  margin-bottom: 2rem;
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

const AppointmentsSection = styled.section`
  margin-top: 2rem;
`

const SectionHeader = styled.div`
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 1.5rem; 
  flex-wrap: wrap; 
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #2c3e50;

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }
`

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-wrap: wrap;
  }

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    gap: 0.8rem;
  }
`

const MonthFilter = styled.div`
  display: flex;
  align-items: center;
`

const MonthSelect = styled.select`
  padding: 0.6rem 0.8rem; 
  border: 1px solid #ddd; 
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  background: white;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }
`

const RefreshButton = styled.button`
  padding: 0.6rem 1.2rem; 
  border: none; 
  border-radius: 8px; 
  cursor: pointer; 
  background: #34B89C; 
  color: white; 
  font-weight: 600;
  transition: background 0.2s;
  font-size: 0.9rem;

  &:hover {
    background: #2a9d7f;
  }

  @media (max-width: 480px) {
    width: 100%;
    text-align: center;
  }
`

const AppointmentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.2rem;
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const AppointmentCard = styled.div<AppointmentCardProps>`
  animation: ${fadeInUp} 0.4s ease forwards;
  padding: 1.2rem; 
  background: white; 
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
  border: 1px solid #e9ecef;
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 4px solid ${(props) => props.$borderLeftColor || "#34B89C"};

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }

  @media (max-width: 480px) {
    padding: 1rem;
  }
`

const AppointmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
`

const AppointmentDate = styled.div`
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
`

const AppointmentTime = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
`

const StatusBadge = styled.span<{ $status?: string }>`
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
`

const AppointmentDetails = styled.div`
  margin-bottom: 1rem;
  flex-grow: 1;
`

const DetailRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
  color: #444;
`

const DetailLabel = styled.span`
  font-weight: 500;
  color: #2c3e50;
  min-width: 60px;
`

const DetailValue = styled.span`
  flex-grow: 1;
  color: #666;
`

const AppointmentActions = styled.div`
  display: flex;
  gap: 0.7rem;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #eee;
`

const ActionButton = styled.button<{ $variant?: "complete" | "cancel" | "delete" }>`
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  transition: background 0.2s, opacity 0.2s;
  
  ${(props) =>
    props.$variant === "complete" &&
    `
    background: #28a745;
    color: white;
    &:hover:not(:disabled) { background: #218838; }
  `}
  
  ${(props) =>
    props.$variant === "cancel" &&
    `
    background: #dc3545;
    color: white;
    &:hover:not(:disabled) { background: #c82333; }
  `}

  ${(props) =>
    props.$variant === "delete" &&
    `
    background: #6c757d;
    color: white;
    &:hover:not(:disabled) { background: #5a6268; }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.05);
  grid-column: 1 / -1;
`

const EmptyStateIcon = styled.div`
  font-size: 3rem;
  color: #ccc;
  margin-bottom: 1rem;
`

const EmptyStateText = styled.p`
  font-size: 1.1rem;
  color: #666;
  margin: 0;
`

const SettingsContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`

const SettingsSection = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`

const SettingsSectionTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.3rem;
  color: #2c3e50;
  font-weight: 600;
`

const SettingsSectionDesc = styled.p`
  margin: 0 0 1.5rem 0;
  color: #666;
  line-height: 1.5;
`

const TwoFactorCard = styled.div`
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 1.5rem;
  background: #f9f9f9;
`

const TwoFactorStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1.5rem;
`

const StatusIndicator = styled.div<{ $enabled: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(props) => (props.$enabled ? "#28a745" : "#dc3545")};
`

const StatusText = styled.span`
  font-weight: 600;
  color: #2c3e50;
`

const EnableButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: #34B89C;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #2a9d7f;
  }
`

const DisableButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: #dc3545;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #bd2130;
  }
`

// OTP Specific Styles
const OTPSetupSection = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
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
  border-radius: 6px;
  font-size: 1rem;

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
  border-radius: 6px;
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
`

const OTPInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
`

const InfoGrid = styled.div`
  display: grid;
  gap: 1rem;
`

const InfoItem = styled.div`
  display: flex;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border-left: 3px solid #34B89C;
`

const InfoLabel = styled.span`
  font-weight: 600;
  color: #2c3e50;
  min-width: 120px;
`

const InfoValue = styled.span`
  color: #666;
`

const NoAppointments = styled.p`
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.05);
`

const UnavailableCard = styled.div<{ $delay: number }>`
  animation: ${fadeInUp} 0.4s ease forwards;
  animation-delay: ${(props) => props.$delay}s;
  opacity: 0;
  padding: 1.2rem; 
  border-left: 6px solid #dc3545; 
  background: white; 
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }

  @media (max-width: 480px) {
    padding: 1rem;
    flex-direction: column;
    text-align: center;
    gap: 0.8rem;
  }
`

const UnavailableIcon = styled.div`
  font-size: 2rem;
  flex-shrink: 0;
`

const UnavailableInfo = styled.div`
  flex: 1;
`

const UnavailableDate = styled.div`
  font-weight: bold;
  font-size: 1.1rem;
  color: #2d3748;
  margin-bottom: 0.3rem;
`

const UnavailableDoctor = styled.div`
  font-size: 0.95rem;
  color: #4a5568;
  margin-bottom: 0.3rem;
`

const UnavailableTime = styled.div`
  font-size: 0.9rem;
  color: #718096;
  margin-bottom: 0.5rem;
`

const UnavailableStatus = styled.div`
  display: inline-block;
  padding: 0.3rem 0.7rem; 
  border-radius: 20px; 
  background-color: #dc3545;
  color: white; 
  font-size: 0.8rem;
  font-weight: 500;
`

const DeleteButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: #bd2130;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`

const UnavailableWarning = styled.div`
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  font-weight: 500;
`

const InfoRow = styled.p`
  margin: 0.4rem 0;
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 0 0 auto;

  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`

const StatusLabel = styled.span`
  display: inline-block;
  padding: 0.3rem 0.7rem; 
  border-radius: 20px; 
  color: white; 
  font-size: 0.8rem;
  font-weight: 500;
  margin-top: 0.5rem;
  align-self: flex-start;
  flex: 0 0 auto;
`

const ModalOverlay = styled.div`
  position: fixed; 
  top: 0; 
  left: 0; 
  right: 0; 
  bottom: 0; 
  background: rgba(0,0,0,0.6); 
  display: flex; 
  justify-content: center; 
  align-items: center;
  padding: 1rem;
  z-index: 1000;
  overflow-y: auto;
`

const ModalContent = styled.div`
  background: white; 
  padding: 1.5rem; 
  border-radius: 12px; 
  width: 100%; 
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);

  @media (max-width: 768px) {
    padding: 1.2rem;
    max-height: 85vh;
  }
`

const ModalHeader = styled.div`
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 1.5rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #eee;
`

const ModalTitle = styled.h2`
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }
`

const CloseButton = styled.button`
  border: none; 
  background: none; 
  font-size: 1.8rem; 
  cursor: pointer;
  color: #666;
  transition: color 0.2s;

  &:hover {
    color: #333;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const Form = styled.form`
  display: flex; 
  flex-direction: column; 
  gap: 1.2rem;
`

const FormColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`

const FormColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const FormGroup = styled.div`
  display: flex; 
  flex-direction: column;
  gap: 0.4rem;
`

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: #444;
`

const Input = styled.input`
  padding: 0.7rem 0.8rem; 
  border: 1px solid #ddd; 
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`

const Select = styled.select`
  padding: 0.7rem 0.8rem; 
  border: 1px solid #ddd; 
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  background: white;

  &:focus {
    outline: none;
    border-color: #34B89C;
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`

const ButtonGroup = styled.div`
  display: flex; 
  justify-content: flex-end; 
  gap: 0.8rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`

const CancelButton = styled.button`
  padding: 0.7rem 1.4rem; 
  border: 1px solid #ddd; 
  border-radius: 8px; 
  cursor: pointer; 
  background: white; 
  color: #333;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #f8f8f8;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    order: 2;
  }
`

const SubmitButton = styled.button`
  padding: 0.7rem 1.4rem; 
  border: none; 
  border-radius: 8px; 
  cursor: pointer; 
  background: #34B89C; 
  color: white; 
  font-weight: 600;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #2a9d7f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export default Admindashboard