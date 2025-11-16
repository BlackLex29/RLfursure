'use client';

import type React from "react"
import { useEffect, useState } from "react"
import styled, { createGlobalStyle, ThemeProvider, keyframes } from "styled-components"
import { useRouter } from "next/navigation"
import { auth, db } from "../firebaseConfig"
import { signOut } from "firebase/auth"
import { collection, onSnapshot, doc, deleteDoc, query, where, updateDoc, getDoc, setDoc, orderBy, addDoc } from "firebase/firestore"

// Define theme interfaces
interface Theme {
  background: string
  surface: string
  primary: string
  secondary: string
  text: string
  textSecondary: string
  border: string
  shadow: string
  success: string
  warning: string
  error: string
}

interface Themes {
  light: Theme
  dark: Theme
}

// Define themes
const themes: Themes = {
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    primary: "#4ECDC4",
    secondary: "#34B89C",
    text: "#2c3e50",
    textSecondary: "#6c757d",
    border: "#e9ecef",
    shadow: "rgba(0, 0, 0, 0.1)",
    success: "#28a745",
    warning: "#ffc107",
    error: "#e74c3c"
  },
  dark: {
    background: "#0f172a",
    surface: "#1e293b",
    primary: "#34B89C",
    secondary: "#4ECDC4",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    border: "#334155",
    shadow: "rgba(0, 0, 0, 0.3)",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444"
  }
}

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme {}
}

// Create GlobalStyle with theme support
const GlobalStyle = createGlobalStyle<{ theme: Theme }>`
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: ${props => props.theme.background};
    color: ${props => props.theme.text};
    scroll-behavior: smooth;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
  
  * {
    box-sizing: border-box;
  }
`

