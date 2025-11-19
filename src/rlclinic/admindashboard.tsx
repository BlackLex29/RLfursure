import React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";

interface UserRole {
  twoFactorEnabled?: boolean;
  email?: string;
  name?: string;
  role?: string;
}
// 
import { useRouter } from "next/navigation";
import { auth, db } from "../firebaseConfig";
import { Metadata } from 'next';
import { signOut, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, addDoc, onSnapshot, doc, updateDoc, setDoc, query, getDoc, where } from "firebase/firestore";


const refundStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "#ffc107";
    case "approved":
      return "#17a2b8";
    case "processing":
      return "#fd7e14";
    case "completed":
      return "#28a745";
    default:
      return "#6c757d";
  }
};

const GlobalStyle = createGlobalStyle`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        background-color: #f8fafc;
        margin: 0;
        padding: 0;
        overflow-x: hidden;
        scroll-behavior: smooth;
      }
      * {
        box-sizing: border-box;
      }
    `;

const fadeInUp = keyframes`
      from { opacity: 0; transform: translateY(25px); }
      to { opacity: 1; transform: translateY(0); }
    `;

const slideIn = keyframes`
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    `;

// Asana-inspired modal animations
const asanaSlideIn = keyframes`
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    `;

const asanaOverlayFade = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;

interface AppointmentType {
  id: string;
  clientName: string;
  petName?: string;
  birthday?: string;
  color?: string;
  petType?: string;
  petBreed?: string;  // For admin dashboard compatibility
  breed?: string;     // For user appointment compatibility
  gender?: string;
  date: string;
  timeSlot: string;
  status?: "Pending" | "Confirmed" | "Done" | "Cancelled";
  bookedByAdmin?: boolean;
  createdAt?: string;
  serviceType?: string;
  petId?: string;
  paymentMethod?: string;
  paymentStatus?: "Pending Payment" | "Complete Payment" | "Failed" | "Pending Verification";
  referenceNumber?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  completedAt?: string;
}

interface ClientType {
  id: string;
  email: string;
  name?: string;
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
  originalId?: string;
  dayIndex?: number;
  startDate?: string;
  createdAt?: string;
}

interface RefundRequestType {
  id: string;
  appointmentId: string;
  clientName: string;
  clientEmail: string;
  petName: string;
  appointmentType: string;
  originalDate: string;
  originalTime: string;
  amount: number;
  paymentMethod: string;
  refundReason: string;
  status: "pending" | "approved" | "processing" | "completed";
  requestedAt: string;
  userId: string;
  processedAt?: string;
  processedBy?: string;
  adminNotes?: string;
  paymongoPaymentId?: string;
  paymongoRefundId?: string;
  paymongoRefundStatus?: "pending" | "succeeded" | "failed";
  paymongoRefundError?: string;
  gcashReferenceNo?: string;
  gcashPhoneNumber?: string;
  refundCompleted?: boolean;
}

interface AppointmentCardProps {
  $delay: number;
  $borderLeftColor: string;
}

interface SidebarProps {
  $isOpen: boolean;
}

interface MenuItemProps {
  $active?: boolean;
}

interface ServiceStats {
  service: string;
  dogs: number;
  cats: number;
}

interface PetType {
  id: string;
  petType?: string;
  petName?: string;
  breed?: string;
  gender?: string;
  color?: string;
  birthday?: string;
  userId?: string;
}

interface VaccinationTrend {
  month: string;
  monthKey: string;
  dogs: number;
  cats: number;
  total: number;
  trend: "increased" | "decreased" | "stable";
  percentageChange: number;
}

// User Management Interfaces
interface UserType {
  id: string;
  email: string;
  name: string;
  role: "admin" | "doctor" | "client";
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  status: "active" | "inactive" | "suspended";
  phoneNumber?: string;
}