const SidebarStatusBadge = styled.span<{ status: string; theme: Theme }>`
  padding: 0.3rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Completed":
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
      case "Completed":
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
  paymentCompleted?: boolean
  // ADDED: Fields to match appointment data structure
  userId?: string
  petId?: string
  clientEmail?: string
  price?: number
  referenceNumber?: string
  paymentStatus?: string
}

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  age?: string
  location?: string
  twoFactorEnabled?: boolean
  createdAt?: string
  updatedAt?: string
}

interface Pet {
  id: string
  name: string
  petType: string
  breed: string
}

interface RefundRequest {
  id: string
  appointmentId: string
  clientName: string
  clientEmail: string
  petName: string
  appointmentType: string
  originalDate: string
  originalTime: string
  amount: number
  paymentMethod: string
  refundReason: string
  status: string
  requestedAt: string
  userId: string
  processedAt?: string
  refundAmount?: number
  adminNotes?: string
  refundCompleted?: boolean
  gcashReferenceNo?: string
  gcashPhoneNumber?: string
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
  const [editPhoneNumber, setEditPhoneNumber] = useState("")
  const [editAge, setEditAge] = useState("")
  const [editLocation, setEditLocation] = useState("")
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

  // Refund states
  const [refundReason, setRefundReason] = useState("")
  const [gcashReferenceNo, setGcashReferenceNo] = useState("")
  const [gcashPhoneNumber, setGcashPhoneNumber] = useState("")
  const [gcashReferenceNoCancel, setGcashReferenceNoCancel] = useState("")
  const [gcashPhoneNumberCancel, setGcashPhoneNumberCancel] = useState("")
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundProcessing, setRefundProcessing] = useState(false)

  // New state for active menu item
  const [activeMenuItem, setActiveMenuItem] = useState<string>("dashboard")

  // New state for refund requests and history
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([])
  const [refundHistoryTab, setRefundHistoryTab] = useState<string>("appointments")
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null)
  const [showRefundDetailsModal, setShowRefundDetailsModal] = useState(false)

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

  // FIXED: User Profile Fetching and Creation
  useEffect(() => {
    if (!userEmail || !userId) return

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId))
        
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setUserProfile(profileData);
          setEditFirstName(profileData.firstName || userEmail.split("@")[0]);
          setEditLastName(profileData.lastName || "");
          setEditPhoneNumber(profileData.phoneNumber || "");
          setEditAge(profileData.age || "");
          setEditLocation(profileData.location || "");
          setTwoFactorEnabled(profileData.twoFactorEnabled || false);
        } else {
          // Create complete profile document with all required fields
          const defaultProfile = {
            firstName: userEmail.split("@")[0],
            lastName: "",
            email: userEmail,
            phoneNumber: "",
            age: "",
            location: "",
            twoFactorEnabled: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Use setDoc instead of addDoc for specific document ID
          await setDoc(doc(db, "users", userId), defaultProfile);
          setUserProfile(defaultProfile);
          setEditFirstName(defaultProfile.firstName);
          setEditLastName("");
          setEditPhoneNumber("");
          setEditAge("");
          setEditLocation("");
          setTwoFactorEnabled(false);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        // Fallback to default profile
        const defaultProfile: UserProfile = {
          firstName: userEmail.split("@")[0],
          lastName: "",
          email: userEmail,
          phoneNumber: "",
          age: "",
          location: "",
          twoFactorEnabled: false,
        };
        setUserProfile(defaultProfile);
        setEditFirstName(defaultProfile.firstName);
        setEditLastName("");
        setEditPhoneNumber("");
        setEditAge("");
        setEditLocation("");
        setTwoFactorEnabled(false);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();

    // FIXED: Fetch pets for the current user
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

    // FIXED: Query appointments by userId instead of clientName
    const activeQuery = query(
      collection(db, "appointments"), 
      where("userId", "==", userId), // Use userId instead of clientName
      where("status", "in", ["Confirmed", "Pending Payment", "Pending Confirmation", "Scheduled"])
    )

    const activeUnsub = onSnapshot(activeQuery, (snapshot) => {
      const data: AppointmentType[] = []
      snapshot.forEach((doc) => {
        const appointmentData = { 
          id: doc.id, 
          ...(doc.data() as Omit<AppointmentType, "id">) 
        }
        // Only include active appointments
        if (!["Completed", "Not Attend", "Cancelled"].includes(appointmentData.status || "")) {
          data.push(appointmentData)
        }
      })
      data.sort((a, b) => a.date.localeCompare(b.date))
      setAppointments(data)
      console.log("📅 Active appointments loaded:", data.length, data)
    })

    // FIXED: Completed appointments query
    const completedQuery = query(
      collection(db, "appointments"), 
      where("userId", "==", userId), // Use userId instead of clientName
      where("status", "in", ["Completed", "Not Attend", "Cancelled"])
    )

    const completedUnsub = onSnapshot(completedQuery, (snapshot) => {
      const data: AppointmentType[] = []
      snapshot.forEach((doc) => {
        const appointmentData = { 
          id: doc.id, 
          ...(doc.data() as Omit<AppointmentType, "id">) 
        }
        data.push(appointmentData)
      })
      data.sort((a, b) => {
        const dateA = a.completedAt || a.date
        const dateB = b.completedAt || b.date
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setCompletedAppointments(data)
      console.log("✅ Completed appointments loaded:", data.length)
    })

    return () => {
      unsubscribePets()
      activeUnsub()
      completedUnsub()
    }
  }, [userEmail, userId])

  // Debug effect to see appointments data
  useEffect(() => {
    console.log("🐕 Pets data:", pets)
    console.log("📅 Active appointments:", appointments)
    console.log("✅ Completed appointments:", completedAppointments)
    console.log("👤 Current user:", { userId, userEmail })
  }, [pets, appointments, completedAppointments, userId, userEmail])

  // Fetch refund requests
  useEffect(() => {
    if (!userId) return

    const refundQuery = query(
      collection(db, "refundRequests"), 
      where("userId", "==", userId),
      orderBy("requestedAt", "desc")
    )

    const unsubscribeRefunds = onSnapshot(refundQuery, (snapshot) => {
      const refundData: RefundRequest[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        refundData.push({
          id: doc.id,
          appointmentId: data.appointmentId,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          petName: data.petName,
          appointmentType: data.appointmentType,
          originalDate: data.originalDate,
          originalTime: data.originalTime,
          amount: data.amount || 0,
          paymentMethod: data.paymentMethod,
          refundReason: data.refundReason,
          gcashReferenceNo: data.gcashReferenceNo,
          gcashPhoneNumber: data.gcashPhoneNumber,
          status: data.status,
          requestedAt: data.requestedAt,
          userId: data.userId,
          processedAt: data.processedAt,
          refundAmount: data.refundAmount,
          adminNotes: data.adminNotes,
          refundCompleted: data.refundCompleted || false
        })
      })
      setRefundRequests(refundData)
    })

    return () => unsubscribeRefunds()
  }, [userId])

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/homepage")
  }

  const openCancelModal = (appt: AppointmentType) => {
    setSelectedAppointment(appt)
    
    // Check if payment method is GCash
    if (appt.paymentMethod?.toLowerCase() === 'gcash') {
      setGcashReferenceNo("")
      setGcashPhoneNumber("")
      setRefundReason("")
      setShowRefundModal(true)
    } else {
      setGcashReferenceNoCancel("")
      setGcashPhoneNumberCancel("")
      setShowCancelModal(true)
    }
  }

  const handleRefundRequest = async () => {
    if (!selectedAppointment || !refundReason.trim() || !gcashPhoneNumber.trim()) {
      alert("Please provide both the GCash phone number and reason for cancellation.");
      return;
    }

    // Validate GCash phone number format (09XXXXXXXXX)
    const gcashRegex = /^09\d{9}$/;
    const cleanedPhone = gcashPhoneNumber.replace(/\s/g, '');
    
    if (!gcashRegex.test(cleanedPhone)) {
      alert("Please enter a valid GCash phone number (09XXXXXXXXX).");
      return;
    }

    setRefundProcessing(true);
    
    try {
      const servicePrices: Record<string, number> = {
        "vaccination": 500,
        "checkup": 300,
        "antiRabies": 300,
        "ultrasound": 800,
        "groom": 900,
        "spayNeuter": 1500,
        "deworm": 300
      };
      
      const refundAmount = servicePrices[selectedAppointment.appointmentType || "checkup"] || 300;

      const refundRequest = {
        appointmentId: selectedAppointment.id || "",
        clientName: selectedAppointment.clientName || "",
        clientEmail: userEmail || "",
        petName: selectedAppointment.petName || "",
        appointmentType: selectedAppointment.appointmentType || "checkup",
        originalDate: selectedAppointment.date || "",
        originalTime: selectedAppointment.timeSlot || "",
        amount: refundAmount,
        paymentMethod: selectedAppointment.paymentMethod || "GCash",
        refundReason: refundReason.trim(),
        gcashPhoneNumber: cleanedPhone,
        gcashReferenceNo: gcashReferenceNo.trim() || "",
        status: "pending",
        requestedAt: new Date().toISOString(),
        userId: userId || "",
        refundCompleted: false
      };

      console.log("📤 Creating refund request with data:", refundRequest);

      // Add refund request to Firestore
      const docRef = await addDoc(collection(db, "refundRequests"), refundRequest);
      console.log("✅ Refund request created with ID:", docRef.id);

      // Cancel the appointment
      await deleteDoc(doc(db, "appointments", selectedAppointment.id));

      setShowRefundModal(false);
      setRefundReason("");
      setGcashReferenceNo("");
      setGcashPhoneNumber("");
      setRefundProcessing(false);
      
      showSuccess(`Appointment cancelled and refund request for ₱${refundAmount} submitted successfully!`);
      
    } catch (error) {
      console.error("❌ Error processing refund request:", error);
      alert("Failed to process refund request. Please try again.");
      setRefundProcessing(false);
    }
  };

  // Update the regular cancel function to handle GCash reference if needed
  const handleDelete = async (id: string) => {
    try {
      // If it's a GCash payment and phone number is provided, create a refund request
      if (selectedAppointment?.paymentMethod?.toLowerCase() === 'gcash' && gcashPhoneNumberCancel.trim()) {
        // Validate GCash phone number format
        const gcashRegex = /^09\d{9}$/;
        if (!gcashRegex.test(gcashPhoneNumberCancel.replace(/\s/g, ''))) {
          alert("Please enter a valid GCash phone number (09XXXXXXXXX).");
          return;
        }

        const servicePrices: Record<string, number> = {
          "vaccination": 500,
          "checkup": 300,
          "antiRabies": 300,
          "ultrasound": 800,
          "groom": 900,
          "spayNeuter": 1500,
          "deworm": 300
        };
        
        const refundAmount = servicePrices[selectedAppointment.appointmentType || "checkup"] || 300;

        const refundRequest = {
          appointmentId: selectedAppointment.id,
          clientName: selectedAppointment.clientName,
          clientEmail: userEmail || "",
          petName: selectedAppointment.petName,
          appointmentType: selectedAppointment.appointmentType || "checkup",
          originalDate: selectedAppointment.date,
          originalTime: selectedAppointment.timeSlot,
          amount: refundAmount,
          paymentMethod: selectedAppointment.paymentMethod || "GCash",
          refundReason: "Appointment cancellation",
          gcashReferenceNo: gcashReferenceNoCancel.trim() || "",
          gcashPhoneNumber: gcashPhoneNumberCancel.replace(/\s/g, ''),
          status: "pending",
          requestedAt: new Date().toISOString(),
          userId: userId || "",
          refundCompleted: false
        };
        
        console.log("Creating refund request from cancel with data:", refundRequest);
        
        await addDoc(collection(db, "refundRequests"), refundRequest);
        showSuccess(`Appointment cancelled and refund request for ₱${refundAmount} submitted successfully!`);
      } else {
        // Regular cancellation without refund
        showSuccess("Appointment cancelled successfully!");
      }

      await deleteDoc(doc(db, "appointments", id));
      setShowCancelModal(false);
      setGcashReferenceNoCancel("");
      setGcashPhoneNumberCancel("");
    } catch (error) {
      console.error(error);
      alert("Failed to cancel appointment.");
    }
  }

  // Format GCash phone number as user types
  const formatGcashPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format as 09XX XXX XXXX
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    } else {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
    }
  }

  const handleGcashPhoneNumberChange = (value: string, isRefundModal: boolean = true) => {
    const formatted = formatGcashPhoneNumber(value);
    if (isRefundModal) {
      setGcashPhoneNumber(formatted);
    } else {
      setGcashPhoneNumberCancel(formatted);
    }
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

  const openRefundDetails = (refund: RefundRequest) => {
    setSelectedRefund(refund)
    setShowRefundDetailsModal(true)
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

    if (isTaken) return alert("This time slot is already unavailable.")

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

  // FIXED: Profile Saving Function
  const saveProfileChanges = async () => {
    if (!userId) {
      console.error("No user ID found")
      return
    }

    try {
      // Create complete profile data with all required fields
      const updatedProfile = {
        firstName: editFirstName.trim() || userEmail?.split("@")[0] || "User",
        lastName: editLastName.trim(),
        email: userEmail || "",
        phoneNumber: editPhoneNumber.trim(),
        age: editAge.trim(),
        location: editLocation.trim(),
        twoFactorEnabled: twoFactorEnabled,
        updatedAt: new Date().toISOString(),
        // Preserve existing fields if they exist
        ...(userProfile?.createdAt && { createdAt: userProfile.createdAt }),
      };

      console.log("Saving profile data:", updatedProfile);

      // Use setDoc with merge: true to ensure all fields are preserved
      await setDoc(doc(db, "users", userId), updatedProfile, { merge: true });

      // Update local state
      setUserProfile(prev => ({
        ...prev!,
        ...updatedProfile
      }));

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
    setEditPhoneNumber(userProfile?.phoneNumber || "")
    setEditAge(userProfile?.age || "")
    setEditLocation(userProfile?.location || "")
  }

  // FIXED: 2FA Functions
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
      
      // Update 2FA status with complete profile data
      if (userId) {
        await setDoc(doc(db, "users", userId), {
          twoFactorEnabled: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
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
          await setDoc(doc(db, "users", userId), {
            twoFactorEnabled: false,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
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

  const getRefundStatusLabel = (status: string, refundCompleted?: boolean) => {
    if (refundCompleted) {
      return "Refund Complete"
    }
    
    const statusMap: Record<string, string> = {
      "pending": "Pending Review",
      "approved": "Approved",
      "rejected": "Rejected",
      "completed": "Refund Complete"
    }
    return statusMap[status] || status
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
                              <AppointmentLabel>Status:</AppointmentLabel>
                              <AppointmentValue>{appt.status || "Scheduled"}</AppointmentValue>
                            </AppointmentInfo>
                            {appt.paymentMethod && (
                              <AppointmentInfo>
                                <AppointmentLabel>Payment:</AppointmentLabel>
                                <AppointmentValue>{appt.paymentMethod}</AppointmentValue>
                              </AppointmentInfo>
                            )}
                          </AppointmentLeftSide>
                          <StatusBadge status={appt.status || "Scheduled"}>
                            {appt.status || "Scheduled"}
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
              <ContentTitle>Edit Information</ContentTitle>
              <ContentSubtitle>Manage your personal information and contact details</ContentSubtitle>
            </ContentHeader>
            <ProfileDashboard>
              <ProfileInfoCard>
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
                    <DetailLabel>Phone Number:</DetailLabel>
                    <DetailValue>{userProfile?.phoneNumber || "Not set"}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Age:</DetailLabel>
                    <DetailValue>{userProfile?.age || "Not set"}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Location:</DetailLabel>
                    <DetailValue>{userProfile?.location || "Not set"}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Email:</DetailLabel>
                    <DetailValue>{userEmail}</DetailValue>
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
                  <EditProfileButton onClick={handleProfileClick}>Edit Information</EditProfileButton>
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
                      <ActivityStatus status={appt.status || "Scheduled"}>{appt.status || "Scheduled"}</ActivityStatus>
                    </ActivityItem>
                  ))}
                </ActivityList>
              )}
            </RecentActivitySection>
          </MainContent>
        )
    }
  }

  const renderHistorySidebar = () => {
    return (
      <>
        <HistoryTabs>
          <HistoryTab 
            $active={refundHistoryTab === "appointments"} 
            onClick={() => setRefundHistoryTab("appointments")}
          >
            Appointments ({completedAppointments.length})
          </HistoryTab>
          <HistoryTab 
            $active={refundHistoryTab === "refunds"} 
            onClick={() => setRefundHistoryTab("refunds")}
          >
            Refund Requests ({refundRequests.length})
          </HistoryTab>
        </HistoryTabs>

        <SidebarContent>
          {refundHistoryTab === "appointments" ? (
            completedAppointments.length === 0 ? (
              <NoHistoryMessage>
                <NoHistoryIcon>📋</NoHistoryIcon>
                <NoHistoryText>No appointment history yet</NoHistoryText>
              </NoHistoryMessage>
            ) : (
              <SidebarHistoryList>
                {completedAppointments.map((appt) => (
                  <SidebarHistoryCard key={appt.id} onClick={() => openHistoryModal(appt)}>
                    <SidebarCardHeader>
                      <AppointmentStatus>{appt.petName}</AppointmentStatus>
                      <SidebarStatusBadge status={appt.status || "Pending Payment"}>
                        {appt.status || "Pending Payment"}
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
            )
          ) : (
            refundRequests.length === 0 ? (
              <NoHistoryMessage>
                <NoHistoryIcon>💰</NoHistoryIcon>
                <NoHistoryText>No refund requests yet</NoHistoryText>
              </NoHistoryMessage>
            ) : (
              <SidebarHistoryList>
                {refundRequests.map((refund) => (
                  <RefundHistoryCard key={refund.id} onClick={() => openRefundDetails(refund)}>
                    <SidebarCardHeader>
                      <AppointmentStatus>{refund.petName}</AppointmentStatus>
                      <RefundStatusBadge 
                        $status={refund.status} 
                        $completed={refund.refundCompleted || refund.status === "completed"}
                      >
                        {getRefundStatusLabel(refund.status, refund.refundCompleted)}
                      </RefundStatusBadge>
                    </SidebarCardHeader>
                    <ServiceInfo>{getAppointmentTypeLabel(refund.appointmentType)}</ServiceInfo>
                    <DateInfo>
                      Requested: {formatDate(refund.requestedAt)}
                    </DateInfo>
                    {(refund.refundCompleted || refund.status === "completed") && (
                      <RefundCompleteBadge>
                        ✅ Refund Complete
                      </RefundCompleteBadge>
                    )}
                    <ClickHint>Click for details</ClickHint>
                  </RefundHistoryCard>
                ))}
              </SidebarHistoryList>
            )
          )}
        </SidebarContent>
      </>
    )
  }

  if (!isClient) {
    return (
      <ThemeProvider theme={themes.light}>
        <>
          <GlobalStyle theme={themes.light} />
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
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={themes.light}>
      <>
        <GlobalStyle theme={themes.light} />
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
                  <MenuIcon>⚙️</MenuIcon>
                  <MenuText>Settings</MenuText>
                </MenuItem>
              </MenuList>

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

          {/* MODALS */}
          {/* Profile Modal */}
          {showProfileModal && (
            <ModalOverlay onClick={cancelProfileEdit}>
              <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle>Edit Information</ModalTitle>
                  <CloseButton onClick={cancelProfileEdit}>×</CloseButton>
                </ModalHeader>
                <ModalContent>
                  <ProfileSection>
                    <FormGroup>
                      <Label htmlFor="first-name">First Name</Label>
                      <EditInput
                        id="first-name"
                        type="text"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        placeholder="Enter your first name"
                      />
                    </FormGroup>

                    <FormGroup>
                      <Label htmlFor="last-name">Last Name</Label>
                      <EditInput
                        id="last-name"
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder="Enter your last name"
                      />
                    </FormGroup>

                    <FormGroup>
                      <Label htmlFor="phone-number">Phone Number</Label>
                      <EditInput
                        id="phone-number"
                        type="tel"
                        value={editPhoneNumber}
                        onChange={(e) => setEditPhoneNumber(e.target.value)}
                        placeholder="Enter your phone number"
                      />
                    </FormGroup>

                    <FormGroup>
                      <Label htmlFor="age">Age</Label>
                      <EditInput
                        id="age"
                        type="text"
                        value={editAge}
                        onChange={(e) => setEditAge(e.target.value)}
                        placeholder="Enter your age"
                      />
                    </FormGroup>

                    <FormGroup>
                      <Label htmlFor="location">Location</Label>
                      <EditInput
                        id="location"
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="Enter your location"
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

          {/* 2FA Modal */}
          {show2FAModal && (
            <ModalOverlay onClick={() => setShow2FAModal(false)}>
              <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle>Two-Factor Authentication</ModalTitle>
                  <CloseButton onClick={() => setShow2FAModal(false)}>×</CloseButton>
                </ModalHeader>
                <ModalContent>
                  <SecuritySection>
                    <TwoFactorContainer>
                      <TwoFactorInfo>
                        <TwoFactorLabel>Two-Factor Authentication</TwoFactorLabel>
                        <TwoFactorDescription>
                          Add an extra layer of security to your account by enabling two-factor authentication.
                        </TwoFactorDescription>
                      </TwoFactorInfo>
                      {twoFactorEnabled ? (
                        <Disable2FAButton onClick={handleDisable2FA}>Disable 2FA</Disable2FAButton>
                      ) : (
                        <Enable2FAButton onClick={() => setShowOTPSetup(true)}>Enable 2FA</Enable2FAButton>
                      )}
                    </TwoFactorContainer>

                    {showOTPSetup && (
                      <OTPSetupSection>
                        <OTPSetupTitle>Set Up Two-Factor Authentication</OTPSetupTitle>
                        {!otpSent ? (
                          <OTPEmailSection>
                            <Label htmlFor="otp-email">Email Address for OTP</Label>
                            <EmailInput
                              id="otp-email"
                              type="email"
                              value={otpEmail}
                              onChange={(e) => setOtpEmail(e.target.value)}
                              placeholder="Enter your email address"
                              disabled={isSendingOTP}
                            />
                            <SendOTPButton onClick={handleSendOTP} disabled={isSendingOTP}>
                              {isSendingOTP ? "Sending..." : "Send OTP"}
                            </SendOTPButton>
                          </OTPEmailSection>
                        ) : (
                          <OTPVerificationSection>
                            <OTPInstructions>
                              We&apos;ve sent a 6-digit verification code to your email. Please enter it below.
                            </OTPInstructions>
                            <OTPInputGroup>
                              <Label htmlFor="verification-code">Verification Code</Label>
                              <OTPInput
                                id="verification-code"
                                type="text"
                                maxLength={6}
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                              />
                              <ResendOTPText>
                                Didn&apos;t receive the code?{' '}
                                <ResendLink onClick={handleSendOTP} disabled={isSendingOTP}>
                                  Resend OTP
                                </ResendLink>
                              </ResendOTPText>
                            </OTPInputGroup>
                            <OTPButtonGroup>
                              <CancelModalButton onClick={reset2FAForm}>Cancel</CancelModalButton>
                              <SubmitButton onClick={handleVerifyOTP}>Verify & Enable</SubmitButton>
                            </OTPButtonGroup>
                          </OTPVerificationSection>
                        )}
                      </OTPSetupSection>
                    )}
                  </SecuritySection>
                </ModalContent>
                <ModalActions>
                  <CancelModalButton onClick={() => setShow2FAModal(false)}>Close</CancelModalButton>
                </ModalActions>
              </ModalContainer>
            </ModalOverlay>
          )}

          {/* Refund Request Modal with GCash Phone Number */}
          {showRefundModal && selectedAppointment && (
            <ModalOverlay onClick={() => setShowRefundModal(false)}>
              <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle>Cancel Appointment & Request Refund</ModalTitle>
                  <CloseButton onClick={() => setShowRefundModal(false)}>×</CloseButton>
                </ModalHeader>
                <ModalContent>
                  <WarningMessage>
                    <WarningIcon>⚠️</WarningIcon>
                    <WarningText>
                      Since you paid via GCash, you need to request a refund for your payment.
                      Please provide your GCash registered phone number for the refund.
                    </WarningText>
                  </WarningMessage>

                  <AppointmentDetails>
                    <InfoItem>
                      <InfoLabel>Pet:</InfoLabel>
                      <InfoValue>{selectedAppointment.petName}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Service:</InfoLabel>
                      <InfoValue>{getAppointmentTypeLabel(selectedAppointment.appointmentType)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Date & Time:</InfoLabel>
                      <InfoValue>
                        {formatDate(selectedAppointment.date || today)} • {selectedAppointment.timeSlot}
                      </InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Payment Method:</InfoLabel>
                      <InfoValue>GCash (Refund Required)</InfoValue>
                    </InfoItem>
                  </AppointmentDetails>

                  <FormGroup>
                    <Label htmlFor="gcash-phone">
                      GCash Registered Phone Number *
                    </Label>
                    <EditInput
                      id="gcash-phone"
                      type="tel"
                      value={gcashPhoneNumber}
                      onChange={(e) => handleGcashPhoneNumberChange(e.target.value, true)}
                      placeholder="09XX XXX XXXX"
                      required
                      maxLength={13}
                    />
                    <InputHint>Enter your GCash registered mobile number (09XXXXXXXXX)</InputHint>
                  </FormGroup>

                  <FormGroup>
                    <Label htmlFor="gcash-reference">
                      GCash Reference Number 
                    </Label>
                    <EditInput
                      id="gcash-reference"
                      type="text"
                      value={gcashReferenceNo}
                      onChange={(e) => setGcashReferenceNo(e.target.value)}
                      placeholder="Enter GCash reference number if available"
                    />
                    <InputHint>This is the reference number from your GCash transaction receipt (optional)</InputHint>
                  </FormGroup>

                  <FormGroup>
                    <Label htmlFor="refund-reason">
                      Reason for Cancellation *
                    </Label>
                    <RefundTextarea
                      id="refund-reason"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Please explain why you&apos;re cancelling and requesting a refund..."
                      rows={4}
                      required
                    />
                  </FormGroup>

                  <RefundInfoNote>
                    <strong>Refund Process:</strong> Your refund request will be reviewed within 1-3 business days. 
                    Once approved, the amount will be refunded to your GCash account using the phone number you provided.
                  </RefundInfoNote>
                </ModalContent>
                <ModalActions>
                  <CancelModalButton 
                    onClick={() => {
                      setShowRefundModal(false)
                      setGcashReferenceNo("")
                      setGcashPhoneNumber("")
                      setRefundReason("")
                    }}
                    disabled={refundProcessing}
                  >
                    Cancel
                  </CancelModalButton>
                  <RefundRequestButton 
                    onClick={handleRefundRequest}
                    disabled={!refundReason.trim() || !gcashPhoneNumber.trim() || refundProcessing}
                  >
                    {refundProcessing ? "Processing..." : "Submit Refund Request"}
                  </RefundRequestButton>
                </ModalActions>
              </ModalContainer>
            </ModalOverlay>
          )}

          {/* Cancel Modal (for non-GCash payments and optional GCash phone number) */}
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
                      {selectedAppointment.paymentMethod?.toLowerCase() === 'gcash' && 
                        " If you paid via GCash and would like a refund, please provide your GCash registered phone number below."}
                    </WarningText>
                  </WarningMessage>

                  <AppointmentDetails>
                    <InfoItem>
                      <InfoLabel>Pet:</InfoLabel>
                      <InfoValue>{selectedAppointment.petName}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Service:</InfoLabel>
                      <InfoValue>{getAppointmentTypeLabel(selectedAppointment.appointmentType)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Date & Time:</InfoLabel>
                      <InfoValue>
                        {formatDate(selectedAppointment.date || today)} • {selectedAppointment.timeSlot}
                      </InfoValue>
                    </InfoItem>
                    {selectedAppointment.paymentMethod && (
                      <InfoItem>
                        <InfoLabel>Payment Method:</InfoLabel>
                        <InfoValue>{selectedAppointment.paymentMethod}</InfoValue>
                      </InfoItem>
                    )}
                  </AppointmentDetails>

                  {/* Add GCash phone number input for GCash payments in regular cancel modal */}
                  {selectedAppointment.paymentMethod?.toLowerCase() === 'gcash' && (
                    <>
                      <FormGroup>
                        <Label htmlFor="gcash-phone-cancel">
                          GCash Registered Phone Number (Optional - for refund)
                        </Label>
                        <EditInput
                          id="gcash-phone-cancel"
                          type="tel"
                          value={gcashPhoneNumberCancel}
                          onChange={(e) => handleGcashPhoneNumberChange(e.target.value, false)}
                          placeholder="09XX XXX XXXX"
                          maxLength={13}
                        />
                        <InputHint>Provide your GCash registered mobile number if requesting refund</InputHint>
                      </FormGroup>

                      <FormGroup>
                        <Label htmlFor="gcash-reference-cancel">
                          GCash Reference Number (Optional)
                        </Label>
                        <EditInput
                          id="gcash-reference-cancel"
                          type="text"
                          value={gcashReferenceNoCancel}
                          onChange={(e) => setGcashReferenceNoCancel(e.target.value)}
                          placeholder="Enter GCash reference number if available"
                        />
                        <InputHint>Reference number from your GCash transaction receipt</InputHint>
                      </FormGroup>
                    </>
                  )}
                </ModalContent>
                <ModalActions>
                  <CancelModalButton onClick={() => {
                    setShowCancelModal(false)
                    setGcashReferenceNoCancel("")
                    setGcashPhoneNumberCancel("")
                  }}>
                    Keep Appointment
                  </CancelModalButton>
                  <DeleteModalButton onClick={() => handleDelete(selectedAppointment.id)}>
                    Cancel Appointment
                  </DeleteModalButton>
                </ModalActions>
              </ModalContainer>
            </ModalOverlay>
          )}

          {/* Refund Details Modal */}
          {showRefundDetailsModal && selectedRefund && (
            <ModalOverlay onClick={() => setShowRefundDetailsModal(false)}>
              <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle>Refund Request Details</ModalTitle>
                  <CloseButton onClick={() => setShowRefundDetailsModal(false)}>×</CloseButton>
                </ModalHeader>
                <ModalContent>
                  <AppointmentDetails>
                    <InfoItem>
                      <InfoLabel>Pet Name:</InfoLabel>
                      <InfoValue>{selectedRefund.petName}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Service Type:</InfoLabel>
                      <InfoValue>{getAppointmentTypeLabel(selectedRefund.appointmentType)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Original Date:</InfoLabel>
                      <InfoValue>{formatDate(selectedRefund.originalDate)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Original Time:</InfoLabel>
                      <InfoValue>{selectedRefund.originalTime}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Payment Method:</InfoLabel>
                      <InfoValue>{selectedRefund.paymentMethod}</InfoValue>
                    </InfoItem>
                    {selectedRefund.gcashPhoneNumber && (
                      <InfoItem>
                        <InfoLabel>GCash Phone Number:</InfoLabel>
                        <InfoValue>{selectedRefund.gcashPhoneNumber}</InfoValue>
                      </InfoItem>
                    )}
                    {selectedRefund.gcashReferenceNo && (
                      <InfoItem>
                        <InfoLabel>GCash Reference No:</InfoLabel>
                        <InfoValue>{selectedRefund.gcashReferenceNo}</InfoValue>
                      </InfoItem>
                    )}
                    <InfoItem>
                      <InfoLabel>Refund Status:</InfoLabel>
                      <InfoValue>
                        <RefundStatusBadge 
                          $status={selectedRefund.status} 
                          $completed={selectedRefund.refundCompleted || selectedRefund.status === "completed"}
                        >
                          {getRefundStatusLabel(selectedRefund.status, selectedRefund.refundCompleted)}
                        </RefundStatusBadge>
                      </InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Requested At:</InfoLabel>
                      <InfoValue>{formatDate(selectedRefund.requestedAt)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Reason for Refund:</InfoLabel>
                      <InfoValue>{selectedRefund.refundReason}</InfoValue>
                    </InfoItem>
                    {selectedRefund.processedAt && (
                      <InfoItem>
                        <InfoLabel>Processed At:</InfoLabel>
                        <InfoValue>{formatDate(selectedRefund.processedAt)}</InfoValue>
                    </InfoItem>
                    )}
                    {selectedRefund.refundAmount && (
                      <InfoItem>
                        <InfoLabel>Refund Amount:</InfoLabel>
                        <InfoValue>₱{selectedRefund.refundAmount.toFixed(2)}</InfoValue>
                      </InfoItem>
                    )}
                    {selectedRefund.adminNotes && (
                      <InfoItem>
                        <InfoLabel>Admin Notes:</InfoLabel>
                        <InfoValue>{selectedRefund.adminNotes}</InfoValue>
                      </InfoItem>
                    )}
                  </AppointmentDetails>

                  {(selectedRefund.refundCompleted || selectedRefund.status === "completed") && (
                    <RefundSuccessMessage>
                      <RefundSuccessIcon>✅</RefundSuccessIcon>
                      <RefundSuccessText>
                        Your refund has been successfully processed. The amount has been refunded to your {selectedRefund.paymentMethod} account.
                        {selectedRefund.gcashPhoneNumber && ` (${selectedRefund.gcashPhoneNumber})`}
                        {selectedRefund.processedAt && ` The refund was completed on ${formatDate(selectedRefund.processedAt)}.`}
                      </RefundSuccessText>
                    </RefundSuccessMessage>
                  )}
                </ModalContent>
                <ModalActions>
                  <CancelModalButton onClick={() => setShowRefundDetailsModal(false)}>
                    Close
                  </CancelModalButton>
                </ModalActions>
              </ModalContainer>
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
                      <InfoLabel>Service:</InfoLabel>
                      <InfoValue>{getAppointmentTypeLabel(selectedAppointment.appointmentType)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Current Date & Time:</InfoLabel>
                      <InfoValue>
                        {formatDate(selectedAppointment.date || today)} • {selectedAppointment.timeSlot}
                      </InfoValue>
                    </InfoItem>
                  </AppointmentInfoModal>

                  <FormGroup>
                    <Label htmlFor="reschedule-date">New Date</Label>
                    <DateInput
                      id="reschedule-date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      min={today}
                    />
                  </FormGroup>

                  <FormGroup>
                    <Label htmlFor="reschedule-time">New Time Slot</Label>
                    <SelectInput
                      id="reschedule-time"
                      value={editSlot}
                      onChange={(e) => setEditSlot(e.target.value)}
                    >
                      <option value="">Select time slot</option>
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </SelectInput>
                  </FormGroup>
                </ModalContent>
                <ModalActions>
                  <CancelModalButton onClick={() => setShowRescheduleModal(false)}>Cancel</CancelModalButton>
                  <ConfirmButton onClick={saveEdit}>Reschedule</ConfirmButton>
                </ModalActions>
              </ModalContainer>
            </ModalOverlay>
          )}

          {/* History Modal */}
          {showHistoryModal && selectedAppointment && (
            <ModalOverlay onClick={() => setShowHistoryModal(false)}>
              <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle>Appointment Details</ModalTitle>
                  <CloseButton onClick={() => setShowHistoryModal(false)}>×</CloseButton>
                </ModalHeader>
                <ModalContent>
                  <AppointmentDetails>
                    <InfoItem>
                      <InfoLabel>Pet Name:</InfoLabel>
                      <InfoValue>{selectedAppointment.petName}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Service Type:</InfoLabel>
                      <InfoValue>{getAppointmentTypeLabel(selectedAppointment.appointmentType)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Date:</InfoLabel>
                      <InfoValue>{formatDate(selectedAppointment.date || today)}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Time Slot:</InfoLabel>
                      <InfoValue>{selectedAppointment.timeSlot}</InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Status:</InfoLabel>
                      <InfoValue>
                        <HistoryStatusBadge status={selectedAppointment.status || "Pending Payment"}>
                          {selectedAppointment.status || "Pending Payment"}
                        </HistoryStatusBadge>
                      </InfoValue>
                    </InfoItem>
                    <InfoItem>
                      <InfoLabel>Payment Method:</InfoLabel>
                      <InfoValue>{selectedAppointment.paymentMethod || "Not specified"}</InfoValue>
                    </InfoItem>
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
                    {selectedAppointment.completedAt && (
                      <InfoItem>
                        <InfoLabel>Completed At:</InfoLabel>
                        <InfoValue>{formatDate(selectedAppointment.completedAt)}</InfoValue>
                      </InfoItem>
                    )}
                  </AppointmentDetails>
                </ModalContent>
                <ModalActions>
                  <CancelModalButton onClick={() => setShowHistoryModal(false)}>Close</CancelModalButton>
                </ModalActions>
              </ModalContainer>
            </ModalOverlay>
          )}

          {/* History Sidebar */}
          {showHistorySidebar && (
            <>
              <SidebarOverlay onClick={() => setShowHistorySidebar(false)} />
              <HistorySidebar>
                <ModalHeader>
                  <ModalTitle>Appointment History</ModalTitle>
                  <CloseButton onClick={() => setShowHistorySidebar(false)}>×</CloseButton>
                </ModalHeader>
                {renderHistorySidebar()}
              </HistorySidebar>
            </>
          )}
        </PageContainer>
      </>
    </ThemeProvider>
  )
}

export default UserDashboard

// STYLED COMPONENTS
const PageContainer = styled.div<{ theme: Theme }>`
  min-height: 100vh;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  transition: background-color 0.3s ease, color 0.3s ease;
`

const HeaderBar = styled.header<{ theme: Theme }>`
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 1rem 1.5rem; 
  background: linear-gradient(90deg, #34B89C 0%, #6BC1E1 100%);
  box-shadow: 0 1px 3px ${props => props.theme.shadow};
  border-bottom: 1px solid ${props => props.theme.border};
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all 0.3s ease;

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

const MenuToggle = styled.div<{ $isOpen?: boolean; theme: Theme }>`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 24px;
  height: 18px;
  cursor: pointer;
  position: relative;

  span {
    height: 2px;
    width: 100%;
    background-color: ${props => props.theme.text};
    border-radius: 2px;
    transition: all 0.3s ease;
    transform-origin: center;
    
    &:nth-child(1) {
      transform: ${(props) => (props.$isOpen ? "translateY(8px) rotate(45deg)" : "translateY(0) rotate(0)")};
    }
    
    &:nth-child(2) {
      opacity: ${(props) => (props.$isOpen ? "0" : "1")};
      transform: ${(props) => (props.$isOpen ? "translateX(-10px)" : "translateX(0)")};
    }
    
    &:nth-child(3) {
      transform: ${(props) => (props.$isOpen ? "translateY(-8px) rotate(-45deg)" : "translateY(0) rotate(0)")};
    }
  }

  &:hover span {
    background-color: ${props => props.theme.secondary};
  }
`

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const LogoImage = styled.img`
  width: 35px;
  height: 35px;
  border-radius: 6px;
  object-fit: cover;
`

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
`

const ClinicName = styled.div<{ theme: Theme }>`
  font-weight: 800;
  font-size: 1.5rem;
  color: ${props => props.theme.text};
  letter-spacing: -0.5px;
  transition: color 0.3s ease;

  @media (max-width: 768px) {
    font-size: 1.3rem;
  }
`

const LogoSubtext = styled.div<{ theme: Theme }>`
  font-size: 0.7rem;
  color: ${props => props.theme.textSecondary};
  font-weight: 500;
  transition: color 0.3s ease;

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

const UserInfo = styled.div<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.text};
  font-size: 0.9rem;
  transition: color 0.3s ease;
  
  @media (max-width: 768px) {
    display: none;
  }