// OTP Verification Interface
function isAuthError(error: unknown): error is { code: string; message: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const Admindashboard: React.FC = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentType[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  const [clients, setClients] = useState<ClientType[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequestType[]>([]);
  const [pendingRefundCount, setPendingRefundCount] = useState(0);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [petName, setPetName] = useState("");
  const [petBirthday, setPetBirthday] = useState("");
  const [petColor, setPetColor] = useState("");
  const [petType, setPetType] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petGender, setPetGender] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [serviceType, setServiceType] = useState("Check Up");
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "today" | "all" | "unavailable" | "settings" | "refunds" | "users">("dashboard");
  const [isMounted, setIsMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [serviceStats, setServiceStats] = useState<ServiceStats[]>([]);
  const [statsSelectedMonth, setStatsSelectedMonth] = useState<string>("");
  const [statsSelectedYear, setStatsSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [showUnavailableDetails, setShowUnavailableDetails] = useState(false);
  const [selectedUnavailable, setSelectedUnavailable] = useState<UnavailableSlot | null>(null);
  const [totalStats, setTotalStats] = useState({
    totalDogs: 0,
    totalCats: 0,
    totalAppointments: 0
  });
  const [vaccinationTrends, setVaccinationTrends] = useState<VaccinationTrend[]>([]);
  const [isTrendsLoading, setIsTrendsLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusItemId, setStatusItemId] = useState<string>("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false);
  const [medicalRecordAppointment, setMedicalRecordAppointment] = useState<AppointmentType | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [showCompleteRefundModal, setShowCompleteRefundModal] = useState(false);
  const [completingRefund, setCompletingRefund] = useState(false);
  const [refundToComplete, setRefundToComplete] = useState<RefundRequestType | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"admin" | "doctor">("doctor");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createAccountMessage, setCreateAccountMessage] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);

  // User Management State
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filter2FA, setFilter2FA] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  // Add these with your other state variables
  const [currentDate, setCurrentDate] = useState(new Date());
  // Enhanced Booking State
  const [clientPets, setClientPets] = useState<PetType[]>([]);
  const [selectedPet, setSelectedPet] = useState("");
  const months = useMemo(() => [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);

  const services = useMemo(() => [
    "vaccination",
    "checkup",
    "antiRabies",
    "ultrasound",
    "groom",
    "spayNeuter",
    "deworm"
  ], []);

  const serviceLabels = useMemo(() => ({
    "vaccination": "Vaccination",
    "checkup": "Check Up",
    "antiRabies": "Anti Rabies",
    "ultrasound": "Ultrasound",
    "groom": "Grooming",
    "spayNeuter": "Spay/Neuter (Kapon)",
    "deworm": "Deworming (Purga)"
  }), []);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
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
  ];

  
  // Date navigation functions
  const handleDateNavigation = (direction: 'prev' | 'next' | 'tomorrow' | 'nextWeek') => {
    const newDate = new Date(currentDate);

    switch (direction) {
      case 'prev':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'next':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'tomorrow':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setCurrentDate(tomorrow);
        return;
      case 'nextWeek':
        newDate.setDate(newDate.getDate() + 7);
        break;
    }

    setCurrentDate(newDate);
  };
const openUnavailableDetails = (slot: UnavailableSlot) => {
  setSelectedUnavailable(slot);
  setShowUnavailableDetails(true);
};

const closeUnavailableDetails = () => {
  setShowUnavailableDetails(false);
  setSelectedUnavailable(null);
};
  const formatCurrentDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getAppointmentsForCurrentDate = () => {
    const currentDateString = currentDate.toISOString().split("T")[0];

    return appointments.filter(appointment => {
      if (!appointment.date) return false;

      // Normalize the appointment date for comparison
      let appointmentDateString = appointment.date;

      // If date is in timestamp format, convert to YYYY-MM-DD
      if (appointment.date.includes('T')) {
        try {
          const appointmentDate = new Date(appointment.date);
          appointmentDateString = appointmentDate.toISOString().split("T")[0];
        } catch (error) {
          console.error("Error parsing timestamp date:", appointment.date, error);
          return false;
        }
      }

      // If date is in a different format (like MM/DD/YYYY), try to parse it
      if (appointment.date.includes('/')) {
        try {
          const parts = appointment.date.split('/');
          if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            appointmentDateString = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error("Error parsing slash date:", appointment.date, error);
          return false;
        }
      }

      // Direct comparison for YYYY-MM-DD format
      return appointmentDateString === currentDateString;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };
  // Enhanced Real OTP Functions
  const sendRealOTP = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, message: "User not authenticated" };
      }

      console.log(`📧 Sending real OTP to: ${email}`);

      // Check if OTP was already sent recently (prevent spam)
      const lastOTPSent = localStorage.getItem(`lastOTPSent_${email}`);
      if (lastOTPSent) {
        const timeDiff = Date.now() - parseInt(lastOTPSent);
        if (timeDiff < 30000) { // 30 seconds cooldown
          return {
            success: false,
            message: "Please wait 30 seconds before requesting a new code"
          };
        }
      }

      // Call the send-email-otp API
      const response = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          name: currentUser.displayName || email.split('@')[0],
          userId: currentUser.uid
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("✅ Real OTP sent successfully via Brevo API");

        // Store the OTP hash for verification
        if (data.otpHash) {
          localStorage.setItem(`otpHash_${email}`, data.otpHash);
          localStorage.setItem(`lastOTPSent_${email}`, Date.now().toString());
          console.log("💾 OTP hash stored for verification");
        }

        return {
          success: true,
          message: "✅ Verification code sent to your email! Please check your inbox and spam folder."
        };
      } else {
        console.error("❌ API error:", data);
        return {
          success: false,
          message: `❌ ${data.error || 'Failed to send verification code. Please try again.'}`
        };
      }
    } catch (error) {
      console.error("❌ Error sending OTP:", error);
      return {
        success: false,
        message: "❌ Network error. Please check your connection and try again."
      };
    }
  };
  const handleEnable2FA = async () => {
    if (!otpEmail) {
      alert("❌ Please enter your email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(otpEmail)) {
      alert("❌ Please enter a valid email address");
      return;
    }

    // Prevent multiple simultaneous OTP requests
    if (isSendingOTP) {
      alert("⏳ Please wait, OTP is already being sent...");
      return;
    }

    setIsSendingOTP(true);
    try {
      console.log("🔒 Starting 2FA setup for:", otpEmail);

      const result = await sendRealOTP(otpEmail);

      if (result.success) {
        setOtpSent(true);
        // Don't show alert here, let the modal handle the success message
        console.log("✅ OTP sent successfully");
      } else {
        alert(`❌ ${result.message}\n\nPlease try again or contact support if the problem continues.`);
        setOtpSent(false);
      }
    } catch (error) {
      console.error("Unexpected error in handleEnable2FA:", error);
      alert("❌ Unexpected error occurred. Please try again.");
      setOtpSent(false);
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (verificationCode.length !== 6) {
      alert("Please enter a valid 6-digit OTP");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("User not authenticated");
      return;
    }

    setTwoFALoading(true);
    try {
      // Get the OTP hash that was stored when OTP was sent
      const otpHash = localStorage.getItem(`otpHash_${otpEmail}`);

      if (!otpHash) {
        alert("OTP session expired. Please request a new code.");
        setTwoFALoading(false);
        return;
      }

      console.log("🔍 Verifying OTP with hash:", otpHash.substring(0, 20) + "...");

      // Call the verify-otp API with ALL required parameters
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: otpEmail,
          code: verificationCode,
          otpHash: otpHash,
          userId: currentUser.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setTwoFactorEnabled(true);
        localStorage.setItem('twoFactorEnabled', 'true');

        // Clean up OTP session
        localStorage.removeItem(`otpHash_${otpEmail}`);

        setShow2FAModal(false);
        setVerificationCode("");
        setOtpSent(false);

        // Show better success message
        setTimeout(() => {
          alert("🎉 Two-Factor Authentication has been successfully enabled!\n\nYour account is now more secure with email verification.");
        }, 300);
      } else {
        alert("❌ " + (data.error || "Failed to verify OTP. Please try again."));
      }
    } catch (error) {
      console.error("❌ Error verifying OTP:", error);
      alert("❌ Network error. Please check your connection and try again.");
    } finally {
      setTwoFALoading(false);
    }
  };

  // Enhanced Booking Functions
  const fetchClientPets = async (clientName: string) => {
    try {
      // First, find the client's user ID
      const client = clients.find(c => c.name === clientName || c.email === clientName);
      if (!client) {
        setClientPets([]);
        return;
      }

      // Fetch pets for this client
      const petsQuery = query(collection(db, "pets"), where("userId", "==", client.id));
      const snapshot = await getDocs(petsQuery);
      const petsData: PetType[] = [];

      snapshot.forEach((doc) => {
        const petData = doc.data();
        petsData.push({
          id: doc.id,
          petType: petData.petType,
          petName: petData.petName,
          breed: petData.breed,
          gender: petData.gender,
          color: petData.color,
          birthday: petData.birthday,
          userId: petData.userId
        });
      });

      setClientPets(petsData);

      // Auto-fill the first pet if available
      if (petsData.length > 0) {
        setSelectedPet(petsData[0].id);
        autoFillPetData(petsData[0]);
      }
    } catch (error) {
      console.error("Error fetching client pets:", error);
      setClientPets([]);
    }
  };

  const autoFillPetData = (pet: PetType) => {
    setPetName(pet.petName || "");
    setPetType(pet.petType || "");
    setPetBreed(pet.breed || "");
    setPetGender(pet.gender || "");
    setPetColor(pet.color || "");
    setPetBirthday(pet.birthday || "");
  };

  const resetPetForm = () => {
    setPetName("");
    setPetBirthday("");
    setPetColor("");
    setPetType("");
    setPetBreed("");
    setPetGender("");
    setSelectedPet("");
  };

  // User Management Functions
  const fetchUsers = async () => {
    try {
      const usersQuery = query(collection(db, "users"));
      const snapshot = await getDocs(usersQuery);
      const usersData: UserType[] = [];

      snapshot.forEach((doc) => {
        const userData = doc.data();
        usersData.push({
          id: doc.id,
          email: userData.email || "",
          name: userData.name || "Unknown User",
          role: userData.role || "client",
          twoFactorEnabled: userData.twoFactorEnabled || false,
          emailVerified: userData.emailVerified || false,
          lastLogin: userData.lastLogin,
          createdAt: userData.createdAt || new Date().toISOString(),
          status: userData.status || "active",
          phoneNumber: userData.phoneNumber
        });
      });

      // Sort by name
      usersData.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users. Please try again.");
    }
  };

  const handleSendPasswordReset = async (user: UserType) => {
    setSelectedUser(user);
    setResetPasswordEmail(user.email);
    setShowPasswordResetModal(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordEmail.trim()) {
      setPasswordResetMessage("Please enter a valid email address");
      return;
    }

    setIsSendingReset(true);
    setPasswordResetMessage("");

    try {
      // Send password reset email using Firebase Auth
      await sendPasswordResetEmail(auth, resetPasswordEmail);

      // Log the reset request in Firestore
      await addDoc(collection(db, "passwordResetRequests"), {
        userId: selectedUser?.id || "unknown",
        userEmail: resetPasswordEmail,
        requestedBy: auth.currentUser?.email || "admin",
        requestedAt: new Date().toISOString(),
        status: "sent"
      });

      setPasswordResetMessage("✅ Password reset email sent successfully!");

      setTimeout(() => {
        setShowPasswordResetModal(false);
        setPasswordResetMessage("");
        setResetPasswordEmail("");
        setSelectedUser(null);
      }, 2000);

    } catch (error) {
      console.error("Error sending password reset:", error);
      setPasswordResetMessage("❌ Failed to send password reset email. Please try again.");
    } finally {
      setIsSendingReset(false);
    }
  };

  // Refund Completion Modal Functions
  const openCompleteRefundModal = (refund: RefundRequestType) => {
    setRefundToComplete(refund);
    setShowCompleteRefundModal(true);
  };

  const closeCompleteRefundModal = () => {
    setShowCompleteRefundModal(false);
    setRefundToComplete(null);
    setCompletingRefund(false);
  };

  const handleCompleteRefundConfirm = async () => {
    if (!refundToComplete) return;
    setCompletingRefund(true);
    try {
      const success = await markRefundAsCompleted(refundToComplete.id);
      if (success) {
        fetchRefundRequests();
        closeCompleteRefundModal();
      }
    } catch (error) {
      console.error('Error completing refund:', error);
      alert('Failed to complete refund. Please try again.');
    } finally {
      setCompletingRefund(false);
    }
  };

  // Function to display payment status with proper labels
  const getPaymentStatusDisplay = (appointment: AppointmentType) => {
    if (appointment.paymentStatus) {
      return appointment.paymentStatus;
    }

    // Simplified logic without "Pending Verification"
    if (appointment.paymentMethod === "GCash" && appointment.status === "Confirmed") {
      return "Complete Payment";
    }
    if (appointment.paymentMethod === "GCash" && appointment.referenceNumber) {
      return "Complete Payment"; // Auto-complete if reference exists
    }
    if (appointment.paymentMethod === "Cash" && appointment.status !== "Cancelled") {
      return "Pending Payment";
    }

    return "Pending Payment";
  };


  useEffect(() => {
    const checkAdminAccess = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        router.push("/userdashboard");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userRole = userData.role || "client";

          // Only allow admin and doctor roles
          if (userRole !== "admin" && userRole !== "doctor") {
            console.log("Unauthorized access attempt. Redirecting...");
            router.push("/userdashboard"); // Redirect regular users to user dashboard
            return;
          }


          console.log("✅ Admin access granted for:", userRole);
        } else {
          // User document doesn't exist, redirect to login
          router.push("/homepage");
        }
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/userdashboard");
      }
    };

    checkAdminAccess();
  }, [router]);


  // 2FA Initialization
  useEffect(() => {
    const initialize2FAState = async () => {
      setIsMounted(true);

      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          console.log("🔄 Initializing 2FA state for user:", currentUser.email);

          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as UserRole;
            const is2FAEnabled = userData.twoFactorEnabled || false;

            console.log("📋 Firestore 2FA status:", is2FAEnabled);
            setTwoFactorEnabled(is2FAEnabled);
            localStorage.setItem('twoFactorEnabled', is2FAEnabled.toString());
          } else {
            const saved2FA = localStorage.getItem('twoFactorEnabled');
            console.log("💾 LocalStorage 2FA status:", saved2FA);
            if (saved2FA === 'true') {
              setTwoFactorEnabled(true);
            } else {
              setTwoFactorEnabled(false);
              localStorage.setItem('twoFactorEnabled', 'false');
            }
          }

          if (currentUser.email) {
            setOtpEmail(currentUser.email);
          }
        } catch (error) {
          console.error("❌ Error fetching user data:", error);
          const saved2FA = localStorage.getItem('twoFactorEnabled');
          console.log("🔄 Error fallback to localStorage:", saved2FA);
          if (saved2FA === 'true') {
            setTwoFactorEnabled(true);
          } else {
            setTwoFactorEnabled(false);
            localStorage.setItem('twoFactorEnabled', 'false');
          }
        }
      }
    };
    initialize2FAState();
  }, []);

  // Real-time 2FA Status Listener
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    console.log("👂 Setting up real-time 2FA listener");

    const userDocRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data() as UserRole;
        const is2FAEnabled = userData.twoFactorEnabled || false;

        console.log("🔄 Real-time 2FA update:", is2FAEnabled);
        setTwoFactorEnabled(is2FAEnabled);
        localStorage.setItem('twoFactorEnabled', is2FAEnabled.toString());
      }
    });
    return () => {
      console.log("🔇 Cleaning up 2FA listener");
      unsubscribe();
    };
  }, []);


  // Enhanced Disable 2FA Function
  const handleDisable2FA = async () => {
    if (!confirm("Are you sure you want to disable Two-Factor Authentication?\n\nThis will make your account less secure.")) {
      return;
    }
    setTwoFALoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("User not authenticated");
        return;
      }
      console.log("🔓 Disabling 2FA for user:", currentUser.email);
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        twoFactorEnabled: false,
        twoFactorDisabledAt: new Date().toISOString()
      });
      const updatedDoc = await getDoc(userDocRef);
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data() as UserRole;
        const final2FAStatus = updatedData.twoFactorEnabled || false;

        console.log("✅ Firestore confirmation - 2FA status:", final2FAStatus);
        setTwoFactorEnabled(final2FAStatus);
        localStorage.setItem('twoFactorEnabled', final2FAStatus.toString());
      }
      setTimeout(() => {
        setTwoFactorEnabled(false);
        localStorage.setItem('twoFactorEnabled', 'false');
      }, 100);

      // Show better success message for disable
      setTimeout(() => {
        alert("🔓 Two-Factor Authentication has been disabled.\n\nFor your account's security, we recommend re-enabling it soon.");
      }, 300);
    } catch (error) {
      console.error("❌ Error disabling 2FA:", error);
      alert("❌ Failed to disable 2FA. Please try again.");
    } finally {
      setTwoFALoading(false);
    }
  }
  const resetOTPSetup = () => {
    // Clean up OTP session
    if (otpEmail) {
      localStorage.removeItem(`otpHash_${otpEmail}`);
      localStorage.removeItem(`lastOTPSent_${otpEmail}`);
    }

    setOtpSent(false);
    setVerificationCode("");
    setTwoFALoading(false);
    setIsSendingOTP(false);
  };

  const fetchRefundRequests = () => {
    const refundQuery = query(collection(db, "refundRequests"));
    const unsubscribe = onSnapshot(refundQuery, (snapshot) => {
      const data: RefundRequestType[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();

        console.log("📄 Refund document data:", {
          id: doc.id,
          gcashPhoneNumber: docData.gcashPhoneNumber,
          gcashReferenceNo: docData.gcashReferenceNo,
          fullData: docData
        });

        data.push({
          id: doc.id,
          appointmentId: docData.appointmentId || "",
          clientName: docData.clientName || "",
          clientEmail: docData.clientEmail || "",
          petName: docData.petName || "",
          appointmentType: docData.appointmentType || "",
          originalDate: docData.originalDate || "",
          originalTime: docData.originalTime || "",
          amount: docData.amount || 0,
          paymentMethod: docData.paymentMethod || "",
          refundReason: docData.refundReason || "",
          status: docData.status || "pending",
          requestedAt: docData.requestedAt || "",
          userId: docData.userId || "",
          processedAt: docData.processedAt,
          processedBy: docData.processedBy,
          adminNotes: docData.adminNotes,
          paymongoPaymentId: docData.paymongoPaymentId,
          paymongoRefundId: docData.paymongoRefundId,
          paymongoRefundStatus: docData.paymongoRefundStatus,
          paymongoRefundError: docData.paymongoRefundError,
          gcashReferenceNo: docData.gcashReferenceNo || "",
          gcashPhoneNumber: docData.gcashPhoneNumber || ""
        });
      });

      data.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

      console.log("📊 Processed refund requests:", data.map(r => ({
        id: r.id,
        phone: r.gcashPhoneNumber,
        ref: r.gcashReferenceNo
      })));

      setRefundRequests(data);

      const pendingCount = data.filter(req => req.status === "pending").length;
      setPendingRefundCount(pendingCount);
    });

    return unsubscribe;
  };

  // Function to mark refund as completed
  const markRefundAsCompleted = async (refundId: string) => {
    try {
      const refundRef = doc(db, "refundRequests", refundId);
      await updateDoc(refundRef, {
        status: "completed",
        processedAt: new Date().toISOString(),
        paymongoRefundStatus: "succeeded"
      });

      console.log('✅ Refund marked as completed:', refundId);
      return true;
    } catch (error) {
      console.error('❌ Error marking refund as completed:', error);
      alert("❌ Failed to mark refund as completed.");
      return false;
    }
  };

  // Enhanced refund action handler with modal confirmation
  const handleRefundAction = async (refund: RefundRequestType) => {
    if (refund.status === "pending") {
      // For pending refunds, move to processing
      try {
        const refundRef = doc(db, "refundRequests", refund.id);
        await updateDoc(refundRef, {
          status: "processing",
          processedAt: new Date().toISOString(),
          processedBy: auth.currentUser?.email || "admin"
        });
        alert(`Refund moved to processing for ${refund.clientName}`);
        fetchRefundRequests();
      } catch (error) {
        console.error('Error updating refund status:', error);
        alert("Failed to update refund status.");
      }
    } else if (refund.status === "processing") {
      openCompleteRefundModal(refund);
    } else if (refund.status === "completed") {
      alert(`✅ Refund completed successfully!\n\nClient: ${refund.clientName}\nAmount: ₱${refund.amount}\nStatus: Completed`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      alert("Logout failed: " + (error as Error).message);
    }
  };

  // FIXED: Enhanced fetchAppointments function
  // FIXED: Enhanced fetchAppointments function
// FIXED: Enhanced fetchAppointments function with proper breed handling
const fetchAppointments = useCallback(() => {
  const appointmentsRef = collection(db, "appointments");

  // Real-time listener
  const unsubscribe = onSnapshot(appointmentsRef, (snapshot) => {
    const data: AppointmentType[] = [];
    snapshot.forEach((doc) => {
      const docData = doc.data();
      
      // ✅ FIXED: Handle breed data properly - check both breed and petBreed fields
      const breed = docData.breed || docData.petBreed || "Not specified";
      
      data.push({
        id: doc.id,
        clientName: docData.clientName || "",
        petName: docData.petName || "",
        birthday: docData.birthday || "",
        color: docData.color || "",
        petType: docData.petType || "",
        petBreed: breed, // ✅ Use the properly extracted breed
        breed: breed,    // ✅ Also set the breed field for consistency
        gender: docData.gender || "",
        date: docData.date || "",
        timeSlot: docData.timeSlot || "",
        status: docData.status || "Pending",
        bookedByAdmin: docData.bookedByAdmin || false,
        createdAt: docData.createdAt || "",
        serviceType: docData.appointmentType || docData.serviceType || "Check Up",
        paymentMethod: docData.paymentMethod || "Cash",
        paymentStatus: docData.paymentStatus || "Pending Payment",
        referenceNumber: docData.referenceNumber || "",
        verifiedBy: docData.verifiedBy,
        verifiedAt: docData.verifiedAt
      });
    });

    // Sort appointments by date
    const sortedData = data.sort((a, b) => a.date.localeCompare(b.date));
    setAppointments(sortedData);

    // Today's date filtering
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    const todayAppts = sortedData.filter((appt) => {
      if (!appt.date) return false;

      let appointmentDateString = appt.date;

      // Handle different date formats
      if (appt.date.includes('T')) {
        try {
          const appointmentDate = new Date(appt.date);
          appointmentDateString = appointmentDate.toISOString().split("T")[0];
        } catch (error) {
          console.error("Error parsing timestamp date:", appt.date, error);
          return false;
        }
      }

      if (appt.date.includes('/')) {
        try {
          const parts = appt.date.split('/');
          if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            appointmentDateString = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error("Error parsing slash date:", appt.date, error);
          return false;
        }
      }

      return appointmentDateString === todayString;
    });

    setTodaysAppointments(todayAppts);
  }, (error) => {
    console.error("Error fetching appointments:", error);
  });

  return unsubscribe;
}, []);

const fetchUnavailableSlots = async () => {
  try {
    const snapshot = await getDocs(collection(db, "unavailableSlots"));
    const data: UnavailableSlot[] = [];
    snapshot.forEach((doc) => {
      const docData = doc.data();
      
      console.log("📅 Unavailable slot data:", {
        id: doc.id,
        rawData: docData,
        startDate: docData.startDate,
        date: docData.date,
        endDate: docData.endDate,
        isMultipleDays: docData.isMultipleDays,
        leaveDays: docData.leaveDays
      });
      
      // For multiple day leaves, we need to expand the date range
      if (docData.isMultipleDays && docData.leaveDays > 1 && docData.startDate && docData.endDate) {
        const startDate = new Date(docData.startDate);
        const endDate = new Date(docData.endDate);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        console.log(`🔄 Multiple day leave: ${daysDiff} days from ${docData.startDate} to ${docData.endDate}`);
        
        // Create individual day entries for the entire range
        for (let i = 0; i < daysDiff; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateString = currentDate.toISOString().split('T')[0];
          
          data.push({
            id: `${doc.id}_${i}`, // Unique ID for each day
            date: dateString,
            veterinarian: docData.veterinarian || "",
            isAllDay: docData.isAllDay || true,
            startTime: docData.startTime || "",
            endTime: docData.endTime || "",
            reason: docData.reason || "",
            leaveDays: docData.leaveDays || 1,
            endDate: docData.endDate || "",
            isMultipleDays: true,
            originalId: doc.id, // Keep reference to original document
            dayIndex: i, // Track which day in the sequence
            startDate: docData.startDate, // Keep original start date
            createdAt: docData.createdAt // Keep creation date
          });
        }
      } else {
        // Single day entry
        const dateValue = docData.startDate || docData.date || "";
        data.push({
          id: doc.id,
          date: dateValue,
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || "",
          reason: docData.reason || "",
          leaveDays: docData.leaveDays || 1,
          endDate: docData.endDate || "",
          isMultipleDays: docData.isMultipleDays || false,
          startDate: docData.startDate,
          createdAt: docData.createdAt
        });
      }
    });
    
    console.log("✅ Total unavailable slots after processing:", data.length);
    setUnavailableSlots(data.sort((a, b) => a.date.localeCompare(b.date)));
  } catch (error) {
    console.error("Error fetching unavailable slots:", error);
  }
};


  const fetchClients = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const data: ClientType[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({ id: doc.id, email: docData.email || "", name: docData.name || "" });
      });
      setClients(data);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchPetsData = async (): Promise<PetType[]> => {
    try {
      const petsSnapshot = await getDocs(collection(db, "pets"));
      const petsData: PetType[] = [];

      petsSnapshot.forEach((doc) => {
        const petData = doc.data();
        petsData.push({
          id: doc.id,
          petType: petData.petType,
          petName: petData.petName,
          breed: petData.breed,
          gender: petData.gender,
          color: petData.color,
          birthday: petData.birthday,
          userId: petData.userId
        });
      });

      console.log("📊 Fetched pets data:", petsData.length, "pets");
      return petsData;
    } catch (error) {
      console.error("❌ Error fetching pets data:", error);
      return [];
    }
  };

  // Moved calculateStats inside component with useCallback
  const calculateStats = useCallback(async (appointmentsData: AppointmentType[]) => {
    const stats: { [key: string]: { dogs: number; cats: number } } = {};
    services.forEach(service => {
      stats[service] = { dogs: 0, cats: 0 };
    });
    try {
      const petsData = await fetchPetsData();
      const petTypeMap: { [key: string]: string } = {};
      petsData.forEach(pet => {
        if (pet.id && pet.petType) {
          petTypeMap[pet.id] = pet.petType.toLowerCase();
        }
      });
      appointmentsData.forEach(appointment => {
        const service = appointment.serviceType?.toLowerCase() || "checkup";
        let petType = "";

        if (appointment.petType) {
          petType = appointment.petType.toLowerCase();
        }
        else if (appointment.petId && petTypeMap[appointment.petId]) {
          petType = petTypeMap[appointment.petId];
        }
        else if (appointment.petName) {
          const matchedPet = petsData.find(pet =>
            pet.petName?.toLowerCase() === appointment.petName?.toLowerCase()
          );
          if (matchedPet?.petType) {
            petType = matchedPet.petType.toLowerCase();
          }
        }
        if (stats[service]) {
          if (petType === "dog") {
            stats[service].dogs++;
          } else if (petType === "cat") {
            stats[service].cats++;
          } else {
            if (appointment.petName) {
              const petNameLower = appointment.petName.toLowerCase();
              if (petNameLower.includes('dog') || petNameLower.includes('puppy') ||
                appointment.petName.match(/^[A-Z][a-z]+$/)) {
                stats[service].dogs++;
              } else if (petNameLower.includes('cat') || petNameLower.includes('kitten') ||
                petNameLower.includes('pusa') || petNameLower.includes('ming')) {
                stats[service].cats++;
              } else {
                stats[service].dogs++;
              }
            } else {
              stats[service].dogs++;
            }
          }
        }
      });
    } catch (error) {
      console.error("❌ Error in calculateStats:", error);
      appointmentsData.forEach(appointment => {
        const service = appointment.serviceType?.toLowerCase() || "checkup";
        if (stats[service]) {
          stats[service].dogs++;
        }
      });
    }
    const serviceStatsArray: ServiceStats[] = services.map(service => {
      const serviceLabel = serviceLabels[service as keyof typeof serviceLabels] || service;
      return {
        service: serviceLabel,
        dogs: stats[service]?.dogs || 0,
        cats: stats[service]?.cats || 0
      };
    });
    setServiceStats(serviceStatsArray);
    const totalDogs = serviceStatsArray.reduce((sum, item) => sum + item.dogs, 0);
    const totalCats = serviceStatsArray.reduce((sum, item) => sum + item.cats, 0);
    const totalAppointments = totalDogs + totalCats;
    setTotalStats({ totalDogs, totalCats, totalAppointments });
  }, [services, serviceLabels]);

  // Moved calculateVaccinationTrends inside component with useCallback
  const calculateVaccinationTrends = useCallback(async (appointmentsData: AppointmentType[]) => {
    setIsTrendsLoading(true);
    try {
      const petsData = await fetchPetsData();
      const petTypeMap: { [key: string]: string } = {};
      petsData.forEach(pet => {
        if (pet.id && pet.petType) {
          petTypeMap[pet.id] = pet.petType.toLowerCase();
        }
      });
      const monthlyVaccinations: { [key: string]: { dogs: number; cats: number } } = {};

      appointmentsData.forEach(appointment => {
        const service = appointment.serviceType?.toLowerCase() || "checkup";
        if (service !== "vaccination") return;
        const appointmentDate = new Date(appointment.date);
        const monthKey = `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyVaccinations[monthKey]) {
          monthlyVaccinations[monthKey] = { dogs: 0, cats: 0 };
        }
        let petType = "";

        if (appointment.petType) {
          petType = appointment.petType.toLowerCase();
        }
        else if (appointment.petId && petTypeMap[appointment.petId]) {
          petType = petTypeMap[appointment.petId];
        }
        else if (appointment.petName) {
          const matchedPet = petsData.find(pet =>
            pet.petName?.toLowerCase() === appointment.petName?.toLowerCase()
          );
          if (matchedPet?.petType) {
            petType = matchedPet.petType.toLowerCase();
          }
        }
        if (petType === "dog") {
          monthlyVaccinations[monthKey].dogs++;
        } else if (petType === "cat") {
          monthlyVaccinations[monthKey].cats++;
        } else {
          if (appointment.petName) {
            const petNameLower = appointment.petName.toLowerCase();
            if (petNameLower.includes('dog') || petNameLower.includes('puppy') ||
              appointment.petName.match(/^[A-Z][a-z]+$/)) {
              monthlyVaccinations[monthKey].dogs++;
            } else if (petNameLower.includes('cat') || petNameLower.includes('kitten') ||
              petNameLower.includes('pusa') || petNameLower.includes('ming')) {
              monthlyVaccinations[monthKey].cats++;
            } else {
              monthlyVaccinations[monthKey].dogs++;
            }
          } else {
            monthlyVaccinations[monthKey].dogs++;
          }
        }
      });
      const monthlyData = Object.entries(monthlyVaccinations)
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split('-');
          const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          });

          return {
            monthKey,
            month: monthName,
            dogs: data.dogs,
            cats: data.cats,
            total: data.dogs + data.cats
          };
        })
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      const trends: VaccinationTrend[] = monthlyData.map((current, index) => {
        if (index === 0) {
          return {
            ...current,
            trend: "stable",
            percentageChange: 0
          };
        }
        const previous = monthlyData[index - 1];
        const percentageChange = previous.total > 0
          ? ((current.total - previous.total) / previous.total) * 100
          : current.total > 0 ? 100 : 0;
        let trend: "increased" | "decreased" | "stable";
        if (percentageChange > 10) {
          trend = "increased";
        } else if (percentageChange < -10) {
          trend = "decreased";
        } else {
          trend = "stable";
        }
        return {
          ...current,
          trend,
          percentageChange
        };
      });
      setVaccinationTrends(trends);
    } catch (error) {
      console.error("❌ Error calculating vaccination trends:", error);
    } finally {
      setIsTrendsLoading(false);
    }
  }, []);

  // Fixed fetchStatsAppointments with proper dependencies
  const fetchStatsAppointments = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const appointmentsCollection = collection(db, "appointments");
      const snapshot = await getDocs(appointmentsCollection);
      const data: AppointmentType[] = [];

      snapshot.forEach(doc => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          clientName: docData.clientName || "",
          petName: docData.petName || "",
          petType: docData.petType || "",
          serviceType: docData.appointmentType || docData.serviceType || "checkup",
          date: docData.date || "",
          timeSlot: docData.timeSlot || "",
          status: docData.status || "Pending",
          petId: docData.petId || "",
          paymentMethod: docData.paymentMethod || "Cash",
          paymentStatus: docData.paymentStatus || "Pending Payment",
          referenceNumber: docData.referenceNumber || ""
        });
      });
      let filteredData = data;
      if (statsSelectedMonth || statsSelectedYear) {
        filteredData = data.filter(appt => {
          if (!appt.date) return false;

          const appointmentDate = new Date(appt.date);
          const monthMatch = !statsSelectedMonth || appointmentDate.getMonth() === months.indexOf(statsSelectedMonth);
          const yearMatch = !statsSelectedYear || appointmentDate.getFullYear().toString() === statsSelectedYear;
          return monthMatch && yearMatch;
        });
      }
      await calculateStats(filteredData);
      await calculateVaccinationTrends(filteredData);
    } catch (error) {
      console.error("❌ Error fetching appointments for stats:", error);
    } finally {
      setIsStatsLoading(false);
    }
  }, [
    statsSelectedMonth,
    statsSelectedYear,
    months,
    calculateStats,
    calculateVaccinationTrends
  ]);

  // Fixed useEffect with proper dependencies
  useEffect(() => {
    // Setup real-time listeners
    const unsubscribeAppointments = fetchAppointments();
    fetchClients();
    fetchUnavailableSlots(); // ← This should work
    fetchStatsAppointments();
    fetchUsers();
    const unsubscribeRefunds = fetchRefundRequests();

    // ADD THIS: Real-time listener for unavailable slots
    const unsubscribeSlots = onSnapshot(collection(db, "unavailableSlots"), (snapshot) => {
      console.log("📊 Unavailable slots snapshot received:", snapshot.size);
      const data: UnavailableSlot[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        console.log("📅 Slot data:", docData); // ← Add this
        data.push({
          id: doc.id,
          date: docData.date || "",
          veterinarian: docData.veterinarian || "",
          isAllDay: docData.isAllDay || true,
          startTime: docData.startTime || "",
          endTime: docData.endTime || "",
          reason: docData.reason || "", // ← Make sure this is included
          leaveDays: docData.leaveDays || 1, // ← Make sure this is included
          endDate: docData.endDate || "", // ← Make sure this is included
          isMultipleDays: docData.isMultipleDays || false // ← Make sure this is included
        });
      });
      console.log("✅ Total unavailable slots:", data.length)
      setUnavailableSlots(data.sort((a, b) => a.date.localeCompare(b.date)));
    });

    // Cleanup all listeners
    return () => {
      unsubscribeAppointments();
      unsubscribeSlots(); // ← Make sure this is called
      unsubscribeRefunds();
    };
  }, [fetchStatsAppointments, fetchAppointments]);
  // Fixed useEffect for dashboard view
  useEffect(() => {
    if (viewMode === "dashboard") {
      fetchStatsAppointments();
    }
  }, [statsSelectedMonth, statsSelectedYear, viewMode, fetchStatsAppointments]);

  const handleBookAppointment = async () => {

    if (!selectedClient || !petName.trim() || !appointmentDate || !appointmentTime) {
      alert("Please fill all required fields.");
      return;
    }
    const isDateUnavailable = unavailableSlots.some((slot) => slot.date === appointmentDate);
    if (isDateUnavailable) {
      alert("Cannot book appointment on this date. A doctor has marked this date as unavailable.");
      return;
    }
    setIsLoading(true);
    try {
      const isTaken = appointments.some(
        (appt) => appt.date === appointmentDate && appt.timeSlot === appointmentTime && appt.status !== "Cancelled",
      );
      if (isTaken) {
        alert("This time slot is already taken.");
        return;
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
        userId: auth.currentUser?.uid,
        bookedBy: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        paymentMethod: "Cash",
        paymentStatus: "Pending Payment",
        serviceType: serviceType,
        createdAt: new Date().toISOString(),
      });
      alert("Appointment booked successfully!");
      setShowBookingModal(false);
      resetForm();
      fetchAppointments();
      fetchStatsAppointments();
    } catch (error) {
      console.error("Error booking appointment:", error);
      alert("Failed to book appointment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const openStatusModal = (id: string, currentStatus: string) => {
    console.log('Opening status modal for:', id, 'current status:', currentStatus);
    setStatusItemId(id);

    if (currentStatus === "Confirmed") {
      setNewStatus("Cancelled");
    } else if (currentStatus === "Pending") {
      setNewStatus("Confirmed");
    } else {
      setNewStatus("Pending");
    }

    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setStatusItemId("");
    setNewStatus("");
  };

  const handleStatusConfirm = async () => {
    if (!statusItemId || !newStatus) return;

    try {
      const appointmentRef = doc(db, "appointments", statusItemId);
      await updateDoc(appointmentRef, {
        status: newStatus,
        ...(newStatus === "Cancelled" && {
          paymentStatus: "Failed",
          cancelledAt: new Date().toISOString(),
          cancelledBy: auth.currentUser?.email || "admin"
        }),
        ...(newStatus === "Confirmed" && {
          paymentStatus: "Pending Payment"
        })
      });

      alert(`Appointment status updated to ${newStatus}!`);
      fetchAppointments();
      fetchStatsAppointments();
      closeStatusModal();
    } catch (error) {
      console.error("Error updating appointment status:", error);
      alert("Failed to update appointment status. Please try again.");
    }
  };

  const openMedicalRecordsModal = (appointment: AppointmentType) => {
    setMedicalRecordAppointment(appointment);
    setShowMedicalRecordsModal(true);
  };

  const closeMedicalRecordsModal = () => {
    setShowMedicalRecordsModal(false);
    setMedicalRecordAppointment(null);
  };

  const handleMoveToMedicalRecords = async () => {
    if (!medicalRecordAppointment) return;

    try {
      const appointmentRef = doc(db, "appointments", medicalRecordAppointment.id);
      await updateDoc(appointmentRef, {
        status: "Done",
        paymentStatus: "Complete Payment",
        completedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "medicalRecords"), {
        clientName: medicalRecordAppointment.clientName,
        petName: medicalRecordAppointment.petName,
        petType: medicalRecordAppointment.petType,
        petBreed: medicalRecordAppointment.petBreed,
        gender: medicalRecordAppointment.gender,
        appointmentDate: medicalRecordAppointment.date,
        appointmentTime: medicalRecordAppointment.timeSlot,
        serviceType: medicalRecordAppointment.serviceType || "Check Up",
        status: "Done",
        paymentStatus: "Complete Payment",
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        originalAppointmentId: medicalRecordAppointment.id,
      });
      alert("Appointment marked as done and payment completed!");

      fetchAppointments();
      fetchStatsAppointments();
      closeMedicalRecordsModal();
    } catch (error) {
      console.error("Error moving to medical records:", error);
      alert("Failed to update medical records. Please try again.");
    }
  };

  const openAppointmentDetails = (appointment: AppointmentType) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  const closeAppointmentDetails = () => {
    setShowAppointmentDetails(false);
    setSelectedAppointment(null);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountEmail || !newAccountPassword || !newAccountName) {
      setCreateAccountMessage("Please fill all required fields.");
      return;
    }
    if (newAccountPassword.length < 6) {
      setCreateAccountMessage("Password must be at least 6 characters long.");
      return;
    }
    setIsCreatingAccount(true);
    setCreateAccountMessage("");
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newAccountEmail,
        newAccountPassword
      );
      const user = userCredential.user;
      await updateProfile(user, {
        displayName: newAccountName
      });
      const userDocData = {
        name: newAccountName,
        email: newAccountEmail.toLowerCase(),
        role: newAccountRole,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || "admin",
        lastLogin: new Date().toISOString(),
        emailVerified: false,
        status: "active",
        twoFactorEnabled: false
      };
      await setDoc(doc(db, "users", user.uid), userDocData);
      setCreateAccountMessage(`✅ Successfully created ${newAccountRole} account for ${newAccountName}!`);

      setTimeout(() => {
        setNewAccountEmail("");
        setNewAccountPassword("");
        setNewAccountName("");
        setNewAccountRole("doctor");
        setShowCreateAccount(false);
        setCreateAccountMessage("");
      }, 3000);
    } catch (error: unknown) {
      console.error("Error creating account:", error);

      if (isAuthError(error)) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setCreateAccountMessage("This email is already registered. Please use a different email.");
            break;
          case 'auth/invalid-email':
            setCreateAccountMessage("Invalid email address format.");
            break;
          case 'auth/weak-password':
            setCreateAccountMessage("Password is too weak. Please choose a stronger password.");
            break;
          case 'auth/operation-not-allowed':
            setCreateAccountMessage("Email/password accounts are not enabled. Please contact support.");
            break;
          default:
            setCreateAccountMessage(error.message || "Failed to create account. Please try again.");
        }
      } else {
        setCreateAccountMessage("Failed to create account. Please try again.");
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const resetForm = () => {
    setSelectedClient("");
    setClientPets([]);
    setSelectedPet("");
    resetPetForm();
    setAppointmentDate("");
    setAppointmentTime("");
    setServiceType("Check Up");
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case "Confirmed":
        return "#28a745";
      case "Cancelled":
        return "#dc3545";
      case "Done":
        return "#007bff";
      case "Pet Registered":
        return "#17a2b8";
      case "Booked by Admin":
        return "#17a2b8";
      default:
        return "#ffc107";
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredAppointments = selectedMonth
    ? appointments.filter((appt) => {
      const date = new Date(appt.date);
      return date.getMonth() === months.indexOf(selectedMonth);
    })
    : appointments;

  const filteredUnavailableSlots = selectedMonth
    ? unavailableSlots.filter((slot) => {
      const date = new Date(slot.date);
      return date.getMonth() === months.indexOf(selectedMonth);
    })
    : unavailableSlots;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleStatsRefresh = () => {
    fetchStatsAppointments();
  };

  const handleStatsClearFilters = () => {
    setStatsSelectedMonth("");
    setStatsSelectedYear("");
  };

  // Enhanced Two-Factor Authentication Section
  const TwoFASection = () => (
    <SettingsSection>
      <SettingsSectionTitle>Two-Factor Authentication (2FA)</SettingsSectionTitle>
      <SettingsSectionDesc>
        Add an extra layer of security to your account by enabling two-factor authentication via OTP.
      </SettingsSectionDesc>

      <TwoFactorCard>
        <TwoFactorStatus>
          <StatusIndicator $enabled={twoFactorEnabled} />
          <StatusText>
            {twoFactorEnabled ? "🔒 2FA is ENABLED - Your account is secure" : "🔓 2FA is DISABLED - Enable for better security"}
          </StatusText>
        </TwoFactorStatus>

        <TwoFactorActions>
          {!twoFactorEnabled && (
            <EnableButton
              onClick={() => setShow2FAModal(true)}
              disabled={twoFALoading}
            >
              {twoFALoading ? "⏳ Processing..." : "🔒 Enable Two-Factor Authentication"}
            </EnableButton>
          )}

          {twoFactorEnabled && (
            <DisableButton
              onClick={handleDisable2FA}
              disabled={twoFALoading}
            >
              {twoFALoading ? "⏳ Processing..." : "🔓 Disable Two-Factor Authentication"}
            </DisableButton>
          )}
        </TwoFactorActions>

        {twoFALoading && (
          <LoadingContainer>
            <LoadingSpinner />
            <LoadingText>Processing 2FA request...</LoadingText>
          </LoadingContainer>
        )}
      </TwoFactorCard>

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <AsanaModalOverlay onClick={() => setShow2FAModal(false)}>
          <AsanaModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <AsanaModalHeader>
              <AsanaModalIcon>{otpSent ? "📧" : "🔒"}</AsanaModalIcon>
              <AsanaModalTitle>
                {otpSent ? "Enter Verification Code" : "Set Up Two-Factor Authentication"}
              </AsanaModalTitle>
              <AsanaCloseButton
                onClick={() => {
                  setShow2FAModal(false);
                  resetOTPSetup();
                }}
                disabled={twoFALoading}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </AsanaCloseButton>
            </AsanaModalHeader>

            <AsanaModalBody>
              <form onSubmit={(e) => e.preventDefault()}>
                {!otpSent ? (
                  <>
                    <AsanaModalDescription>
                      Enter your email address to receive a 6-digit verification code.
                      This will enable two-factor authentication for your account.
                    </AsanaModalDescription>

                    <FormGroup>
                      <Label htmlFor="modalOtpEmail">Email Address *</Label>
                      <EmailInput
                        type="email"
                        id="modalOtpEmail"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleEnable2FA();
                          }
                        }}
                        placeholder="Enter your email address"
                        disabled={isSendingOTP}
                        style={{ width: '100%', marginBottom: '1rem' }}
                      />
                    </FormGroup>

                    {isSendingOTP && (
                      <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <LoadingSpinner />
                        <LoadingText>Sending verification code...</LoadingText>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <AsanaModalDescription>
                      We&apos;ve sent a 6-digit verification code to <strong>{otpEmail}</strong>.
                      Please enter it below to enable 2FA. The code will expire in 10 minutes.
                    </AsanaModalDescription>

                    <FormGroup>
                      <Label htmlFor="modalVerificationCode">Enter 6-digit OTP *</Label>
                      <OTPInput
                        type="text"
                        id="modalVerificationCode"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setVerificationCode(value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (verificationCode.length === 6) {
                              handleVerifyOTP();
                            }
                          }
                        }}
                        placeholder="000000"
                        disabled={twoFALoading}
                        style={{
                          width: '100%',
                          marginBottom: '0.5rem',
                          fontSize: '1.25rem',
                          fontWeight: 'bold',
                          letterSpacing: '0.5rem',
                          textAlign: 'center'
                        }}
                        autoFocus
                      />
                      <ResendOTPText>
                        Didn&apos;t receive the code?{" "}
                        <ResendLink
                          onClick={handleEnable2FA}
                          disabled={isSendingOTP}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {isSendingOTP ? "⏳ Sending..." : "🔄 Resend OTP"}
                        </ResendLink>
                      </ResendOTPText>
                    </FormGroup>

                    {twoFALoading && (
                      <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <LoadingSpinner />
                        <LoadingText>Verifying code...</LoadingText>
                      </div>
                    )}
                  </>
                )}
              </form>

              <AsanaWarningBox>
                <AsanaWarningIcon>💡</AsanaWarningIcon>
                <AsanaWarningText>
                  {!otpSent
                    ? "For security reasons, please check your spam folder if you don't see the email in your inbox."
                    : "Make sure to enter the code exactly as shown in the email. Codes are case-sensitive."
                  }
                </AsanaWarningText>
              </AsanaWarningBox>
            </AsanaModalBody>
            <AsanaModalFooter>
              <AsanaCancelButton
                onClick={() => {
                  setShow2FAModal(false);
                  resetOTPSetup();
                }}
                disabled={twoFALoading || isSendingOTP}
              >
                Cancel
              </AsanaCancelButton>

              {!otpSent ? (
                <AsanaConfirmButton
                  onClick={handleEnable2FA}
                  disabled={isSendingOTP || !otpEmail}
                >
                  {isSendingOTP ? (
                    <>
                      <AsanaSpinner />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '8px' }}>
                        <path d="M2 2.66667H14C14.3536 2.66667 14.6928 2.80714 14.9428 3.05719C15.1929 3.30724 15.3333 3.64638 15.3333 4V12C15.3333 12.3536 15.1929 12.6928 14.9428 12.9428C14.6928 13.1929 14.3536 13.3333 14 13.3333H2C1.64638 13.3333 1.30724 13.1929 1.05719 12.9428C0.807143 12.6928 0.666667 12.3536 0.666667 12V4C0.666667 3.64638 0.807143 3.30724 1.05719 3.05719C1.30724 2.80714 1.64638 2.66667 2 2.66667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15.3333 4L8 8.66667L0.666667 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Send Verification Code
                    </>
                  )}
                </AsanaConfirmButton>
              ) : (
                <AsanaConfirmButton
                  onClick={handleVerifyOTP}
                  disabled={verificationCode.length !== 6 || twoFALoading}
                >
                  {twoFALoading ? (
                    <>
                      <AsanaSpinner />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '8px' }}>
                        <path d="M13.3334 4L6.00008 11.3333L2.66675 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Verify & Enable 2FA
                    </>
                  )}
                </AsanaConfirmButton>
              )}
            </AsanaModalFooter>
          </AsanaModalContent>
        </AsanaModalOverlay>
      )}
    </SettingsSection>
  );
  // Processing Refund Card Component with Modal
  const ProcessingRefundCard = ({ refund, index }: { refund: RefundRequestType; index: number }) => (
    <RefundCard key={refund.id} $delay={index * 0.1} $status={refund.status}>
      <RefundHeader>
        <RefundClient>{refund.clientName}</RefundClient>
        <RefundStatus $status={refund.status} style={{ background: '#fd7e14' }}>
          PROCESSING
        </RefundStatus>
      </RefundHeader>
      <RefundDetails>
        <RefundDetailRow>
          <RefundLabel>Pet:</RefundLabel>
          <RefundValue>{refund.petName}</RefundValue>
        </RefundDetailRow>
        <RefundDetailRow>
          <RefundLabel>Service:</RefundLabel>
          <RefundValue>{refund.appointmentType}</RefundValue>
        </RefundDetailRow>
        <RefundDetailRow>
          <RefundLabel>Amount:</RefundLabel>
          <RefundValue>₱{refund.amount || 0}</RefundValue>
        </RefundDetailRow>
        <RefundDetailRow>
          <RefundLabel>Payment Method:</RefundLabel>
          <RefundValue>{refund.paymentMethod}</RefundValue>
        </RefundDetailRow>
        {refund.paymentMethod === "GCash" && refund.gcashPhoneNumber && (
          <RefundDetailRow>
            <RefundLabel>GCash Phone:</RefundLabel>
            <RefundValue>{refund.gcashPhoneNumber}</RefundValue>
          </RefundDetailRow>
        )}
        <RefundDetailRow>
          <RefundLabel>Started Processing:</RefundLabel>
          <RefundValue>{refund.processedAt ? formatDateTime(refund.processedAt) : "N/A"}</RefundValue>
        </RefundDetailRow>
      </RefundDetails>
      {refund.adminNotes && (
        <RefundReason>
          <RefundLabel>Admin Notes:</RefundLabel>
          <RefundReasonText>{refund.adminNotes}</RefundReasonText>
        </RefundReason>
      )}
      <AppointmentActions>
        <ActionButton
          $variant="success"
          onClick={() => openCompleteRefundModal(refund)}
        >
          ✅ Mark as Completed
        </ActionButton>
      </AppointmentActions>
    </RefundCard>
  );

  // User Management View Component
  const UserManagementView = () => {
    const filteredUsers = users.filter(user => {
      const matchesRole = filterRole === "all" || user.role === filterRole;
      const matches2FA = filter2FA === "all" ||
        (filter2FA === "enabled" && user.twoFactorEnabled) ||
        (filter2FA === "disabled" && !user.twoFactorEnabled);
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesRole && matches2FA && matchesSearch;
    });

    return (
      <AppointmentsSection>
        <DashboardHeader style={{ textAlign: "center" }}>
          <ContentTitle>User Management</ContentTitle>
          <ContentSubtitle>Manage user accounts, 2FA status, and password resets</ContentSubtitle>
        </DashboardHeader>

        <SectionHeader>
          <ControlsContainer>
            <FilterGroup>
              <FilterLabel>Role:</FilterLabel>
              <FilterSelect
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="doctor">Doctors</option>
                <option value="client">Clients</option>
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>2FA Status:</FilterLabel>
              <FilterSelect
                value={filter2FA}
                onChange={(e) => setFilter2FA(e.target.value)}
              >
                <option value="all">All 2FA Status</option>
                <option value="enabled">2FA Enabled</option>
                <option value="disabled">2FA Disabled</option>
              </FilterSelect>
            </FilterGroup>

            <SearchInput
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <RefreshButton onClick={fetchUsers}>
              ⟳ Refresh
            </RefreshButton>
          </ControlsContainer>
        </SectionHeader>

        <UsersSummary>
          <SummaryCard>
            <SummaryNumber>{users.length}</SummaryNumber>
            <SummaryLabel>Total Users</SummaryLabel>
          </SummaryCard>
          <SummaryCard>
            <SummaryNumber>{users.filter(u => u.twoFactorEnabled).length}</SummaryNumber>
            <SummaryLabel>2FA Enabled</SummaryLabel>
          </SummaryCard>
          <SummaryCard>
            <SummaryNumber>{users.filter(u => !u.twoFactorEnabled).length}</SummaryNumber>
            <SummaryLabel>2FA Disabled</SummaryLabel>
          </SummaryCard>
          <SummaryCard>
            <SummaryNumber>{users.filter(u => u.role === "admin").length}</SummaryNumber>
            <SummaryLabel>Admins</SummaryLabel>
          </SummaryCard>
        </UsersSummary>

        {filteredUsers.length === 0 ? (
          <NoAppointments>
            No users found matching your criteria.
          </NoAppointments>
        ) : (
          <UsersTable>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>2FA Status</TableHeaderCell>
                <TableHeaderCell>Last Login</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user, index) => (
                <TableRow key={user.id} $even={index % 2 === 0}>
                  <TableCell>
                    <UserInfo>
                      <UserName>{user.name}</UserName>
                      <UserEmail>{user.email}</UserEmail>
                    </UserInfo>
                  </TableCell>
                  <TableCell>
                    <RoleBadge $role={user.role}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </RoleBadge>
                  </TableCell>
                  <TableCell>
                    <TwoFABadge $enabled={user.twoFactorEnabled}>
                      {user.twoFactorEnabled ? "✅ Enabled" : "❌ Disabled"}
                    </TwoFABadge>
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge $status={user.status}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </StatusBadge>
                  </TableCell>
<TableCell>
                    <UserActions>
                      <ActionButton
                        $variant="primary"
                        onClick={() => handleSendPasswordReset(user)}
                        title="Send Password Reset"
                      >
                        🔑 Reset Password
                      </ActionButton>
                    </UserActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </UsersTable>
        )}

        {/* Password Reset Modal */}
        {showPasswordResetModal && (
          <ModalOverlay onClick={() => setShowPasswordResetModal(false)}>
            <ModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
              <ModalHeader>
                <ModalTitle>Send Password Reset</ModalTitle>
                <CloseButton onClick={() => setShowPasswordResetModal(false)}>×</CloseButton>
              </ModalHeader>

              <DetailsContent>
                <FormGroup>
                  <Label>User Information</Label>
                  <UserInfoCard>
                    <UserDetail>
                      <strong>Name:</strong> {selectedUser?.name}
                    </UserDetail>
                    <UserDetail>
                      <strong>Email:</strong> {selectedUser?.email}
                    </UserDetail>
                    <UserDetail>
                      <strong>Role:</strong> {selectedUser?.role}
                    </UserDetail>
                  </UserInfoCard>
                </FormGroup>

                <FormGroup>
                  <Label htmlFor="resetEmail">Email Address for Password Reset *</Label>
                  <input
                    type="email"
                    id="resetEmail"
                    value={resetPasswordEmail}
                    onChange={(e) => setResetPasswordEmail(e.target.value)}
                    placeholder="Enter email address"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "0.875rem"
                    }}
                    required
                  />
                </FormGroup>

                {passwordResetMessage && (
                  <Message $type={passwordResetMessage.includes("✅") ? "success" : "error"}>
                    {passwordResetMessage}
                  </Message>
                )}

                <AppointmentActions>
                  <ActionButton
                    type="button"
                    $variant="primary"
                    onClick={() => setShowPasswordResetModal(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton
                    type="button"
                    $variant="success"
                    onClick={handleResetPassword}
                    disabled={isSendingReset || !resetPasswordEmail.trim()}
                    style={{ flex: 1 }}
                  >
                    {isSendingReset ? (
                      <>
                        <LoadingSpinnerSmall />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Email"
                    )}
                  </ActionButton>
                </AppointmentActions>
              </DetailsContent>
            </ModalContent>
          </ModalOverlay>
        )}
      </AppointmentsSection>
    );
  };

  if (!isMounted) return null;

  return (
    <>
      <GlobalStyle />
      <PageContainer>
        <HeaderBar>
          <BrandSection>
            <MenuToggle
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              $isOpen={isSidebarOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </MenuToggle>
            <Logo>
              <LogoImage src="/RL.jpg" alt="RL Clinic Logo" />
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
                {todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length > 0 && (
                  <MenuCount>{todaysAppointments.filter(appt => appt.status !== "Done" && appt.status !== "Cancelled").length}</MenuCount>
                )}
              </MenuItem>
              <MenuItem
                $active={viewMode === "all"}
                onClick={() => setViewMode("all")}
              >
                <MenuIcon>📋</MenuIcon>
                <MenuText>Appointment List</MenuText>
                {appointments.filter(appt =>
                  (appt.paymentStatus === "Pending Payment" || appt.paymentStatus === "Complete Payment" || appt.paymentStatus === "Pending Verification") &&
                  appt.status !== "Done" &&
                  appt.status !== "Cancelled"
                ).length > 0 && (
                    <MenuCount>
                      {appointments.filter(appt =>
                        (appt.paymentStatus === "Pending Payment" || appt.paymentStatus === "Complete Payment" || appt.paymentStatus === "Pending Verification") &&
                        appt.status !== "Done" &&
                        appt.status !== "Cancelled"
                      ).length}
                    </MenuCount>
                  )}
              </MenuItem>
              <MenuItem
                $active={viewMode === "refunds"}
                onClick={() => setViewMode("refunds")}
              >
                <MenuIcon>💰</MenuIcon>
                <MenuText>Refund Requests</MenuText>
                {pendingRefundCount > 0 && (
                  <MenuCount>{pendingRefundCount}</MenuCount>
                )}
              </MenuItem>
              <MenuItem
                $active={viewMode === "users"}
                onClick={() => setViewMode("users")}
              >
                <MenuIcon>👥</MenuIcon>
                <MenuText>User Management</MenuText>
                {users.filter(user => !user.twoFactorEnabled).length > 0 && (
                  <MenuCount style={{ backgroundColor: '#ffc107' }}>
                    {users.filter(user => !user.twoFactorEnabled).length}
                  </MenuCount>
                )}
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
              <MenuItem
                $active={viewMode === "settings"}
                onClick={() => setViewMode("settings")}
              >
                <MenuIcon>⚙️</MenuIcon>
                <MenuText>Settings</MenuText>
              </MenuItem>
            </MenuList>
          </Sidebar>
          {!isSidebarOpen && (
            <FloatingMenuButton onClick={() => setIsSidebarOpen(true)}>
              ☰
            </FloatingMenuButton>
          )}
          <ContentArea $sidebarOpen={isSidebarOpen}>
            {viewMode === "dashboard" && (
              <>
                <DashboardHeader>
                  <ContentTitle>Dashboard Overview</ContentTitle>
                  <ContentSubtitle>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ContentSubtitle>
                </DashboardHeader>
                <StatisticsSection>
                  <SectionHeader>
                    <SectionTitle>📊 Monthly Statistics</SectionTitle>
                    <ControlsContainer>
                      <FilterGroup>
                        <FilterLabel>Year:</FilterLabel>
                        <FilterSelect
                          value={statsSelectedYear}
                          onChange={(e) => setStatsSelectedYear(e.target.value)}
                        >
                          <option value="">All Years</option>
                          {years.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </FilterSelect>
                      </FilterGroup>
                      <FilterGroup>
                        <FilterLabel>Month:</FilterLabel>
                        <FilterSelect
                          value={statsSelectedMonth}
                          onChange={(e) => setStatsSelectedMonth(e.target.value)}
                        >
                          <option value="">All Months</option>
                          {months.map((month) => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </FilterSelect>
                      </FilterGroup>
                      <RefreshButton onClick={handleStatsRefresh} disabled={isStatsLoading}>
                        {isStatsLoading ? "Loading..." : "🔄 Refresh"}
                      </RefreshButton>
                      {(statsSelectedMonth || statsSelectedYear) && (
                        <ActiveFilters>
                          <span>Active Filters:</span>
                          {statsSelectedYear && <FilterTag>{statsSelectedYear}</FilterTag>}
                          {statsSelectedMonth && <FilterTag>{statsSelectedMonth}</FilterTag>}
                          <ClearFilters onClick={handleStatsClearFilters}>
                            Clear
                          </ClearFilters>
                        </ActiveFilters>
                      )}
                    </ControlsContainer>
                  </SectionHeader>
                  <StatsGrid>
                    <StatsCard $delay={0.1}>
                      <StatsIcon>🐕</StatsIcon>
                      <StatsTitle>Total Dogs</StatsTitle>
                      <StatsNumber $color="#8884d8">{totalStats.totalDogs}</StatsNumber>
                    </StatsCard>

                    <StatsCard $delay={0.2}>
                      <StatsIcon>🐱</StatsIcon>
                      <StatsTitle>Total Cats</StatsTitle>
                      <StatsNumber $color="#82ca9d">{totalStats.totalCats}</StatsNumber>
                    </StatsCard>

                    <StatsCard $delay={0.3}>
                      <StatsIcon>📅</StatsIcon>
                      <StatsTitle>Total Appointments</StatsTitle>
                      <StatsNumber $color="#34B89C">{totalStats.totalAppointments}</StatsNumber>
                    </StatsCard>
                    <StatsCard $delay={0.4}>
                      <StatsIcon>💰</StatsIcon>
                      <StatsTitle>Pending Refunds</StatsTitle>
                      <StatsNumber $color="#ffc107">{pendingRefundCount}</StatsNumber>
                    </StatsCard>
                  </StatsGrid>
                  <TableCard $delay={0.4}>
                    <ChartTitle>📋 Service Details Summary</ChartTitle>

                    {isStatsLoading ? (
                      <LoadingContainer>
                        <LoadingSpinner />
                        <LoadingText>Loading statistics...</LoadingText>
                      </LoadingContainer>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHeaderCell>Service Type</TableHeaderCell>
                              <TableHeaderCell>🐕 Dogs</TableHeaderCell>
                              <TableHeaderCell>🐱 Cats</TableHeaderCell>
                              <TableHeaderCell>Total</TableHeaderCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {serviceStats.map((item, index) => (
                              <TableRow key={item.service} $even={index % 2 === 0}>
                                <TableCell>{item.service}</TableCell>
                                <TableCell $color="#8884d8">{item.dogs}</TableCell>
                                <TableCell $color="#82ca9d">{item.cats}</TableCell>
                                <TableCell $color="#34B89C" $bold>{item.dogs + item.cats}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </TableCard>
                  <TableCard $delay={0.5}>
                    <SectionHeader>
                      <ChartTitle>📈 Vaccination Trends - Monthly Comparison</ChartTitle>
                      <TrendsInfo>
                        <TrendIndicator $type="increased">
                          <TrendArrow>↗</TrendArrow>
                          Increased ({'>'}10%)
                        </TrendIndicator>
                        <TrendIndicator $type="decreased">
                          <TrendArrow>↘</TrendArrow>
                          Decreased ({'>'}10%)
                        </TrendIndicator>
                        <TrendIndicator $type="stable">
                          <TrendDot>●</TrendDot>
                          Stable (±10%)
                        </TrendIndicator>
                      </TrendsInfo>
                    </SectionHeader>

                    {isTrendsLoading ? (
                      <LoadingContainer>
                        <LoadingSpinner />
                        <LoadingText>Loading vaccination trends...</LoadingText>
                      </LoadingContainer>
                    ) : vaccinationTrends.length === 0 ? (
                      <EmptyState>
                        <EmptyStateIcon>📊</EmptyStateIcon>
                        <EmptyStateText>No vaccination data available for trend analysis</EmptyStateText>
                      </EmptyState>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHeaderCell>Month</TableHeaderCell>
                              <TableHeaderCell>🐕 Dogs</TableHeaderCell>
                              <TableHeaderCell>🐱 Cats</TableHeaderCell>
                              <TableHeaderCell>Total</TableHeaderCell>
                              <TableHeaderCell>Trend</TableHeaderCell>
                              <TableHeaderCell>Change</TableHeaderCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {vaccinationTrends.map((trend, index) => (
                              <TableRow key={trend.monthKey} $even={index % 2 === 0}>
                                <TableCell $bold>{trend.month}</TableCell>
                                <TableCell $color="#8884d8">{trend.dogs}</TableCell>
                                <TableCell $color="#82ca9d">{trend.cats}</TableCell>
                                <TableCell $color="#34B89C" $bold>{trend.total}</TableCell>
                                <TableCell>
                                  <TrendBadge $trend={trend.trend}>
                                    {trend.trend === "increased" && "↗ Increased"}
                                    {trend.trend === "decreased" && "↘ Decreased"}
                                    {trend.trend === "stable" && "● Stable"}
                                  </TrendBadge>
                                </TableCell>
                                <TableCell $color={trend.percentageChange > 0 ? "#28a745" : trend.percentageChange < 0 ? "#dc3545" : "#666"}>
                                  {trend.percentageChange > 0 ? "+" : ""}{trend.percentageChange.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {vaccinationTrends.length > 0 && (
                      <TrendsSummary>
                        <SummaryTitle>Vaccination Summary</SummaryTitle>
                        <SummaryGrid>
                          <SummaryItem>
                            <SummaryLabel>Total Months:</SummaryLabel>
                            <SummaryValue>{vaccinationTrends.length}</SummaryValue>
                          </SummaryItem>
                          <SummaryItem>
                            <SummaryLabel>Months with Growth:</SummaryLabel>
                            <SummaryValue $positive>
                              {vaccinationTrends.filter(t => t.trend === "increased").length}
                            </SummaryValue>
                          </SummaryItem>
                          <SummaryItem>
                            <SummaryLabel>Average Monthly:</SummaryLabel>
                            <SummaryValue>
                              {Math.round(vaccinationTrends.reduce((sum, t) => sum + t.total, 0) / vaccinationTrends.length)}
                            </SummaryValue>
                          </SummaryItem>
                          <SummaryItem>
                            <SummaryLabel>Best Month:</SummaryLabel>
                            <SummaryValue $positive>
                              {vaccinationTrends.reduce((max, t) => t.total > max.total ? t : max, vaccinationTrends[0]).month}
                            </SummaryValue>
                          </SummaryItem>
                        </SummaryGrid>
                      </TrendsSummary>
                    )}
                  </TableCard>
                </StatisticsSection>
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
                  <div style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
                    Showing {todaysAppointments.length} appointments for today
                  </div>
                </DashboardHeader>
                <SectionHeader>
                  <ControlsContainer>
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments();
                        fetchUnavailableSlots();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>

                {todaysAppointments.length === 0 ? (
                  <NoAppointments>
                    No appointments found for today.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {todaysAppointments
                      .map((appt, index) => {
                        const borderColor = statusColor(appt.status);

                        return (
                          <AppointmentCard key={appt.id} $delay={index * 0.1} $borderLeftColor={borderColor}>
                            <AppointmentHeader>
                              <AppointmentDate>{appt.date}</AppointmentDate>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <StatusBadge $status={appt.status} style={{ backgroundColor: borderColor }}>
                                  {appt.status}
                                </StatusBadge>
                                {appt.referenceNumber && (
                                  <ReferenceBadge>
                                    Ref: {appt.referenceNumber}
                                  </ReferenceBadge>
                                )}
                                <PaymentStatusBadge $paymentStatus={getPaymentStatusDisplay(appt)}>
                                  {getPaymentStatusDisplay(appt)}
                                </PaymentStatusBadge>
                              </div>
                            </AppointmentHeader>

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
                              <strong>Type:</strong> {appt.petType || "-"} | <strong>Breed:</strong> {appt.petBreed || "-"}
                            </InfoRow>
                            <InfoRow>
                              <strong>Service:</strong> {appt.serviceType || "Check Up"}
                            </InfoRow>

                            <AppointmentActions>
                              <ActionButton
                                $variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAppointmentDetails(appt);
                                }}
                              >
                                👁 View
                              </ActionButton>

                              {appt.status === "Confirmed" && (
                                <ActionButton
                                  $variant="success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMedicalRecordsModal(appt);
                                  }}
                                >
                                  ✓ Done
                                </ActionButton>
                              )}

                              {appt.status !== "Done" && appt.status !== "Cancelled" && (
                                <ActionButton
                                  $variant="warning"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStatusModal(appt.id, appt.status || "Pending");
                                  }}
                                >
                                  {appt.status === "Confirmed" ? "✕ Cancel" : "✓ Confirm"}
                                </ActionButton>
                              )}
                            </AppointmentActions>
                          </AppointmentCard>
                        );
                      })}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}
            {viewMode === "refunds" && (
              <AppointmentsSection>
                <DashboardHeader style={{ textAlign: "center" }}>
                  <ContentTitle>Refund Requests</ContentTitle>
                  <ContentSubtitle>Manage and process refunds with simplified status flow</ContentSubtitle>
                </DashboardHeader>
                <SectionHeader>
                  <ControlsContainer>
                    <RefreshButton
                      onClick={() => {
                        fetchRefundRequests();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>
                <StatusFlowContainer>
                  <StatusStep $active={true} $completed={refundRequests.some(req => req.status !== "pending")}>
                    <StepNumber $active={refundRequests.some(req => req.status === "pending")} $completed={refundRequests.some(req => req.status !== "pending")}>
                      1
                    </StepNumber>
                    <StepTitle>Pending Request</StepTitle>
                    <StepDescription>User submits refund request</StepDescription>
                  </StatusStep>
                  <StatusStep $active={refundRequests.some(req => req.status === "processing")} $completed={refundRequests.some(req => req.status === "completed")}>
                    <StepNumber $active={refundRequests.some(req => req.status === "processing")} $completed={refundRequests.some(req => req.status === "completed")}>
                      2
                    </StepNumber>
                    <StepTitle>Process Refund</StepTitle>
                    <StepDescription>Admin processes refund</StepDescription>
                  </StatusStep>
                  <StatusStep $active={false} $completed={refundRequests.some(req => req.status === "completed")}>
                    <StepNumber $active={false} $completed={refundRequests.some(req => req.status === "completed")}>
                      3
                    </StepNumber>
                    <StepTitle>Complete Refund</StepTitle>
                    <StepDescription>Refund successfully processed</StepDescription>
                  </StatusStep>
                </StatusFlowContainer>
                <SectionSubtitle style={{ color: '#ffc107', marginTop: '2rem' }}>
                  ⏳ Pending Requests ({refundRequests.filter(req => req.status === "pending").length})
                </SectionSubtitle>

                {refundRequests.filter(req => req.status === "pending").length === 0 ? (
                  <NoAppointments>
                    No pending refund requests.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {refundRequests
                      .filter(req => req.status === "pending")
                      .map((refund, index) => (
                        <RefundCard key={refund.id} $delay={index * 0.1} $status={refund.status}>
                          <RefundHeader>
                            <RefundClient>{refund.clientName}</RefundClient>
                            <RefundStatus $status={refund.status}>
                              {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                            </RefundStatus>
                          </RefundHeader>
                          <RefundDetails>
                            <RefundDetailRow>
                              <RefundLabel>Pet:</RefundLabel>
                              <RefundValue>{refund.petName}</RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Service:</RefundLabel>
                              <RefundValue>{refund.appointmentType}</RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Payment:</RefundLabel>
                              <RefundValue>{refund.paymentMethod}</RefundValue>
                            </RefundDetailRow>

                            {refund.paymentMethod === "GCash" && (
                              <>
                                <RefundDetailRow>
                                  <RefundLabel>GCash Phone:</RefundLabel>
                                  <RefundValue>{refund.gcashPhoneNumber || "Not provided"}</RefundValue>
                                </RefundDetailRow>
                                {refund.gcashReferenceNo && (
                                  <RefundDetailRow>
                                    <RefundLabel>GCash Ref No:</RefundLabel>
                                    <RefundValue>{refund.gcashReferenceNo}</RefundValue>
                                  </RefundDetailRow>
                                )}
                              </>
                            )}

                            <RefundDetailRow>
                              <RefundLabel>Amount:</RefundLabel>
                              <RefundValue>₱{refund.amount || 0}</RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Requested:</RefundLabel>
                              <RefundValue>{formatDateTime(refund.requestedAt)}</RefundValue>
                            </RefundDetailRow>
                          </RefundDetails>

                          <RefundReason>
                            <RefundLabel>Reason:</RefundLabel>
                            <RefundReasonText>{refund.refundReason}</RefundReasonText>
                          </RefundReason>

                          <AppointmentActions>
                            <ActionButton
                              $variant="warning"
                              onClick={() => handleRefundAction(refund)}
                            >
                              Move to Processing
                            </ActionButton>
                          </AppointmentActions>
                        </RefundCard>
                      ))}
                  </AppointmentsGrid>
                )}
                <SectionSubtitle style={{ marginTop: '3rem', color: '#fd7e14' }}>
                  🔄 Processing Refunds ({refundRequests.filter(req => req.status === "processing").length})
                </SectionSubtitle>

                {refundRequests.filter(req => req.status === "processing").length === 0 ? (
                  <NoAppointments>
                    No refunds currently processing.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {refundRequests
                      .filter(req => req.status === "processing")
                      .map((refund, index) => (
                        <ProcessingRefundCard key={refund.id} refund={refund} index={index} />
                      ))}
                  </AppointmentsGrid>
                )}
                <SectionSubtitle style={{ marginTop: '3rem', color: '#28a745' }}>
                  ✅ Completed Refunds ({refundRequests.filter(req => req.status === "completed").length})
                </SectionSubtitle>

                {refundRequests.filter(req => req.status === "completed").length === 0 ? (
                  <NoAppointments>
                    No completed refunds.
                  </NoAppointments>
                ) : (
                  <AppointmentsGrid>
                    {refundRequests
                      .filter(req => req.status === "completed")
                      .map((refund, index) => (
                        <RefundCard key={refund.id} $delay={index * 0.1} $status={refund.status}>
                          <RefundHeader>
                            <RefundClient>{refund.clientName}</RefundClient>
                            <RefundStatus $status={refund.status}>
                              {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                            </RefundStatus>
                          </RefundHeader>

                          <RefundDetails>
                            <RefundDetailRow>
                              <RefundLabel>Pet:</RefundLabel>
                              <RefundValue>{refund.petName}</RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Service:</RefundLabel>
                              <RefundValue>{refund.appointmentType}</RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Amount:</RefundLabel>
                              <RefundValue>₱{refund.amount || 0}</RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Status:</RefundLabel>
                              <RefundValue>
                                <span style={{
                                  color: '#28a745',
                                  fontWeight: 'bold'
                                }}>
                                  COMPLETED
                                </span>
                              </RefundValue>
                            </RefundDetailRow>
                            <RefundDetailRow>
                              <RefundLabel>Completed:</RefundLabel>
                              <RefundValue>{refund.processedAt ? formatDateTime(refund.processedAt) : "N/A"}</RefundValue>
                            </RefundDetailRow>
                          </RefundDetails>
                          <AppointmentActions>
                            <ActionButton
                              $variant="primary"
                              onClick={() => handleRefundAction(refund)}
                            >
                              📋 View Details
                            </ActionButton>
                          </AppointmentActions>
                        </RefundCard>
                      ))}
                  </AppointmentsGrid>
                )}
              </AppointmentsSection>
            )}
            {viewMode === "users" && <UserManagementView />}
            {viewMode === "all" && (
              <AppointmentsSection>
                <SectionHeader>
                  <SectionTitle>All Appointments - Calendar View</SectionTitle>
                  <ControlsContainer>
                    <CalendarNavigation>
                      <NavButton onClick={() => handleDateNavigation('prev')}>←</NavButton>
                      <CurrentDateDisplay>{formatCurrentDate(currentDate)}</CurrentDateDisplay>
                      <NavButton onClick={() => handleDateNavigation('next')}>→</NavButton>
                    </CalendarNavigation>
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
                    <RefreshButton
                      onClick={() => {
                        fetchAppointments();
                        fetchUnavailableSlots();
                      }}
                    >
                      ⟳ Refresh
                    </RefreshButton>
                  </ControlsContainer>
                </SectionHeader>

                {/* Status Summary */}
                <StatusSummary>
                  <StatusSummaryItem>
                    <StatusDot $color="#28a745" />
                    <span>Confirmed: {filteredAppointments.filter(appt => appt.status === "Confirmed").length}</span>
                  </StatusSummaryItem>
                  <StatusSummaryItem>
                    <StatusDot $color="#ffc107" />
                    <span>Pending: {filteredAppointments.filter(appt => appt.status === "Pending").length}</span>
                  </StatusSummaryItem>
                  <StatusSummaryItem>
                    <StatusDot $color="#007bff" />
                    <span>Done: {filteredAppointments.filter(appt => appt.status === "Done").length}</span>
                  </StatusSummaryItem>
                  <StatusSummaryItem>
                    <StatusDot $color="#dc3545" />
                    <span>Cancelled: {filteredAppointments.filter(appt => appt.status === "Cancelled").length}</span>
                  </StatusSummaryItem>
                </StatusSummary>

                {/* Calendar Grid */}
                <CalendarGrid>
                  {getAppointmentsForCurrentDate().length === 0 ? (
                    <NoAppointments>
                      No appointments found for {formatCurrentDate(currentDate)}.
                    </NoAppointments>
                  ) : (
                    <AppointmentsGrid>
                      {getAppointmentsForCurrentDate()
                        .sort((a, b) => {
                          // Sort by time slot
                          const timeA = a.timeSlot.split('–')[0];
                          const timeB = b.timeSlot.split('–')[0];
                          return timeA.localeCompare(timeB);
                        })
                        .map((appointment, index) => {
                          const borderColor = statusColor(appointment.status);
                          return (
                            <AppointmentCard
                              key={appointment.id}
                              $delay={index * 0.1}
                              $borderLeftColor={borderColor}
                            >
                              <AppointmentHeader>
                                <AppointmentTime>{appointment.timeSlot}</AppointmentTime>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  <StatusBadge $status={appointment.status} style={{ backgroundColor: borderColor }}>
                                    {appointment.status}
                                  </StatusBadge>
                                  {appointment.referenceNumber && (
                                    <ReferenceBadge>
                                      Ref: {appointment.referenceNumber}
                                    </ReferenceBadge>
                                  )}
                                  <PaymentStatusBadge $paymentStatus={getPaymentStatusDisplay(appointment)}>
                                    {getPaymentStatusDisplay(appointment)}
                                  </PaymentStatusBadge>
                                </div>
                              </AppointmentHeader>

                              <AppointmentDetails>
                                <DetailRow>
                                  <DetailLabel>Client:</DetailLabel>
                                  <DetailValue>{appointment.clientName}</DetailValue>
                                </DetailRow>
                                <DetailRow>
                                  <DetailLabel>Pet:</DetailLabel>
                                  <DetailValue>
                                    {appointment.petName || "-"}
                                    {appointment.petType && ` (${appointment.petType})`}
                                  </DetailValue>
                                </DetailRow>
                                <DetailRow>
                                  <DetailLabel>Service:</DetailLabel>
                                  <DetailValue>{appointment.serviceType || "Check Up"}</DetailValue>
                                </DetailRow>
                                {appointment.petBreed && (
                                  <DetailRow>
                                    <DetailLabel>Breed:</DetailLabel>
                                    <DetailValue>{appointment.petBreed}</DetailValue>
                                  </DetailRow>
                                )}
                              </AppointmentDetails>

                              <AppointmentActions>
                                <ActionButton
                                  $variant="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAppointmentDetails(appointment);
                                  }}
                                >
                                  👁 View
                                </ActionButton>

                                {/* Show different actions based on status */}
                                {appointment.status === "Confirmed" && (
                                  <ActionButton
                                    $variant="success"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMedicalRecordsModal(appointment);
                                    }}
                                  >
                                    ✓ Done
                                  </ActionButton>
                                )}

                                {appointment.status === "Pending" && (
                                  <ActionButton
                                    $variant="success"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStatusModal(appointment.id, appointment.status || "Pending");
                                    }}
                                  >
                                    ✓ Confirm
                                  </ActionButton>
                                )}

                                {appointment.status !== "Done" && appointment.status !== "Cancelled" && (
                                  <ActionButton
                                    $variant="warning"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStatusModal(appointment.id, appointment.status || "Pending");
                                    }}
                                  >
                                    {appointment.status === "Confirmed" ? "✕ Cancel" : "✕ Cancel"}
                                  </ActionButton>
                                )}

                                {/* Show completed info for Done appointments */}
                                {appointment.status === "Done" && appointment.completedAt && (
                                  <CompletedInfo>
                                    Completed: {formatDateTime(appointment.completedAt)}
                                  </CompletedInfo>
                                )}

                                {/* Show cancelled info for Cancelled appointments */}
                                {appointment.status === "Cancelled" && (
                                  <CancelledInfo>
                                    Cancelled
                                  </CancelledInfo>
                                )}
                              </AppointmentActions>
                            </AppointmentCard>
                          );
                        })}
                    </AppointmentsGrid>
                  )}
                </CalendarGrid>

                {/* Quick Date Navigation */}
                <QuickDateNavigation>
                  <QuickDateTitle>Jump to Date:</QuickDateTitle>
                  <QuickDateButtons>
                    <QuickDateButton
                      onClick={() => setCurrentDate(new Date())}
                      $active={isToday(currentDate)}
                    >
                      Today
                    </QuickDateButton>
                    <QuickDateButton
                      onClick={() => handleDateNavigation('tomorrow')}
                    >
                      Tomorrow
                    </QuickDateButton>
                    <QuickDateButton
                      onClick={() => handleDateNavigation('nextWeek')}
                    >
                      Next Week
                    </QuickDateButton>
                  </QuickDateButtons>
                </QuickDateNavigation>
              </AppointmentsSection>
            )}
        {viewMode === "unavailable" && (
  <AppointmentsSection>
    <SectionHeader>
      <SectionTitle>Unavailable Dates</SectionTitle>
      <ControlsContainer>
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
        <RefreshButton
          onClick={() => {
            fetchAppointments();
            fetchUnavailableSlots();
          }}
        >
          ⟳ Refresh
        </RefreshButton>
      </ControlsContainer>
    </SectionHeader>

    {filteredUnavailableSlots.length === 0 ? (
      <NoAppointments>
        No unavailable dates set.
      </NoAppointments>
    ) : (
      <AppointmentsGrid>
        {(() => {
          // Group by originalId to show multiple day leaves as single entries
          const groupedSlots: { [key: string]: UnavailableSlot[] } = {};
          
          filteredUnavailableSlots.forEach((slot) => {
            const groupKey = slot.originalId || slot.id;
            
            if (!groupedSlots[groupKey]) {
              groupedSlots[groupKey] = [];
            }
            groupedSlots[groupKey].push(slot);
          });

          return Object.values(groupedSlots).map((slots, index) => {
            const firstSlot = slots[0];
            const isMultipleDays = slots.length > 1;
            
            // Sort by date
            const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date));
            const startDate = sortedSlots[0].date;
            const endDate = sortedSlots[sortedSlots.length - 1].date;

            const formatDisplayDate = (dateString: string) => {
              const date = new Date(dateString);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              });
            };

            const dateDisplay = isMultipleDays 
              ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`
              : formatDisplayDate(startDate);

            return (
              <UnavailableCard key={`group-${index}`} $delay={index * 0.1}>
                <UnavailableIcon>⏰</UnavailableIcon>
                <UnavailableInfo>
                  <UnavailableDate>
                    {dateDisplay}
                    {isMultipleDays && (
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: 'normal',
                        color: '#7f8c8d',
                        marginLeft: '0.5rem'
                      }}>
                        ({slots.length} days)
                      </span>
                    )}
                  </UnavailableDate>
                  <UnavailableDoctor>👨‍⚕️ {firstSlot.veterinarian}</UnavailableDoctor>
                  <UnavailableTime>
                    {firstSlot.isAllDay ? "🕐 All Day" : `🕐 ${firstSlot.startTime} - ${firstSlot.endTime}`}
                  </UnavailableTime>
                  {firstSlot.reason && (
                    <UnavailableReason>
                      <strong>📝 Reason:</strong> {firstSlot.reason}
                    </UnavailableReason>
                  )}
                  <UnavailableStatus>Unavailable</UnavailableStatus>
                </UnavailableInfo>
                <UnavailableActions>
                  <ActionButton
                    $variant="primary"
                    onClick={() => openUnavailableDetails(firstSlot)}
                  >
                    👁 View Details
                  </ActionButton>
                </UnavailableActions>
              </UnavailableCard>
            );
          });
        })()}
      </AppointmentsGrid>
    )}

    {/* Unavailable Details Modal */}
    {showUnavailableDetails && selectedUnavailable && (
      <ModalOverlay onClick={closeUnavailableDetails}>
        <ModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
          <ModalHeader>
            <ModalTitle>Unavailable Date Details</ModalTitle>
            <CloseButton onClick={closeUnavailableDetails}>×</CloseButton>
          </ModalHeader>
          
          <DetailsContent>
            <DetailSection>
              <DetailSectionTitle>Unavailability Information</DetailSectionTitle>
              
              <DetailItem>
                <DetailLabelLarge>Veterinarian:</DetailLabelLarge>
                <DetailValueLarge>{selectedUnavailable.veterinarian}</DetailValueLarge>
              </DetailItem>

              <DetailItem>
                <DetailLabelLarge>Date Range:</DetailLabelLarge>
                <DetailValueLarge>
                  {selectedUnavailable.isMultipleDays && selectedUnavailable.startDate && selectedUnavailable.endDate
                    ? `${formatDate(selectedUnavailable.startDate)} to ${formatDate(selectedUnavailable.endDate)}`
                    : formatDate(selectedUnavailable.date)
                  }
                </DetailValueLarge>
              </DetailItem>

              {selectedUnavailable.isMultipleDays && selectedUnavailable.leaveDays && (
                <DetailItem>
                  <DetailLabelLarge>Duration:</DetailLabelLarge>
                  <DetailValueLarge>{selectedUnavailable.leaveDays} days</DetailValueLarge>
                </DetailItem>
              )}

              <DetailItem>
                <DetailLabelLarge>Time:</DetailLabelLarge>
                <DetailValueLarge>
                  {selectedUnavailable.isAllDay 
                    ? "All Day" 
                    : `${selectedUnavailable.startTime} - ${selectedUnavailable.endTime}`
                  }
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

              {selectedUnavailable.reason && (
                <DetailItem style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <DetailLabelLarge style={{ marginBottom: '0.5rem' }}>Reason:</DetailLabelLarge>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #e9ecef',
                    width: '100%'
                  }}>
                    <DetailValueLarge style={{ fontStyle: 'italic', lineHeight: '1.5' }}>
                      {selectedUnavailable.reason}
                    </DetailValueLarge>
                  </div>
                </DetailItem>
              )}

              {selectedUnavailable.createdAt && (
                <DetailItem>
                  <DetailLabelLarge>Marked On:</DetailLabelLarge>
                  <DetailValueLarge>
                    {formatDateTime(selectedUnavailable.createdAt)}
                  </DetailValueLarge>
                </DetailItem>
              )}

              {/* Show individual days for multiple day leaves */}
              {selectedUnavailable.isMultipleDays && selectedUnavailable.originalId && (
                <DetailItem style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <DetailLabelLarge style={{ marginBottom: '0.5rem' }}>Individual Days:</DetailLabelLarge>
                  <div style={{
                    background: '#fff3cd',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #ffeaa7',
                    width: '100%',
                    maxHeight: '150px',
                    overflowY: 'auto'
                  }}>
                    {filteredUnavailableSlots
                      .filter(slot => slot.originalId === selectedUnavailable.originalId)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((slot, idx) => (
                        <div key={slot.id} style={{
                          padding: '0.25rem 0',
                          borderBottom: idx < filteredUnavailableSlots.filter(s => s.originalId === selectedUnavailable.originalId).length - 1 ? '1px solid #ffeaa7' : 'none',
                          fontSize: '0.875rem',
                          color: '#856404'
                        }}>
                          📅 {formatDate(slot.date)} 
                          {!slot.isAllDay && slot.startTime && ` (${slot.startTime} - ${slot.endTime})`}
                        </div>
                      ))
                    }
                  </div>
                </DetailItem>
              )}
            </DetailSection>

            <AppointmentActions>
              <ActionButton
                $variant="primary"
                onClick={closeUnavailableDetails}
                style={{ flex: 1 }}
              >
                Close
              </ActionButton>
            </AppointmentActions>
          </DetailsContent>
        </ModalContent>
      </ModalOverlay>
    )}
  </AppointmentsSection>
)}
  {viewMode === "settings" && (
              <>
                <DashboardHeader style={{ textAlign: "center" }}>
                  <ContentTitle>Settings</ContentTitle>
                  <ContentSubtitle>Manage your account settings and security</ContentSubtitle>
                </DashboardHeader>
                <SettingsContainer>
                  <SettingsSection>
                    <SettingsSectionTitle>Account Management</SettingsSectionTitle>
                    <SettingsSectionDesc>
                      Create new administrator or doctor accounts for your clinic.
                    </SettingsSectionDesc>
                    <TwoFactorCard>
                      <CreateAccountButton onClick={() => setShowCreateAccount(true)}>
                        Create New Account
                      </CreateAccountButton>
                    </TwoFactorCard>
                  </SettingsSection>
                  <TwoFASection />
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
                      <InfoItem>
                        <InfoLabel>2FA Status:</InfoLabel>
                        <InfoValue>
                          <span style={{
                            color: twoFactorEnabled ? '#28a745' : '#dc3545',
                            fontWeight: 'bold'
                          }}>
                            {twoFactorEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}
                          </span>
                        </InfoValue>
                      </InfoItem>
                    </InfoGrid>
                  </SettingsSection>
                </SettingsContainer>
              </>
            )}
            {/* Medical Records Confirmation Modal */}
            {showMedicalRecordsModal && medicalRecordAppointment && (
              <ModalOverlay onClick={closeMedicalRecordsModal}>
                <ModalContent onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Mark Appointment as Done</ModalTitle>
                    <CloseButton onClick={closeMedicalRecordsModal}>×</CloseButton>
                  </ModalHeader>
                  <DetailsContent>
                    <DetailSection>
                      <DetailSectionTitle>Confirm Completion</DetailSectionTitle>
                      <p>Are you sure you want to mark this appointment as done and move it to medical records?</p>

                      <DetailItem>
                        <DetailLabelLarge>Client:</DetailLabelLarge>
                        <DetailValueLarge>{medicalRecordAppointment.clientName}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Pet:</DetailLabelLarge>
                        <DetailValueLarge>{medicalRecordAppointment.petName || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Service:</DetailLabelLarge>
                        <DetailValueLarge>{medicalRecordAppointment.serviceType || "Check Up"}</DetailValueLarge>
                      </DetailItem>
                      
                      <DetailItem>
                        <DetailLabelLarge>Date:</DetailLabelLarge>
                        <DetailValueLarge>{formatDate(medicalRecordAppointment.date)}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Time:</DetailLabelLarge>
                        <DetailValueLarge>{medicalRecordAppointment.timeSlot}</DetailValueLarge>
                      </DetailItem>
                    </DetailSection>
                    <AppointmentActions>
                      <ActionButton
                        $variant="primary"
                        onClick={closeMedicalRecordsModal}
                      >
                        Cancel
                      </ActionButton>
                      <ActionButton
                        $variant="success"
                        onClick={handleMoveToMedicalRecords}
                      >
                        ✓ Confirm Done
                      </ActionButton>
                    </AppointmentActions>
                  </DetailsContent>
                </ModalContent>
              </ModalOverlay>
            )}
            {/* Status Confirmation Modal */}
            {showStatusModal && (
              <ModalOverlay onClick={closeStatusModal}>
                <ModalContent onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Confirm Status Change</ModalTitle>
                    <CloseButton onClick={closeStatusModal}>×</CloseButton>
                  </ModalHeader>
                  <DetailsContent>
                    <p>Are you sure you want to change the appointment status to <strong>{newStatus}</strong>?</p>
                    <AppointmentActions>
                      <ActionButton
                        $variant="primary"
                        onClick={closeStatusModal}
                      >
                        No, Keep Current
                      </ActionButton>
                      <ActionButton
                        $variant="success"
                        onClick={handleStatusConfirm}
                      >
                        Yes, Change to {newStatus}
                      </ActionButton>
                    </AppointmentActions>
                  </DetailsContent>
                </ModalContent>
              </ModalOverlay>
            )}
            {/* Asana-inspired Refund Completion Confirmation Modal */}
            {showCompleteRefundModal && refundToComplete && (
              <AsanaModalOverlay onClick={closeCompleteRefundModal}>
                <AsanaModalContent onClick={(e) => e.stopPropagation()}>
                  <AsanaModalHeader>
                    <AsanaModalIcon>✅</AsanaModalIcon>
                    <AsanaModalTitle>Complete Refund</AsanaModalTitle>
                    <AsanaCloseButton onClick={closeCompleteRefundModal}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </AsanaCloseButton>
                  </AsanaModalHeader>

                  <AsanaModalBody>
                    <AsanaModalDescription>
                      Are you sure you want to mark this refund as completed? This action cannot be undone.
                    </AsanaModalDescription>

                    <AsanaDetailsCard>
                      <AsanaDetailItem>
                        <AsanaDetailLabel>Client Name</AsanaDetailLabel>
                        <AsanaDetailValue>{refundToComplete.clientName}</AsanaDetailValue>
                      </AsanaDetailItem>

                      <AsanaDetailItem>
                        <AsanaDetailLabel>Pet Name</AsanaDetailLabel>
                        <AsanaDetailValue>{refundToComplete.petName}</AsanaDetailValue>
                      </AsanaDetailItem>

                      <AsanaDetailItem>
                        <AsanaDetailLabel>Service Type</AsanaDetailLabel>
                        <AsanaDetailValue>{refundToComplete.appointmentType}</AsanaDetailValue>
                      </AsanaDetailItem>

                      <AsanaDetailItem>
                        <AsanaDetailLabel>Refund Amount</AsanaDetailLabel>
                        <AsanaDetailValue $highlight>₱{refundToComplete.amount || 0}</AsanaDetailValue>
                      </AsanaDetailItem>

                      <AsanaDetailItem>
                        <AsanaDetailLabel>Payment Method</AsanaDetailLabel>
                        <AsanaDetailValue>
                          <PaymentMethodBadge $method={refundToComplete.paymentMethod}>
                            {refundToComplete.paymentMethod}
                          </PaymentMethodBadge>
                        </AsanaDetailValue>
                      </AsanaDetailItem>

                      {refundToComplete.paymentMethod === "GCash" && refundToComplete.gcashPhoneNumber && (
                        <AsanaDetailItem>
                          <AsanaDetailLabel>GCash Phone</AsanaDetailLabel>
                          <AsanaDetailValue>{refundToComplete.gcashPhoneNumber}</AsanaDetailValue>
                        </AsanaDetailItem>
                      )}

                      <AsanaDetailItem>
                        <AsanaDetailLabel>Status</AsanaDetailLabel>
                        <AsanaStatusBadge $status="processing">
                          Currently Processing
                        </AsanaStatusBadge>
                      </AsanaDetailItem>
                    </AsanaDetailsCard>

                    <AsanaWarningBox>
                      <AsanaWarningIcon>⚠️</AsanaWarningIcon>
                      <AsanaWarningText>
                        Once completed, this refund will be moved to the completed section and cannot be reverted.
                      </AsanaWarningText>
                    </AsanaWarningBox>
                  </AsanaModalBody>
                  <AsanaModalFooter>
                    <AsanaCancelButton
                      onClick={closeCompleteRefundModal}
                      disabled={completingRefund}
                    >
                      Cancel
                    </AsanaCancelButton>
                    <AsanaConfirmButton
                      onClick={handleCompleteRefundConfirm}
                      disabled={completingRefund}
                    >
                      {completingRefund ? (
                        <>
                          <AsanaSpinner />
                          Completing...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '8px' }}>
                            <path d="M13.3334 4L6.00008 11.3333L2.66675 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Complete Refund
                        </>
                      )}
                    </AsanaConfirmButton>
                  </AsanaModalFooter>
                </AsanaModalContent>
              </AsanaModalOverlay>
            )}
            {/* Enhanced Appointment Details Modal with Payment Verification */}
            {showAppointmentDetails && selectedAppointment && (
              <ModalOverlay onClick={closeAppointmentDetails}>
                <ModalContent onClick={(e) => e.stopPropagation()}>
                  <ModalHeader>
                    <ModalTitle>Appointment Details</ModalTitle>
                    <CloseButton onClick={closeAppointmentDetails}>×</CloseButton>
                  </ModalHeader>
                  <DetailsContent>
                    <DetailSection>
                      <DetailSectionTitle>Client & Pet Information</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Client Name:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.clientName}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Pet Name:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.petName || "-"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Pet Type:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.petType || "-"}</DetailValueLarge>
                      </DetailItem>
                        <DetailItem>
                          <DetailLabelLarge>Breed:</DetailLabelLarge>
                          <DetailValueLarge>{selectedAppointment.breed || selectedAppointment.petBreed || "Not specified"}</DetailValueLarge>
                        </DetailItem>
                          <DetailItem>
                        <DetailLabelLarge>Gender:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.gender || "Not specified"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Color:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.color || "Not specified"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Birthday:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.birthday || "Not specified"}</DetailValueLarge>
                      </DetailItem>
                    </DetailSection>
                    <DetailSection>
                      <DetailSectionTitle>Appointment Details</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Date:</DetailLabelLarge>
                        <DetailValueLarge>{formatDate(selectedAppointment.date)}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Time Slot:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.timeSlot}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Service Type:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.serviceType || "Check Up"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Status:</DetailLabelLarge>
                        <DetailValueLarge>
                          <StatusBadge $status={selectedAppointment.status} style={{
                            display: 'inline-block',
                            padding: '0.3rem 0.8rem',
                            borderRadius: '15px',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {selectedAppointment.status}
                          </StatusBadge>
                        </DetailValueLarge>
                      </DetailItem>
                      {selectedAppointment.bookedByAdmin && (
                        <DetailItem>
                          <DetailLabelLarge>Booked By:</DetailLabelLarge>
                          <DetailValueLarge>Admin</DetailValueLarge>
                        </DetailItem>
                      )}
                      {selectedAppointment.createdAt && (
                        <DetailItem>
                          <DetailLabelLarge>Created:</DetailLabelLarge>
                          <DetailValueLarge>{formatDateTime(selectedAppointment.createdAt)}</DetailValueLarge>
                        </DetailItem>
                      )}
                      {selectedAppointment.completedAt && (
                        <DetailItem>
                          <DetailLabelLarge>Completed:</DetailLabelLarge>
                          <DetailValueLarge>{formatDateTime(selectedAppointment.completedAt)}</DetailValueLarge>
                        </DetailItem>
                      )}
                    </DetailSection>
                    <DetailSection>
                      <DetailSectionTitle>Payment Information</DetailSectionTitle>
                      <DetailItem>
                        <DetailLabelLarge>Payment Method:</DetailLabelLarge>
                        <DetailValueLarge>{selectedAppointment.paymentMethod || "Cash"}</DetailValueLarge>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabelLarge>Payment Status:</DetailLabelLarge>
                        <DetailValueLarge>
                          <PaymentStatusBadge $paymentStatus={
                            selectedAppointment.status === "Done" ? "Complete Payment" :
                              getPaymentStatusDisplay(selectedAppointment)
                          }>
                            {selectedAppointment.status === "Done" ? "Complete Payment" :
                              getPaymentStatusDisplay(selectedAppointment)}
                          </PaymentStatusBadge>
                        </DetailValueLarge>
                      </DetailItem>

                      {selectedAppointment.paymentMethod === "GCash" && (
                        <>
                          <DetailItem>
                            <DetailLabelLarge>GCash Reference No:</DetailLabelLarge>
                            <DetailValueLarge style={{
                              color: selectedAppointment.referenceNumber ? '#28a745' : '#dc3545',
                              fontWeight: 'bold',
                              fontSize: '1.1rem'
                            }}>
                              {selectedAppointment.referenceNumber || "❌ Not provided yet"}
                            </DetailValueLarge>
                          </DetailItem>

                          {selectedAppointment.verifiedBy && (
                            <DetailItem>
                              <DetailLabelLarge>Verified By:</DetailLabelLarge>
                              <DetailValueLarge>{selectedAppointment.verifiedBy}</DetailValueLarge>
                            </DetailItem>
                          )}

                          {selectedAppointment.verifiedAt && (
                            <DetailItem>
                              <DetailLabelLarge>Verified At:</DetailLabelLarge>
                              <DetailValueLarge>{formatDateTime(selectedAppointment.verifiedAt)}</DetailValueLarge>
                            </DetailItem>
                          )}

                          {selectedAppointment.status !== "Done" && getPaymentStatusDisplay(selectedAppointment) === "Pending Verification" && (
                            <PaymentVerificationSection>
                              <VerificationTitle>💰 Payment Verification</VerificationTitle>
                              <VerificationInstructions>
                                Please verify the GCash payment using the reference number above.
                                Once verified, you can confirm the payment.
                              </VerificationInstructions>

                              <VerificationActions>
                                <ActionButton
                                  $variant="success"
                                  onClick={async () => {
                                    if (!selectedAppointment.referenceNumber) {
                                      alert("❌ No reference number provided by user yet.");
                                      return;
                                    }

                                    if (confirm(`✅ Confirm GCash payment with reference: ${selectedAppointment.referenceNumber}?`)) {
                                      try {
                                        const appointmentRef = doc(db, "appointments", selectedAppointment.id!);
                                        await updateDoc(appointmentRef, {
                                          paymentStatus: "Complete Payment",
                                          status: "Confirmed",
                                          verifiedBy: auth.currentUser?.email || "admin",
                                          verifiedAt: new Date().toISOString()
                                        });

                                        alert("✅ Payment confirmed successfully!");
                                        closeAppointmentDetails();
                                        fetchAppointments();
                                      } catch (error) {
                                        console.error("Error confirming payment:", error);
                                        alert("❌ Failed to confirm payment.");
                                      }
                                    }
                                  }}
                                >
                                  ✅ Confirm Payment
                                </ActionButton>

                                <ActionButton
                                  $variant="warning"
                                  onClick={async () => {
                                    if (confirm("❌ Mark this payment as failed?")) {
                                      try {
                                        const appointmentRef = doc(db, "appointments", selectedAppointment.id!);
                                        await updateDoc(appointmentRef, {
                                          paymentStatus: "Failed",
                                          status: "Pending Payment"
                                        });

                                        alert("Payment marked as failed.");
                                        closeAppointmentDetails();
                                        fetchAppointments();
                                      } catch (error) {
                                        console.error("Error updating payment status:", error);
                                        alert("Failed to update payment status.");
                                      }
                                    }
                                  }}
                                >
                                  ❌ Mark as Failed
                                </ActionButton>
                              </VerificationActions>
                            </PaymentVerificationSection>
                          )}
                        </>
                      )}
                    </DetailSection>
                    <AppointmentActions>
                      <ActionButton
                        $variant="primary"
                        onClick={closeAppointmentDetails}
                      >
                        Close
                      </ActionButton>

                      {selectedAppointment.status !== "Done" && selectedAppointment.status !== "Cancelled" && (
                        <ActionButton
                          $variant="success"
                          onClick={() => openMedicalRecordsModal(selectedAppointment!)}
                        >
                          ✓ Mark as Done
                        </ActionButton>
                      )}
                    </AppointmentActions>
                  </DetailsContent>
                </ModalContent>
              </ModalOverlay>
            )}
            {/* Enhanced Booking Modal */}
            {showBookingModal && (
              <ModalOverlay onClick={() => setShowBookingModal(false)}>
                <ModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
                  <ModalHeader>
                    <ModalTitle>Book New Appointment</ModalTitle>
                    <CloseButton onClick={() => setShowBookingModal(false)}>×</CloseButton>
                  </ModalHeader>

                  <DetailsContent>
                    <form onSubmit={handleBookAppointment}>
                      <DetailSection>
                        <DetailSectionTitle>Client & Pet Information</DetailSectionTitle>

                        <FormGroup>
                          <Label htmlFor="clientSelect">Select Client *</Label>
                          <select
                            id="clientSelect"
                            value={selectedClient}
                            onChange={(e) => {
                              setSelectedClient(e.target.value);
                              if (e.target.value) {
                                fetchClientPets(e.target.value);
                              } else {
                                setClientPets([]);
                                setSelectedPet("");
                                resetPetForm();
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "0.75rem",
                              border: "1px solid #ddd",
                              borderRadius: "6px",
                              fontSize: "0.875rem"
                            }}
                            required
                          >
                            <option value="">Select a client</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.name || client.email}>
                                {client.name} ({client.email})
                              </option>
                            ))}
                          </select>
                        </FormGroup>

                        {/* Pet Selection Dropdown - Only show if client has pets */}
                        {clientPets.length > 0 && (
                          <FormGroup>
                            <Label htmlFor="petSelect">Select Pet</Label>
                            <select
                              id="petSelect"
                              value={selectedPet}
                              onChange={(e) => {
                                const petId = e.target.value;
                                setSelectedPet(petId);
                                if (petId === "new") {
                                  resetPetForm();
                                } else {
                                  const selectedPetData = clientPets.find(pet => pet.id === petId);
                                  if (selectedPetData) {
                                    autoFillPetData(selectedPetData);
                                  }
                                }
                              }}
                              style={{
                                width: "100%",
                                padding: "0.75rem",
                                border: "1px solid #ddd",
                                borderRadius: "6px",
                                fontSize: "0.875rem"
                              }}
                            >
                              <option value="">Select a pet</option>
                              {clientPets.map((pet) => (
                                <option key={pet.id} value={pet.id}>
                                  {pet.petName} ({pet.petType})
                                </option>
                              ))}
                              <option value="new">+ Add New Pet</option>
                            </select>
                          </FormGroup>
                        )}

                        {/* Pet Information Form - Show when "Add New Pet" is selected or no pets available */}
                        {(selectedPet === "new" || clientPets.length === 0) && (
                          <>
                            <FormGroup>
                              <Label htmlFor="petName">Pet Name *</Label>
                              <input
                                type="text"
                                id="petName"
                                value={petName}
                                onChange={(e) => setPetName(e.target.value)}
                                placeholder="Enter pet name"
                                style={{
                                  width: "100%",
                                  padding: "0.75rem",
                                  border: "1px solid #ddd",
                                  borderRadius: "6px",
                                  fontSize: "0.875rem"
                                }}
                                required
                              />
                            </FormGroup>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                              <FormGroup>
                                <Label htmlFor="petType">Pet Type</Label>
                                <select
                                  id="petType"
                                  value={petType}
                                  onChange={(e) => setPetType(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    fontSize: "0.875rem"
                                  }}
                                >
                                  <option value="">Select type</option>
                                  <option value="Dog">Dog</option>
                                  <option value="Cat">Cat</option>
                                  <option value="Other">Other</option>
                                </select>
                              </FormGroup>
                              <FormGroup>
                                <Label htmlFor="petBreed">Breed</Label>
                                <input
                                  type="text"
                                  id="petBreed"
                                  value={petBreed}
                                  onChange={(e) => setPetBreed(e.target.value)}
                                  placeholder="Enter breed"
                                  style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    fontSize: "0.875rem"
                                  }}
                                />
                              </FormGroup>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                              <FormGroup>
                                <Label htmlFor="petGender">Gender</Label>
                                <select
                                  id="petGender"
                                  value={petGender}
                                  onChange={(e) => setPetGender(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    fontSize: "0.875rem"
                                  }}
                                >
                                  <option value="">Select gender</option>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                </select>
                              </FormGroup>
                              <FormGroup>
                                <Label htmlFor="petBirthday">Birthday</Label>
                                <input
                                  type="date"
                                  id="petBirthday"
                                  value={petBirthday}
                                  onChange={(e) => setPetBirthday(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    fontSize: "0.875rem"
                                  }}
                                />
                              </FormGroup>
                            </div>
                            <FormGroup>
                              <Label htmlFor="petColor">Color</Label>
                              <input
                                type="text"
                                id="petColor"
                                value={petColor}
                                onChange={(e) => setPetColor(e.target.value)}
                                placeholder="Enter pet color"
                                style={{
                                  width: "100%",
                                  padding: "0.75rem",
                                  border: "1px solid #ddd",
                                  borderRadius: "6px",
                                  fontSize: "0.875rem"
                                }}
                              />
                            </FormGroup>
                          </>
                        )}
                      </DetailSection>
                      <DetailSection>
                        <DetailSectionTitle>Appointment Details</DetailSectionTitle>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <FormGroup>
                            <Label htmlFor="appointmentDate">Date *</Label>
                            <input
                              type="date"
                              id="appointmentDate"
                              value={appointmentDate}
                              onChange={(e) => setAppointmentDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              style={{
                                width: "100%",
                                padding: "0.75rem",
                                border: "1px solid #ddd",
                                borderRadius: "6px",
                                fontSize: "0.875rem"
                              }}
                              required
                            />
                          </FormGroup>
                          <FormGroup>
                            <Label htmlFor="appointmentTime">Time Slot *</Label>
                            <select
                              id="appointmentTime"
                              value={appointmentTime}
                              onChange={(e) => setAppointmentTime(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "0.75rem",
                                border: "1px solid #ddd",
                                borderRadius: "6px",
                                fontSize: "0.875rem"
                              }}
                              required
                            >
                              <option value="">Select time slot</option>
                              {timeSlots.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          </FormGroup>
                        </div>
                        <FormGroup>
                          <Label htmlFor="serviceType">Service Type</Label>
                          <select
                            id="serviceType"
                            value={serviceType}
                            onChange={(e) => setServiceType(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.75rem",
                              border: "1px solid #ddd",
                              borderRadius: "6px",
                              fontSize: "0.875rem"
                            }}
                          >
                            <option value="Check Up">Check Up</option>
                            <option value="Vaccination">Vaccination</option>
                            <option value="Grooming">Grooming</option>
                            <option value="Deworming">Deworming</option>
                            <option value="Spay/Neuter">Spay/Neuter</option>
                            <option value="Ultrasound">Ultrasound</option>
                            <option value="Anti-Rabies">Anti-Rabies</option>
                          </select>
                        </FormGroup>
                      </DetailSection>
                      {unavailableSlots.some((slot) => slot.date === appointmentDate) && (
                        <div style={{
                          padding: "1rem",
                          backgroundColor: "#fff3cd",
                          border: "1px solid #ffeaa7",
                          borderRadius: "6px",
                          marginBottom: "1rem",
                          color: "#856404"
                        }}>
                          ⚠️ <strong>Date Unavailable:</strong> A doctor has marked this date as unavailable.
                          Please select a different date.
                        </div>
                      )}
                      {appointments.some(
                        (appt) =>
                          appt.date === appointmentDate &&
                          appt.timeSlot === appointmentTime &&
                          appt.status !== "Cancelled"
                      ) && (
                          <div style={{
                            padding: "1rem",
                            backgroundColor: "#f8d7da",
                            border: "1px solid #f5c6cb",
                            borderRadius: "6px",
                            marginBottom: "1rem",
                            color: "#721c24"
                          }}>
                            ❌ <strong>Time Slot Taken:</strong> This time slot is already booked.
                            Please select a different time.
                          </div>
                        )}
                      <AppointmentActions>
                        <ActionButton
                          type="button"
                          $variant="primary"
                          onClick={() => setShowBookingModal(false)}
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </ActionButton>
                        <ActionButton
                          type="submit"
                          $variant="success"
                          disabled={isLoading}
                          style={{ flex: 1 }}
                        >
                          {isLoading ? (
                            <>
                              <LoadingSpinnerSmall />
                              Booking...
                            </>
                          ) : (
                            "Book Appointment"
                          )}
                        </ActionButton>
                      </AppointmentActions>
                    </form>
                  </DetailsContent>
                </ModalContent>
              </ModalOverlay>
            )}
            {/* Create Account Modal */}
            {showCreateAccount && (
              <ModalOverlay onClick={() => setShowCreateAccount(false)}>
                <ModalContent onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                  <ModalHeader>
                    <ModalTitle>Create New Account</ModalTitle>
                    <CloseButton onClick={() => setShowCreateAccount(false)}>×</CloseButton>
                  </ModalHeader>

                  <DetailsContent>
                    <form onSubmit={handleCreateAccount}>
                      <FormGroup>
                        <Label htmlFor="accountName">Full Name *</Label>
                        <input
                          type="text"
                          id="accountName"
                          value={newAccountName}
                          onChange={(e) => setNewAccountName(e.target.value)}
                          placeholder="Enter full name"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "0.875rem"
                          }}
                          required
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label htmlFor="accountEmail">Email Address *</Label>
                        <input
                          type="email"
                          id="accountEmail"
                          value={newAccountEmail}
                          onChange={(e) => setNewAccountEmail(e.target.value)}
                          placeholder="Enter email address"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "0.875rem"
                          }}
                          required
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label htmlFor="accountPassword">Password *</Label>
                        <input
                          type="password"
                          id="accountPassword"
                          value={newAccountPassword}
                          onChange={(e) => setNewAccountPassword(e.target.value)}
                          placeholder="Enter password (min. 8 characters)"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "0.875rem"
                          }}
                          required
                          minLength={6}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label htmlFor="accountRole">Role *</Label>
                        <select
                          id="accountRole"
                          value={newAccountRole}
                          onChange={(e) => setNewAccountRole(e.target.value as "admin" | "doctor")}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "0.875rem"
                          }}
                          required
                        >
                          <option value="doctor">Doctor</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </FormGroup>
                      {createAccountMessage && (
                        <div style={{
                          padding: "1rem",
                          backgroundColor: createAccountMessage.includes("✅") ? "#d4edda" : "#f8d7da",
                          border: createAccountMessage.includes("✅") ? "1px solid #c3e6cb" : "1px solid #f5c6cb",
                          borderRadius: "6px",
                          marginBottom: "1rem",
                          color: createAccountMessage.includes("✅") ? "#155724" : "#721c24"
                        }}>
                          {createAccountMessage}
                        </div>
                      )}
                      <AppointmentActions>
                        <ActionButton
                          type="button"
                          $variant="primary"
                          onClick={() => setShowCreateAccount(false)}
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </ActionButton>
                        <ActionButton
                          type="submit"
                          $variant="success"
                          disabled={isCreatingAccount}
                          style={{ flex: 1 }}
                        >
                          {isCreatingAccount ? (
                            <>
                              <LoadingSpinnerSmall />
                              Creating...
                            </>
                          ) : (
                            "Create Account"
                          )}
                        </ActionButton>
                      </AppointmentActions>
                    </form>
                  </DetailsContent>
                </ModalContent>
              </ModalOverlay>
            )}
          </ContentArea>
        </DashboardLayout>
      </PageContainer>
    </>
  );
};