`

const LogoutButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.error};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #c0392b;
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    padding: 0.4rem 0.8rem;
    font-size: 0.75rem;
  }
`

const DashboardLayout = styled.div`
  display: flex;
  min-height: calc(100vh - 70px);
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`

const Sidebar = styled.aside<{ $isOpen: boolean; theme: Theme }>`
  width: 250px;
  background: ${(props) => props.theme.surface};
  border-right: 1px solid ${(props) => props.theme.border};
  display: flex;  
  flex-direction: column;
  box-shadow: 0 0 8px ${(props) => props.theme.shadow};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 90;

  @media (max-width: 1024px) {
    position: fixed;
    left: 0;
    top: 70px;
    height: calc(100vh - 70px);
    transform: translateX(${(props) => (props.$isOpen ? "0" : "-100%")});
    box-shadow: ${(props) => (props.$isOpen ? "2px 0 12px rgba(0,0,0,0.1)" : "none")};
  }

  @media (min-width: 1025px) {
    transform: translateX(${(props) => (props.$isOpen ? "0" : "-250px")});
    position: ${(props) => (props.$isOpen ? "static" : "fixed")};
  }
`

const SidebarHeader = styled.div<{ theme: Theme }>`
  padding: 1.25rem;
  border-bottom: 1px solid ${props => props.theme.border};
  background: ${props => props.theme.surface};
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

const SidebarTitle = styled.h3<{ theme: Theme }>`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: ${props => props.theme.text};
  letter-spacing: -0.3px;
  transition: color 0.3s ease;
`

const MenuList = styled.div`
  flex: 1;
  padding: 0.5rem 0;
`

const MenuItem = styled.div<{ $active: boolean; theme: Theme }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid ${(props) => (props.$active ? props.theme.primary : "transparent")};
  background: ${(props) => (props.$active ? props.theme.background : "transparent")};
  margin: 0;
  
  &:hover {
    background: ${(props) => props.theme.background};
    border-left-color: ${(props) => props.theme.primary};
  }
`

const MenuIcon = styled.div<{ theme: Theme }>`
  font-size: 1.1rem;
  color: ${props => props.theme.text};
  transition: color 0.3s ease;
`

const MenuText = styled.span<{ theme: Theme }>`
  flex: 1;
  font-weight: 600;
  color: ${props => props.theme.text};
  font-size: 0.9rem;
  transition: color 0.3s ease;
`

const MenuBadge = styled.span<{ $primary: boolean; theme: Theme }>`
  background: ${(props) => (props.$primary ? props.theme.primary : props.theme.textSecondary)};
  color: white;
  padding: 0.2rem 0.4rem;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 700;
`

const MenuCount = styled.span`
  background: #e74c3c;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const FloatingMenuButton = styled.button<{ theme: Theme }>`
  position: fixed;
  top: 80px;
  left: 0;
  z-index: 80;
  background: ${(props) => props.theme.primary};
  color: white;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${(props) => props.theme.secondary};
    transform: scale(1.05);
  }

  @media (min-width: 1025px) {
    display: none;
  }