// Asana-inspired Styled Components for Refund Completion Modal
const AsanaModalOverlay = styled.div`
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
      animation: ${asanaOverlayFade} 0.2s ease-out;
    `;

const AsanaModalContent = styled.div`
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      animation: ${asanaSlideIn} 0.3s ease-out;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border: 1px solid #e5e7eb;
    `;

const AsanaModalHeader = styled.div`
      display: flex;
      align-items: center;
      padding: 1.5rem 1.5rem 1rem;
      border-bottom: 1px solid #f3f4f6;
      position: relative;
    `;

const AsanaModalIcon = styled.div`
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      margin-right: 0.75rem;
      color: white;
    `;

const AsanaModalTitle = styled.h2`
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
      flex: 1;
    `;

const AsanaCloseButton = styled.button`
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s;
      &:hover {
        background: #f3f4f6;
        color: #374151;
      }
    `;

const AsanaModalBody = styled.div`
      padding: 1.5rem;
    `;

const AsanaModalDescription = styled.p`
      margin: 0 0 1.5rem 0;
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.5;
    `;

const AsanaDetailsCard = styled.div`
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    `;

const AsanaDetailItem = styled.div`
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      &:last-child {
        margin-bottom: 0;
      }
    `;

const AsanaDetailLabel = styled.span`
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
    `;