`

const slideInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const ContentArea = styled.main<{ $sidebarOpen: boolean; theme: Theme }>`
  flex: 1;
  background: ${(props) => props.theme.background};
  overflow-y: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  padding: 1.5rem;

  @media (min-width: 1025px) {
    transform: none;
    width: 100%;
  }

  @media (max-width: 1024px) {
    width: 100%;
  }

  @media (max-width: 768px) {
    padding: 1.25rem;
  }

  @media (max-width: 480px) {
    padding: 1rem;
  }
`;

const MainContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
`;

const ContentHeader = styled.div`
  margin-bottom: 1.5rem;
  padding: 0;
  margin-left: 0.75rem;
  text-align: left;
  animation: ${slideInLeft} 0.6s ease forwards;
`;

const ContentTitle = styled.h1<{ theme: Theme }>`
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 800;
  color: ${(props) => props.theme.text};
  letter-spacing: -0.8px;
  transition: color 0.3s ease;

  @media (max-width: 768px) {
    font-size: 1.9rem;
  }
`;

const ContentSubtitle = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: 1rem;
  color: ${(props) => props.theme.textSecondary};
  font-weight: 500;
  transition: color 0.3s ease;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

// Continue with the rest of the styled components...
// [Rest of the styled components remain the same but with proper TypeScript types]
const QuickStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
`

const StatCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px ${props => props.theme.shadow};
  border: 1px solid ${props => props.theme.border};
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px ${props => props.theme.shadow};
  }
`

const StatIcon = styled.div<{ theme: Theme }>`
  font-size: 2rem;
  color: ${props => props.theme.primary};
  transition: color 0.3s ease;
`

const StatContent = styled.div`
  display: flex;
  flex-direction: column;
`

const StatNumber = styled.div<{ theme: Theme }>`
  font-size: 1.8rem;
  font-weight: 800;
  color: ${props => props.theme.text};
  line-height: 1;
  transition: color 0.3s ease;
`

const StatLabel = styled.div<{ theme: Theme }>`
  font-size: 0.85rem;
  color: ${props => props.theme.textSecondary};
  font-weight: 600;
  transition: color 0.3s ease;
`

const RecentActivitySection = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px ${props => props.theme.shadow};
  border: 1px solid ${props => props.theme.border};
  margin-bottom: 1.5rem;
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
`

const SectionTitle = styled.h2<{ theme: Theme }>`
  font-size: 1.3rem;
  font-weight: 700;
  color: ${props => props.theme.text};
  margin: 0;
  transition: color 0.3s ease;
`

const NoActivity = styled.div<{ theme: Theme }>`
  text-align: center;
  padding: 2rem;
  color: ${props => props.theme.textSecondary};
`

const NoActivityIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`

const NoActivityText = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: ${props => props.theme.textSecondary};
`

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`

const ActivityItem = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem;
  background: ${props => props.theme.background};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
`

const ActivityIcon = styled.div<{ theme: Theme }>`
  font-size: 1.3rem;
  color: ${props => props.theme.primary};
  transition: color 0.3s ease;
`

const ActivityContent = styled.div`
  flex: 1;
`

const ActivityTitle = styled.div<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.text};
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
`

const ActivityDate = styled.div<{ theme: Theme }>`
  font-size: 0.8rem;
  color: ${props => props.theme.textSecondary};
  transition: color 0.3s ease;
`

const ActivityStatus = styled.span<{ status: string; theme: Theme }>`
  padding: 0.35rem 0.7rem;
  border-radius: 16px;
  font-size: 0.7rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Completed":
        return "#d4edda"
      case "Cancelled":
        return "#f8d7da"
      case "Scheduled":
        return "#d1ecf1"
      default:
        return "#fff3cd"
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "Completed":
        return "#155724"
      case "Cancelled":
        return "#721c24"
      case "Scheduled":
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
  gap: 1.5rem;
`

const PetRegistrationCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 6px ${props => props.theme.shadow};
  border: 1px solid ${props => props.theme.border};
  display: flex;
  align-items: center;
  gap: 1.5rem;
  border-left: 4px solid ${props => props.theme.primary};
  
  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
  }
`

const PetRegistrationIcon = styled.div<{ theme: Theme }>`
  font-size: 3rem;
  color: ${props => props.theme.primary};
  background: ${props => props.theme.background};
  padding: 1.25rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  height: 80px;
  border: 1px solid ${props => props.theme.border};
`

const PetRegistrationContent = styled.div`
  flex: 1;
`

const PetRegistrationTitle = styled.h2<{ theme: Theme }>`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.theme.text};
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.5px;
  transition: color 0.3s ease;
`

const PetRegistrationText = styled.p<{ theme: Theme }>`
  font-size: 0.95rem;
  color: ${props => props.theme.textSecondary};
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
  transition: color 0.3s ease;
`

const PetRegistrationButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px ${props => props.theme.shadow};
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px ${props => props.theme.shadow};
  }
`

const ExistingPetsSection = styled.div`
  margin-top: 1.5rem;
`

const PetsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`

const PetListItem = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: ${props => props.theme.surface};
  border-radius: 10px;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.primary};
    box-shadow: 0 2px 6px ${props => props.theme.shadow};
  }
`

const PetItemIcon = styled.div<{ theme: Theme }>`
  font-size: 1.8rem;
  color: ${props => props.theme.primary};
  transition: color 0.3s ease;
`

const PetItemInfo = styled.div`
  flex: 1;
`

const PetItemName = styled.div<{ theme: Theme }>`
  font-weight: 700;
  color: ${props => props.theme.text};
  font-size: 1rem;
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
`

const PetItemDetails = styled.div<{ theme: Theme }>`
  color: ${props => props.theme.textSecondary};
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const PetItemActions = styled.div`
  display: flex;
  gap: 0.5rem;
`

const ViewRecordsButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-1px);
  }
`

// PETS GRID COMPONENTS
const PetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
`

const PetCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1.25rem;
  border: 1px solid ${props => props.theme.border};
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.primary};
    transform: translateY(-2px);
    box-shadow: 0 2px 6px ${props => props.theme.shadow};
  }
`

const PetIcon = styled.div<{ theme: Theme }>`
  font-size: 1.8rem;
  color: ${props => props.theme.primary};
  transition: color 0.3s ease;
`

const PetInfo = styled.div`
  flex: 1;
`

const PetName = styled.div<{ theme: Theme }>`
  font-weight: 700;
  color: ${props => props.theme.text};
  font-size: 1rem;
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
`

const PetDetails = styled.div<{ theme: Theme }>`
  color: ${props => props.theme.textSecondary};
  font-size: 0.8rem;
  transition: color 0.3s ease;
`

const ViewAllPetsCard = styled(PetCard)`
  cursor: pointer;
  background: ${props => props.theme.background};
  border-color: ${props => props.theme.primary};
  text-align: center;
  flex-direction: column;
  gap: 0.5rem;
  
  &:hover {
    background: ${props => props.theme.surface};
  }
`

const ViewAllIcon = styled.div<{ theme: Theme }>`
  font-size: 1.3rem;
  color: ${props => props.theme.primary};
  transition: color 0.3s ease;
`

const ViewAllText = styled.div<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.text};
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

// MEDICAL RECORDS SECTION
const MedicalRecordsDashboard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  gap: 1.5rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const ProfileInfoCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 6px ${props => props.theme.shadow};
  border: 1px solid ${props => props.theme.border};
  text-align: center;
`

const ProfileDetails = styled.div`
  text-align: left;
  margin-bottom: 1.5rem;
`

const DetailItem = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.875rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
  
  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`

const DetailLabel = styled.span<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.textSecondary};
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const DetailValue = styled.span<{ theme: Theme }>`
  color: ${props => props.theme.text};
  font-weight: 500;
  transition: color 0.3s ease;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.25rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`

const EditProfileButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-shadow: 0 2px 4px ${props => props.theme.shadow};
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px ${props => props.theme.shadow};
  }
`

const SecurityButton = styled.button<{ theme: Theme }>`
  background: #2c87c4;;
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-shadow: 0 2px 4px ${props => props.theme.shadow};
  
  &:hover {
    background: #5a6268;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px ${props => props.theme.shadow};
  }
`

const SecurityCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 6px ${props => props.theme.shadow};
  border: 1px solid ${props => props.theme.border};
`

const SecurityTitle = styled.h3<{ theme: Theme }>`
  font-size: 1.2rem;
  font-weight: 700;
  color: ${props => props.theme.text};
  margin: 0 0 1.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.3s ease;
`

const SecurityFeatures = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`

const SecurityFeature = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem;
  background: ${props => props.theme.background};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
`

const SecurityFeatureIcon = styled.div<{ theme: Theme }>`
  font-size: 1.3rem;
  color: ${props => props.theme.primary};
  transition: color 0.3s ease;
`

const SecurityFeatureInfo = styled.div`
  flex: 1;
`

const SecurityFeatureTitle = styled.div<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.text};
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
`

const SecurityFeatureStatus = styled.div<{ theme: Theme }>`
  font-size: 0.8rem;
  color: ${props => props.theme.textSecondary};
  font-weight: 500;
  transition: color 0.3s ease;
`

const SecurityActionButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.secondary};
  }
`

const SecurityStatus = styled.span<{ $enabled: boolean }>`
  color: ${(props) => (props.$enabled ? "#28a745" : "#dc3545")};
  font-weight: 600;
`

// APPOINTMENTS SECTION
const AppointmentsSection = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px ${props => props.theme.shadow};
  border: 1px solid ${props => props.theme.border};
`

const SectionTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const AppointmentCount = styled.span`
  background: #34B89C;
  color: white;
  padding: 0.35rem 0.7rem;
  border-radius: 14px;
  font-size: 0.75rem;
  font-weight: 700;
`

const NewAppointmentButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px ${props => props.theme.shadow};
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px ${props => props.theme.shadow};
  }
`

const NoAppointments = styled.div<{ theme: Theme }>`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: ${props => props.theme.textSecondary};
`

const NoAppointmentsIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`

const NoAppointmentsText = styled.p<{ theme: Theme }>`
  font-size: 1rem;
  margin: 0 0 1.25rem 0;
  font-weight: 500;
  color: ${props => props.theme.textSecondary};
`

const ScheduleButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px ${props => props.theme.shadow};
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px ${props => props.theme.shadow};
  }
`

const AppointmentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`

const AppointmentCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1.25rem;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.primary};
    box-shadow: 0 2px 6px ${props => props.theme.shadow};
  }
`

const AppointmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.875rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.875rem;
  }
`

const AppointmentLeftSide = styled.div`
  flex: 1;
`

const AppointmentStatus = styled.div<{ theme: Theme }>`
  font-weight: 700;
  color: ${props => props.theme.text};
  font-size: 1rem;
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
`

const AppointmentInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
`

const AppointmentLabel = styled.span<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.textSecondary};
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const AppointmentValue = styled.span<{ theme: Theme }>`
  color: ${props => props.theme.text};
  font-weight: 500;
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const AppointmentSeparator = styled.span<{ theme: Theme }>`
  color: ${props => props.theme.border};
  font-weight: 300;
`

const StatusBadge = styled.span<{ status: string; theme: Theme }>`
  padding: 0.4rem 0.8rem;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Completed":
        return "#d4edda"
      case "Pending Payment":
        return "#fff3cd"
      case "Cancelled":
        return "#f8d7da"
      case "Scheduled":
        return "#d1ecf1"
      default:
        return "#e2e3e5"
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "Completed":
        return "#155724"
      case "Pending Payment":
        return "#856404"
      case "Cancelled":
        return "#721c24"
      case "Scheduled":
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

const EditButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-1px);
  }
`

const DeleteButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.error};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #c0392b;
    transform: translateY(-1px);
  }
`

// HISTORY SIDEBAR COMPONENTS
const HistorySidebarToggle = styled.button<{ theme: Theme }>`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.875rem;
  border-radius: 50%;
  width: 55px;
  height: 55px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.2s ease;
  z-index: 100;
  
  &:hover {
    background: ${props => props.theme.secondary};
    transform: translateY(-2px);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
  }
`

const HistoryIcon = styled.div`
  font-size: 1.1rem;
`

const HistoryText = styled.span`
  font-size: 0.65rem;
  font-weight: 600;
`

const HistoryBadgeSmall = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`

// SUCCESS NOTIFICATION
const SuccessNotification = styled.div<{ theme: Theme }>`
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: #d4edda;
  color: #155724;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
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
  font-size: 1.1rem;
  font-weight: bold;
`

const SuccessText = styled.div`
  font-weight: 600;
  flex: 1;
  font-size: 0.9rem;
`

const CloseSuccessButton = styled.button`
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: #155724;
  padding: 0.25rem;
  
  &:hover {
    opacity: 0.7;
  }
`

// MODAL COMPONENTS
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

const ModalContainer = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  width: 100%;
  max-width: 480px;
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

const ModalHeader = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid ${props => props.theme.border};
`

const ModalTitle = styled.h2<{ theme: Theme }>`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: ${props => props.theme.text};
  transition: color 0.3s ease;
`

const CloseButton = styled.button<{ theme: Theme }>`
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  color: ${props => props.theme.textSecondary};
  padding: 0.25rem;
  transition: color 0.3s ease;
  
  &:hover {
    color: ${props => props.theme.text};
  }
`

const ModalContent = styled.div`
  padding: 1.5rem;
`

const ModalActions = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e9ecef;
  justify-content: flex-end;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`

// FORM COMPONENTS
const FormGroup = styled.div`
  margin-bottom: 1.25rem;
`

const Label = styled.label<{ theme: Theme }>`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: ${props => props.theme.text};
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const EditInput = styled.input<{ theme: Theme }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid ${props => props.theme.border};
  border-radius: 8px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
`

const DateInput = styled(EditInput)``

const SelectInput = styled.select<{ theme: Theme }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid ${props => props.theme.border};
  border-radius: 8px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
`

const EmailDisplay = styled.div<{ theme: Theme }>`
  padding: 0.75rem 1rem;
  background: ${props => props.theme.background};
  border: 2px solid ${props => props.theme.border};
  border-radius: 8px;
  color: ${props => props.theme.textSecondary};
  font-size: 0.9rem;
  transition: all 0.3s ease;
`

// PROFILE MODAL COMPONENTS
const ProfileSection = styled.div`
  margin-bottom: 1.5rem;
`

const SecuritySection = styled.div`
  margin-bottom: 1rem;
`

const TwoFactorContainer = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: ${props => props.theme.background};
  border-radius: 10px;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
`

const TwoFactorInfo = styled.div`
  flex: 1;
`

const TwoFactorLabel = styled.div<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.text};
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
`

const TwoFactorDescription = styled.div<{ theme: Theme }>`
  font-size: 0.8rem;
  color: ${props => props.theme.textSecondary};
  line-height: 1.4;
  transition: color 0.3s ease;
`

const Enable2FAButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.secondary};
  }
`

const Disable2FAButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.error};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #c82333;
  }
`

const OTPSetupSection = styled.div<{ theme: Theme }>`
  border: 1px solid ${props => props.theme.border};
  border-radius: 10px;
  padding: 1.25rem;
  background: ${props => props.theme.background};
  margin-top: 1rem;
  transition: all 0.3s ease;
`