const AsanaDetailValue = styled.span<{ $highlight?: boolean }>`
      font-size: 0.875rem;
      color: ${props => props.$highlight ? '#111827' : '#374151'};
      font-weight: ${props => props.$highlight ? '600' : '400'};
      text-align: right;
    `;

const PaymentMethodBadge = styled.span<{ $method: string }>`
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      background: ${props =>
    props.$method === "GCash" ? "#e0f2fe" :
      props.$method === "Cash" ? "#f0fdf4" : "#f3f4f6"};
      color: ${props =>
    props.$method === "GCash" ? "#0369a1" :
      props.$method === "Cash" ? "#166534" : "#374151"};
      border: 1px solid ${props =>
    props.$method === "GCash" ? "#bae6fd" :
      props.$method === "Cash" ? "#bbf7d0" : "#e5e7eb"};
    `;

const AsanaStatusBadge = styled.span<{ $status: string }>`
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      background: #ffedd5;
      color: #9a3412;
      border: 1px solid #fdba74;
    `;

const AsanaWarningBox = styled.div`
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    `;

const AsanaWarningIcon = styled.div`
      font-size: 1rem;
      flex-shrink: 0;
      margin-top: 0.125rem;
    `;

const AsanaWarningText = styled.p`
      margin: 0;
      font-size: 0.875rem;
      color: #92400e;
      line-height: 1.5;
    `;

const AsanaModalFooter = styled.div`
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      padding: 1rem 1.5rem 1.5rem;
      border-top: 1px solid #f3f4f6;
    `;

const AsanaCancelButton = styled.button`
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 0.625rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
      &:hover:not(:disabled) {
        background: #f9fafb;
        border-color: #9ca3af;
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;

const AsanaConfirmButton = styled.button`
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
      border-radius: 6px;
      padding: 0.625rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    `;

const AsanaSpinner = styled.div`
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

// User Management Styled Components
const UsersSummary = styled.div`
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    `;

const SummaryCard = styled.div`
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

const SummaryNumber = styled.div`
      font-size: 2rem;
      font-weight: bold;
      color: #34B89C;
      margin-bottom: 0.5rem;
    `;

const SummaryLabel = styled.div`
      font-size: 0.875rem;
      color: #7f8c8d;
    `;

const UsersTable = styled.div`
      margin-top: 1rem;
    `;

const UserInfo = styled.div`
      display: flex;
      flex-direction: column;
    `;

const UserName = styled.span`
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.25rem;
    `;

const UserEmail = styled.span`
      font-size: 0.75rem;
      color: #7f8c8d;
    `;

const RoleBadge = styled.span<{ $role: string }>`
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      background: ${props =>
    props.$role === "admin" ? "#e3f2fd" :
      props.$role === "doctor" ? "#f3e5f5" : "#e8f5e8"
  };
      color: ${props =>
    props.$role === "admin" ? "#1976d2" :
      props.$role === "doctor" ? "#7b1fa2" : "#2e7d32"
  };
    `;

const TwoFABadge = styled.span<{ $enabled: boolean }>`
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      background: ${props => props.$enabled ? "#e8f5e8" : "#ffebee"};
      color: ${props => props.$enabled ? "#2e7d32" : "#c62828"};
    `;

const StatusBadge = styled.span<{ $status?: string }>`
      padding: 0.25rem 0.75rem;
      border-radius: 15px;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
    `;

const UserActions = styled.div`
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    `;

const UserInfoCard = styled.div`
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    `;

const UserDetail = styled.div`
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      color: #2c3e50;
      
      &:last-child {
        margin-bottom: 0;
      }
    `;

const SearchInput = styled.input`
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.875rem;
      min-width: 200px;
      
      &:focus {
        outline: none;
        border-color: #3498db;
      }
    `;

const Message = styled.div<{ $type: "success" | "error" }>`
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      background: ${props => props.$type === "success" ? "#d4edda" : "#f8d7da"};
      color: ${props => props.$type === "success" ? "#155724" : "#721c24"};
      border: 1px solid ${props => props.$type === "success" ? "#c3e6cb" : "#f5c6cb"};
    `;

// Styled Components (all your existing styled components remain the same)
const PageContainer = styled.div`
      min-height: 100vh;
      background-color: #f8fafc;
    `;

const HeaderBar = styled.header`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: linear-gradient(90deg, #34B89C 0%, #6BC1E1 100%);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    `;

const BrandSection = styled.div`
      display: flex;
      align-items: center;
      gap: 1rem;
    `;

const MenuToggle = styled.button<{ $isOpen: boolean }>`
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      width: 30px;
      height: 25px;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      span {
        width: 100%;
        height: 3px;
        background: #2c3e50;
        border-radius: 5px;
        transition: all 0.3s linear;
        transform-origin: 1px;
      
        &:first-child {
          transform: ${({ $isOpen }) => ($isOpen ? 'rotate(45deg)' : 'rotate(0)')};
        }
        &:nth-child(2) {
          opacity: ${({ $isOpen }) => ($isOpen ? '0' : '1')};
          transform: ${({ $isOpen }) => ($isOpen ? 'translateX(20px)' : 'translateX(0)')};
        }
        &:nth-child(3) {
          transform: ${({ $isOpen }) => ($isOpen ? 'rotate(-45deg)' : 'rotate(0)')};
        }
      }
    `;

const Logo = styled.div`
      display: flex;
      align-items: center;
      gap: 1rem;
    `;

const LogoImage = styled.img`
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
    `;

const LogoText = styled.div`
      display: flex;
      color: #0080ff;
      flex-direction: column;
    `;

const ClinicName = styled.h1`
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #000000;
    `;

const LogoSubtext = styled.p`
      margin: 0;
      font-size: 0.875rem;
      color: #000000;
    `;

const UserSection = styled.div`
      display: flex;
      align-items: center;
      gap: 1rem;
    `;

const AdminBadge = styled.span`
      background: #009ece;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
    `;

const LogoutButton = styled.button`
      background: #e74c3c;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
      &:hover {
        background: #c0392b;
      }
    `;

const DashboardLayout = styled.div`
      display: flex;
      min-height: calc(100vh - 80px);
    `;

const Sidebar = styled.aside<SidebarProps>`
      width: ${props => props.$isOpen ? '280px' : '0'};
      background: white;
      box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
      transition: width 0.3s ease;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      @media (max-width: 768px) {
        position: fixed;
        height: 100vh;
        z-index: 99;
        width: ${props => props.$isOpen ? '280px' : '0'};
      }
    `;

const SidebarHeader = styled.div`
      padding: 2rem 1.5rem 1rem;
      border-bottom: 1px solid #ecf0f1;
    `;

const SidebarTitleRow = styled.div`
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

const SidebarTitle = styled.h2`
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
    `;

const MenuList = styled.div`
      flex: 1;
      padding: 1rem 0;
    `;

const MenuItem = styled.div<MenuItemProps>`
      display: flex;
      align-items: center;
      padding: 1rem 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
      background: ${props => props.$active ? '#f8f9fa' : 'transparent'};
      border-right: ${props => props.$active ? '4px solid #34B89C' : '4px solid transparent'};
      color: ${props => props.$active ? '#34B89C' : '#2c3e50'};
      &:hover {
        background: #f8f9fa;
        color: #34B89C;
      }
    `;

const MenuIcon = styled.span`
      font-size: 1.25rem;
      margin-right: 1rem;
    `;

const MenuText = styled.span`
      flex: 1;
      font-weight: 500;
    `;

const MenuCount = styled.span`
      background: #e74c3c;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
    `;

const FloatingMenuButton = styled.button`
      position: fixed;
      top: 1rem;
      left: 1rem;
      background: #34B89C;
      color: white;
      border: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      z-index: 98;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      @media (min-width: 769px) {
        display: none;
      }
    `;

const ContentArea = styled.main<{ $sidebarOpen: boolean }>`
      flex: 1;
      padding: 2rem;
      margin-left: ${props => props.$sidebarOpen ? '0' : '0'};
      transition: margin-left 0.3s ease;
      @media (max-width: 768px) {
        margin-left: 0;
        padding: 1rem;
      }
    `;

const DashboardHeader = styled.div`
      text-align: center;
      margin-bottom: 3rem;
    `;

const ContentTitle = styled.h1`
      font-size: 2.5rem;
      font-weight: 700;
      color: #2c3e50;
      margin: 0 0 0.5rem 0;
      @media (max-width: 768px) {
        font-size: 2rem;
      }
    `;

const ContentSubtitle = styled.p`
      font-size: 1.125rem;
      color: #7f8c8d;
      margin: 0;
    `;

const StatisticsSection = styled.section`
      margin-bottom: 3rem;
    `;

const SectionHeader = styled.div`
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    `;

const SectionTitle = styled.h2`
      font-size: 1.75rem;
      font-weight: 600;
      color: #2c3e50;
      margin: 0;
    `;

const SectionSubtitle = styled.h3`
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin: 2rem 0 1rem 0;
    `;

const ControlsContainer = styled.div`
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    `;

const FilterGroup = styled.div`
      display: flex;
      align-items: center;
      gap: 0.5rem;
    `;

const FilterLabel = styled.span`
      font-weight: 500;
      color: #2c3e50;
    `;

const FilterSelect = styled.select`
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      font-size: 0.875rem;
    `;

const RefreshButton = styled.button`
      background: #3498db;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
      &:hover:not(:disabled) {
        background: #2980b9;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;

const ActiveFilters = styled.div`
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #7f8c8d;
    `;

const FilterTag = styled.span`
      background: #e3f2fd;
      color: #1976d2;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    `;

const ClearFilters = styled.button`
      background: none;
      border: none;
      color: #e74c3c;
      cursor: pointer;
      font-size: 0.75rem;
      text-decoration: underline;
      &:hover {
        color: #c0392b;
      }
    `;

const StatsGrid = styled.div`
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    `;

const StatsCard = styled.div<{ $delay: number }>`
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      text-align: center;
      animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
      }
    `;

const StatsIcon = styled.div`
      font-size: 2.5rem;
      margin-bottom: 1rem;
    `;

const StatsTitle = styled.h3`
      font-size: 1rem;
      color: #7f8c8d;
      margin: 0 0 0.5rem 0;
      font-weight: 500;
    `;

const StatsNumber = styled.div<{ $color: string }>`
      font-size: 2.5rem;
      font-weight: 700;
      color: ${props => props.$color};
      margin: 0;
    `;

const TableCard = styled.div<{ $delay: number }>`
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      margin-bottom: 2rem;
      animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
    `;

const ChartTitle = styled.h3`
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin: 0 0 1.5rem 0;
    `;

const LoadingContainer = styled.div`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #7f8c8d;
    `;

const LoadingSpinner = styled.div`
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #34B89C;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

const LoadingText = styled.p`
      margin: 0;
      font-size: 0.875rem;
    `;

const TableContainer = styled.div`
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #ecf0f1;
    `;

const Table = styled.table`
      width: 100%;
      border-collapse: collapse;
    `;

const TableHeader = styled.thead`
      background: #f8f9fa;
    `;

const TableRow = styled.tr<{ $even?: boolean }>`
      background: ${props => props.$even ? '#f8f9fa' : 'white'};
      &:hover {
        background: #f1f8ff;
      }
    `;

const TableHeaderCell = styled.th`
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #2c3e50;
      border-bottom: 1px solid #ecf0f1;
      font-size: 0.875rem;
    `;

const TableBody = styled.tbody``;

const TableCell = styled.td<{ $color?: string; $bold?: boolean }>`
      padding: 1rem;
      border-bottom: 1px solid #ecf0f1;
      color: ${props => props.$color || '#2c3e50'};
      font-weight: ${props => props.$bold ? '600' : '400'};
      font-size: 0.875rem;
    `;

const TrendsInfo = styled.div`
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    `;

const TrendIndicator = styled.div<{ $type: "increased" | "decreased" | "stable" }>`
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: ${props =>
    props.$type === "increased" ? "#28a745" :
      props.$type === "decreased" ? "#dc3545" : "#666"
  };
    `;

const TrendArrow = styled.span``;

const TrendDot = styled.span``;

const TrendBadge = styled.span<{ $trend: "increased" | "decreased" | "stable" }>`
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      background: ${props =>
    props.$trend === "increased" ? "#d4edda" :
      props.$trend === "decreased" ? "#f8d7da" : "#e2e3e5"
  };
      color: ${props =>
    props.$trend === "increased" ? "#155724" :
      props.$trend === "decreased" ? "#721c24" : "#383d41"
  };
    `;

const TrendsSummary = styled.div`
      margin-top: 2rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 8px;
    `;

const SummaryTitle = styled.h4`
      margin: 0 0 1rem 0;
      color: #2c3e50;
      font-size: 1rem;
    `;

const SummaryGrid = styled.div`
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    `;

const SummaryItem = styled.div`
      text-align: center;
    `;

const SummaryValue = styled.div<{ $positive?: boolean }>`
      font-size: 1.25rem;
      font-weight: 600;
      color: ${props => props.$positive ? "#28a745" : "#2c3e50"};
    `;

const EmptyState = styled.div`
      text-align: center;
      padding: 3rem;
      color: #7f8c8d;
    `;

const EmptyStateIcon = styled.div`
      font-size: 3rem;
      margin-bottom: 1rem;
    `;

const EmptyStateText = styled.p`
      margin: 0;
      font-size: 1rem;
    `;

const AppointmentsSection = styled.section`
      margin-bottom: 3rem;
    `;

const AppointmentsGrid = styled.div`
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    `;

const AppointmentCard = styled.div<AppointmentCardProps>`
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      border-left: 4px solid ${props => props.$borderLeftColor};
      animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
      }
    `;

// Remove "Pending Verification" from status comparisons
const PaymentStatusBadge = styled.span<{ $paymentStatus: string }>`
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 600;
      background: ${props =>
    props.$paymentStatus === "Complete Payment" ? "#28a745" :
      props.$paymentStatus === "Pending Payment" ? "#ffc107" :
        props.$paymentStatus === "Failed" ? "#dc3545" :
          "#6c757d"
  };
      color: ${props =>
    props.$paymentStatus === "Pending Payment" ? "#212529" : "white"
  };
    `;
const ReferenceBadge = styled.span`
      padding: 0.2rem 0.4rem;
      border-radius: 8px;
      font-size: 0.6rem;
      font-weight: 500;
      background: #e3f2fd;
      color: #1976d2;
      border: 1px solid #bbdefb;
    `;

const RefundCard = styled.div<{ $delay: number; $status: string }>`
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      border-left: 4px solid ${props => refundStatusColor(props.$status)};
      animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
      }
    `;

const RefundHeader = styled.div`
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    `;

const RefundClient = styled.h4`
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #2c3e50;
    `;

const RefundStatus = styled.span<{ $status: string }>`
      padding: 0.25rem 0.75rem;
      border-radius: 15px;
      font-size: 0.75rem;
      font-weight: 600;
      background: ${props => refundStatusColor(props.$status)};
      color: white;
    `;

const RefundDetails = styled.div`
      margin-bottom: 1rem;
    `;

const RefundDetailRow = styled.div`
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    `;

const RefundLabel = styled.span`
      font-weight: 500;
      color: #7f8c8d;
    `;

const RefundValue = styled.span`
      color: #2c3e50;
      text-align: right;
    `;

const RefundReason = styled.div`
      margin-bottom: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
    `;

const RefundReasonText = styled.p`
      margin: 0.5rem 0 0 0;
      color: #2c3e50;
      font-size: 0.875rem;
      line-height: 1.4;
    `;

const AppointmentHeader = styled.div`
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    `;

const AppointmentDate = styled.span`
      font-weight: 600;
      color: #2c3e50;
    `;

const AppointmentTime = styled.span`
      font-size: 0.875rem;
      color: #7f8c8d;
      margin-bottom: 1rem;
      display: block;
    `;

const AppointmentDetails = styled.div`
      margin-bottom: 1rem;
    `;

const DetailRow = styled.div`
      display: flex;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    `;

const DetailLabel = styled.span`
      font-weight: 500;
      color: #7f8c8d;
      min-width: 80px;
    `;

const DetailValue = styled.span`
      color: #2c3e50;
      flex: 1;
    `;

const AppointmentActions = styled.div`
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 1rem;
      button {
        min-height: 36px;
        flex: 1;
        min-width: 80px;
      
        @media (max-width: 480px) {
          font-size: 0.7rem;
          padding: 0.4rem 0.6rem;
        }
      }
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
      props.$variant === "success" ? "#1cabe4" :
        props.$variant === "warning" ? "#e04b4b" :
          props.$variant === "danger" ? "#dc3545" :
            "#17a2b8"
  };
      color: ${props => props.$variant === "warning" ? "#212529" : "white"};
      position: relative;
      z-index: 1;
      pointer-events: auto !important;
      &:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      &:active {
        transform: translateY(0);
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    `;

const NoAppointments = styled.div`
      text-align: center;
      padding: 3rem;
      color: #7f8c8d;
      font-style: italic;
    `;

const MonthFilter = styled.div`
      display: flex;
      align-items: center;
      gap: 0.5rem;
    `;

const MonthSelect = styled.select`
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      font-size: 0.875rem;
    `;

const InfoRow = styled.div`
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      color: #2c3e50;
    `;

const UnavailableCard = styled.div<{ $delay: number }>`
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      gap: 1rem;
      animation: ${fadeInUp} 0.5s ease-out ${props => props.$delay}s both;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
      }
    `;
const UnavailableIcon = styled.div`
      font-size: 2rem;
      color: #e74c3c;
    `;
const UnavailableInfo = styled.div`
      flex: 1;
    `;
const UnavailableDate = styled.h4`
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #2c3e50;
    `;
const UnavailableDoctor = styled.p`
      margin: 0 0 0.25rem 0;
      font-size: 0.875rem;
      color: #7f8c8d;
    `;
const UnavailableTime = styled.p`
      margin: 0 0 0.25rem 0;
      font-size: 0.875rem;
      color: #7f8c8d;
    `;
const UnavailableStatus = styled.span`
      color: #e74c3c;
      font-weight: 600;
      font-size: 0.75rem;
    `;
const UnavailableActions = styled.div`
      display: flex;
      gap: 0.5rem;
    `;
const SettingsContainer = styled.div`
      max-width: 800px;
      margin: 0 auto;
    `;
const SettingsSection = styled.div`
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      margin-bottom: 2rem;
    `;
const SettingsSectionTitle = styled.h3`
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
    `;
const SettingsSectionDesc = styled.p`
      margin: 0 0 1.5rem 0;
      color: #7f8c8d;
      font-size: 0.875rem;
    `;
const TwoFactorCard = styled.div`
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
    `;
const TwoFactorStatus = styled.div`
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    `;
const StatusIndicator = styled.div<{ $enabled: boolean }>`
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${props => props.$enabled ? "#28a745" : "#dc3545"};
    `;
const StatusText = styled.span`
      font-weight: 500;
      color: #2c3e50;
    `;
const TwoFactorActions = styled.div`
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    `;
const EnableButton = styled.button`
      background: #28a745;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
      &:hover:not(:disabled) {
        background: #218838;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
const DisableButton = styled.button`
      background: #dc3545;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
      &:hover:not(:disabled) {
        background: #c82333;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
const CreateAccountButton = styled.button`
      background: #6b9cd1;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
      &:hover {
        background: #0056b3;
      }
    `;
const EmailInput = styled.input`
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      &:focus {
        outline: none;
        border-color: #3498db;
      }
      &:disabled {
        background: #f8f9fa;
        cursor: not-allowed;
      }
    `;

const OTPInput = styled.input`
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1.125rem;
      text-align: center;
      letter-spacing: 0.5rem;
      margin-bottom: 0.5rem;
      &:focus {
        outline: none;
        border-color: #3498db;
      }
      &:disabled {
        background: #f8f9fa;
        cursor: not-allowed;
      }
    `;
const ResendOTPText = styled.p`
      margin: 0;
      font-size: 0.75rem;
      color: #7f8c8d;
    `;
const ResendLink = styled.button`
      background: none;
      border: none;
      color: #3498db;
      cursor: pointer;
      text-decoration: underline;
      font-size: 0.75rem;
      &:hover:not(:disabled) {
        color: #2980b9;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
const InfoGrid = styled.div`
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    `;
const InfoItem = styled.div``;
const InfoLabel = styled.div`
      font-size: 0.875rem;
      color: #7f8c8d;
      margin-bottom: 0.25rem;
    `;
const InfoValue = styled.div`
      font-size: 1rem;
      color: #2c3e50;
      font-weight: 500;
    `;
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
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      animation: ${slideIn} 0.3s ease-out;
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
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
const FormGroup = styled.div`
      margin-bottom: 1.5rem;
    `;
const Label = styled.label`
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #2c3e50;
      font-size: 0.875rem;
    `;
const LoadingSpinnerSmall = styled.div`
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 0.5rem;
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
const PaymentVerificationSection = styled.div`
      margin-top: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #ffc107;
    `;
const VerificationTitle = styled.h4`
      margin: 0 0 0.5rem 0;
      color: #856404;
      font-size: 1rem;
      font-weight: 600;
    `;
const VerificationInstructions = styled.p`
      margin: 0 0 1rem 0;
      color: #856404;
      font-size: 0.875rem;
      line-height: 1.4;
    `;
const VerificationActions = styled.div`
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    `;
const StatusFlowContainer = styled.div`
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 2rem 0;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    `;
const StatusStep = styled.div<{ $active: boolean; $completed: boolean }>`
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
      opacity: ${props => props.$active || props.$completed ? 1 : 0.5};
      transition: all 0.3s ease;
      &:not(:last-child) {
        position: relative;
        &::after {
          content: '';
          position: absolute;
          top: 20px;
          right: -50%;
          width: 100%;
          height: 2px;
          background: ${props => props.$completed ? '#34B89C' : props.$active ? '#fd7e14' : '#ddd'};
          z-index: 1;
        }
      }
    `;
const StepNumber = styled.div<{ $active: boolean; $completed: boolean }>`
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${props =>
    props.$completed ? '#28a745' :
      props.$active ? '#fd7e14' : '#ddd'};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-bottom: 0.5rem;
      z-index: 2;
    `;
const StepTitle = styled.h4`
      margin: 0 0 0.25rem 0;
      color: #2c3e50;
      font-size: 0.875rem;
      font-weight: 600;
    `;
const StepDescription = styled.p`
      margin: 0;
      color: #7f8c8d;
      font-size: 0.75rem;
    `;
export const metadata: Metadata = {
  title: 'User Dashboard - RL Clinic',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
};
// Add these styled components with your other styled components

const CalendarGrid = styled.div`
      display: flex;
      flex-direction: column;
      gap: 2rem;
    `;

const StatusSummary = styled.div`
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      flex-wrap: wrap;
    `;

const StatusSummaryItem = styled.div`
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #2c3e50;
      font-weight: 500;
    `;

const StatusDot = styled.div<{ $color: string }>`
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${props => props.$color};
    `;

const CompletedInfo = styled.div`
      padding: 0.5rem;
      background: #e8f5e8;
      color: #2e7d32;
      border-radius: 6px;
      font-size: 0.75rem;
      text-align: center;
      font-weight: 500;
    `;

const CancelledInfo = styled.div`
      padding: 0.5rem;
      background: #ffebee;
      color: #c62828;
      border-radius: 6px;
      font-size: 0.75rem;
      text-align: center;
      font-weight: 500;
    `;
// Add these styled components
const CalendarNavigation = styled.div`
      display: flex;
      align-items: center;
      gap: 1rem;
      background: white;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

const NavButton = styled.button`
      background: #3498db;
      color: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: bold;
      font-size: 1.125rem;
      transition: all 0.2s;
      
      &:hover {
        background: #2980b9;
        transform: scale(1.05);
      }
      
      &:active {
        transform: scale(0.95);
      }
    `;

const CurrentDateDisplay = styled.div`
      font-size: 1.125rem;
      font-weight: 600;
      color: #2c3e50;
      min-width: 250px;
      text-align: center;
    `;

const QuickDateNavigation = styled.div`
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

const QuickDateTitle = styled.span`
      font-weight: 600;
      color: #2c3e50;
      font-size: 0.875rem;
    `;

const QuickDateButtons = styled.div`
      display: flex;
      gap: 0.5rem;
    `;

const QuickDateButton = styled.button<{ $active?: boolean }>`
      background: ${props => props.$active ? '#3498db' : 'white'};
      color: ${props => props.$active ? 'white' : '#2c3e50'};
      border: 1px solid ${props => props.$active ? '#3498db' : '#ddd'};
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
      
      &:hover {
        background: ${props => props.$active ? '#2980b9' : '#f8f9fa'};
        border-color: ${props => props.$active ? '#2980b9' : '#3498db'};
      }
    `;

const UnavailableReason = styled.p`
  margin: 0.5rem 0;
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #2c3e50;
  background: #fff3cd;
  border-left: 3px solid #ffc107;
  border-radius: 4px;
  line-height: 1.4;
`;
export default Admindashboard;