const OTPSetupTitle = styled.h4<{ theme: Theme }>`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: ${props => props.theme.text};
  font-weight: 600;
  transition: color 0.3s ease;
`

const OTPEmailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const EmailInput = styled.input<{ theme: Theme }>`
  padding: 0.75rem;
  border: 1px solid ${props => props.theme.border};
  border-radius: 6px;
  font-size: 0.9rem;
  width: 100%;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 2px rgba(52, 184, 156, 0.1);
  }

  &:disabled {
    background-color: ${props => props.theme.background};
    opacity: 0.6;
  }
`

const SendOTPButton = styled.button<{ theme: Theme }>`
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  background: ${props => props.theme.primary};
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-start;

  &:hover:not(:disabled) {
    background: ${props => props.theme.secondary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const OTPVerificationSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

const OTPInstructions = styled.p<{ theme: Theme }>`
  margin: 0;
  color: ${props => props.theme.textSecondary};
  line-height: 1.5;
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const OTPInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const OTPInput = styled.input<{ theme: Theme }>`
  padding: 0.75rem;
  border: 2px solid ${props => props.theme.border};
  border-radius: 6px;
  font-size: 1.1rem;
  text-align: center;
  letter-spacing: 0.5rem;
  font-weight: 600;
  font-family: monospace;
  width: 100%;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
`

const ResendOTPText = styled.p<{ theme: Theme }>`
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: ${props => props.theme.textSecondary};
  text-align: center;
  transition: color 0.3s ease;
`

const ResendLink = styled.button<{ theme: Theme }>`
  background: none;
  border: none;
  color: ${props => props.theme.primary};
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.85rem;
  transition: color 0.3s ease;

  &:hover:not(:disabled) {
    color: ${props => props.theme.secondary};
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

const SubmitButton = styled.button<{ theme: Theme }>`
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  background: ${props => props.theme.primary};
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: ${props => props.theme.secondary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

// BUTTON COMPONENTS
const CancelModalButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.textSecondary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.85rem;
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

const SaveProfileButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.secondary};
  }
`

const ConfirmButton = styled(SaveProfileButton)``

const DeleteModalButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.error};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #c0392b;
  }
`

// APPOINTMENT INFO COMPONENTS
const AppointmentInfoModal = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.background};
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
`

const InfoItem = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
  
  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`

const InfoLabel = styled.span<{ theme: Theme }>`
  font-weight: 600;
  color: ${props => props.theme.textSecondary};
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const InfoValue = styled.span<{ theme: Theme }>`
  color: ${props => props.theme.text};
  font-weight: 500;
  text-align: right;
  flex: 1;
  margin-left: 1rem;
  transition: color 0.3s ease;
`

const WarningMessage = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
`

const WarningIcon = styled.div`
  font-size: 1.3rem;
  color: #856404;
`

const WarningText = styled.div`
  color: #856404;
  font-weight: 500;
  line-height: 1.4;
  flex: 1;
  font-size: 0.9rem;
`

const AppointmentDetails = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.background};
  border-radius: 10px;
  padding: 1.25rem;
  border: 1px solid ${props => props.theme.border};
  transition: all 0.3s ease;
`

const HistoryStatusBadge = styled.span<{ status: string; theme: Theme }>`
  padding: 0.35rem 0.7rem;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${(props) => {
    switch (props.status) {
      case "Completed":
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
      case "Completed":
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

// HISTORY SIDEBAR
const SidebarOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1998;
`

const HistorySidebar = styled.div<{ theme: Theme }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  background: ${props => props.theme.surface};
  box-shadow: -4px 0 16px rgba(0,0,0,0.1);
  z-index: 1999;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  
  @media (max-width: 480px) {
    width: 100%;
  }
`

const SidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`

const NoHistoryMessage = styled.div<{ theme: Theme }>`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: ${props => props.theme.textSecondary};
`

const NoHistoryIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`

const NoHistoryText = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: ${props => props.theme.textSecondary};
`

const SidebarHistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`

const SidebarHistoryCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1rem;
  border: 1px solid ${props => props.theme.border};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.primary};
    transform: translateX(-4px);
    box-shadow: 0 2px 6px ${props => props.theme.shadow};
  }
`

const SidebarCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`

const ServiceInfo = styled.div<{ theme: Theme }>`
  color: ${props => props.theme.textSecondary};
  font-weight: 500;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
  transition: color 0.3s ease;
`

const DateInfo = styled.div<{ theme: Theme }>`
  color: ${props => props.theme.textSecondary};
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
`

const ClickHint = styled.div<{ theme: Theme }>`
  color: ${props => props.theme.primary};
  font-size: 0.7rem;
  font-weight: 600;
  text-align: right;
  transition: color 0.3s ease;
`

// NEW STYLED COMPONENTS FOR REFUND HISTORY
const HistoryTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #e9ecef;
  padding: 0 1rem;
`

const HistoryTab = styled.button<{ $active: boolean; theme: Theme }>`
  flex: 1;
  padding: 1rem 0.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? props.theme.primary : 'transparent'};
  color: ${props => props.$active ? props.theme.primary : props.theme.textSecondary};
  font-weight: ${props => props.$active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.85rem;

  &:hover {
    color: ${props => props.theme.primary};
  }
`

const RefundHistoryCard = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.surface};
  border-radius: 10px;
  padding: 1rem;
  border: 1px solid ${props => props.theme.border};
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid ${props => props.theme.primary};
  
  &:hover {
    border-color: ${props => props.theme.primary};
    transform: translateX(-4px);
    box-shadow: 0 2px 6px ${props => props.theme.shadow};
  }
`

const RefundStatusBadge = styled.span<{ $status: string; $completed?: boolean; theme: Theme }>`
  padding: 0.35rem 0.7rem;
  border-radius: 16px;
  font-size: 0.7rem;
  font-weight: 700;
  background: ${props => {
    if (props.$completed) {
      return "#d4edda";
    }
    const statusColors: Record<string, { background: string; color: string }> = {
      "pending": { background: "#fff3cd", color: "#856404" },
      "approved": { background: "#d1ecf1", color: "#0c5460" },
      "rejected": { background: "#f8d7da", color: "#721c24" },
      "completed": { background: "#d4edda", color: "#155724" }
    }
    return statusColors[props.$status]?.background || "#e2e3e5"
  }};
  color: ${props => {
    if (props.$completed) {
      return "#155724";
    }
    const statusColors: Record<string, { background: string; color: string }> = {
      "pending": { background: "#fff3cd", color: "#856404" },
      "approved": { background: "#d1ecf1", color: "#0c5460" },
      "rejected": { background: "#f8d7da", color: "#721c24" },
      "completed": { background: "#d4edda", color: "#155724" }
    }
    return statusColors[props.$status]?.color || "#383d41"
  }};
  white-space: nowrap;
`

const RefundCompleteBadge = styled.div<{ theme: Theme }>`
  background: #d4edda;
  color: #155724;
  padding: 0.4rem 0.7rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-top: 0.5rem;
  text-align: center;
  border: 1px solid #c3e6cb;
`

const RefundSuccessMessage = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 10px;
  padding: 1.25rem;
  margin-top: 1rem;
`

const RefundSuccessIcon = styled.div`
  font-size: 1.3rem;
  color: #155724;
`

const RefundSuccessText = styled.div`
  color: #155724;
  font-weight: 500;
  line-height: 1.4;
  flex: 1;
  font-size: 0.9rem;
`

// NEW STYLED COMPONENTS FOR REFUND FEATURE
const RefundTextarea = styled.textarea<{ theme: Theme }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid ${props => props.theme.border};
  border-radius: 8px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  font-family: inherit;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 3px rgba(52, 184, 156, 0.1);
  }
  
  &::placeholder {
    color: ${props => props.theme.textSecondary};
  }
`

const RefundRequestButton = styled.button<{ theme: Theme }>`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    background: ${props => props.theme.secondary};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: ${props => props.theme.textSecondary};
  }
`

const RefundInfoNote = styled.div<{ theme: Theme }>`
  background: ${props => props.theme.background};
  border: 1px solid ${props => props.theme.border};
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.85rem;
  color: ${props => props.theme.textSecondary};
  line-height: 1.4;
  margin-top: 1rem;
  
  strong {
    color: ${props => props.theme.text};
  }
`

const InputHint = styled.div<{ theme: Theme }>`
  font-size: 0.75rem;
  color: ${props => props.theme.textSecondary};
  margin-top: 0.25rem;
  transition: color 0.3s ease;
  font-style: italic;
`