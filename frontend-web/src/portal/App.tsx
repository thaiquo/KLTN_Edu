/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  Users,
  HelpCircle,
  UserCheck
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

import {
  UserRole,
  StudentRequest,
  ScheduleItem,
  Conversation,
  SystemUser,
  AppProfileSettings
} from "./types";

import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TutorDashboard } from "./components/TutorDashboard";
import { MessagesView } from "./components/MessagesView";
import { ProfileSettings } from "./components/ProfileSettings";
import { AdminPortal } from "./components/AdminPortal";
import { TutorApprovalPanel } from "./components/TutorApprovalPanel";
import { TutorAvailabilityScheduler } from "./components/TutorAvailabilityScheduler";
import { TutorClassManagement } from "./components/TutorClassManagement";
import { AdminClassManagement } from "./components/staff/AdminClassManagement";
import { TeachingCatalogManagement } from "./components/staff/TeachingCatalogManagement";
import { EscrowContractsView } from "../components/contract/EscrowContractsView";
import { DisputeManagementPanel } from "../components/contract/DisputeManagementPanel";
import { MyWalletView } from "./components/MyWalletView";
import { TutorRestrictedHome } from "./components/TutorRestrictedHome";
import { TeachingRegistrationPage } from "../pages/tutor/TeachingRegistrationPage";
import { useFeedback } from "../components/feedback/useFeedback";
import { useTutorApplication } from "../hooks/useTutorApplication";
import { StudentRequestsView } from "./components/StudentRequestsView";
import { TutorSessionManagement } from "./components/TutorSessionManagement";
import { StudentClassManagement } from "./components/StudentClassManagement";

// High Resolution course and avatar placeholders
const studentAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBYfodNBlGcqTaAKMNzNGEaAOg2AUygYGk8XYUF-_NxGI0SZ75MJgFNJvnmJOrkWem-SdVi53mp7A_Wnz4MmsG2XPHrfEQDt4ZmgHzGQFPvWonX1v39Fb71Q5zdulTudkDaMij4Xw9Q4Y57T8jqjnkI-7mohDZBerRX-WeA0xJNdv_gXWnBJu5hwIMtOWgoxSaYkJWwoQhgaRZss0L-r-SwS2c2dlRlQPWBtoeTCIDIR_sv_jgEgBVf97PjoOk6KVZHKS6VAf0II9GY";
const tutorAvatar1 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDRu0OVaIcgue-YXnknr5dY-iLecwj2hXTJCP1BwuiISehZGksR-kfcE_isqtt_tihIolfeslpHxKMuBXKWj1CNOEPPXE_SPy1rX-sqbLCrxHwNk54BB6KmaV1A8q0s1sJ39bCu88RA6dgS87wdrEjUcCdlGfQpH1lyt7fPWk1MpWLgNUnqX6eD_VwF8ubV_scELBg1jr2mgcQQpc6kljNIC1fqkJIH5NcJ_m80UfxpT4VhjTp7Mzbtq_sbr1Y9F-IfTdEIHvnvFyaN";
const tutorAvatar2 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBhwW3n6U0eBWTDne_iulj_Auj40EVPpMpQb_Ty2AmFqUqnCNtOtcugJcmoz3Wqy5667xVuLljO9Q7wnie5Nlxc0xfVQ4EW-BkKrLtK7ulPXjCY2tNCUPRksiYJkTTOuRQi4l12qR7vruVIbGkokyxG2U5HamxYV8xTj2EAiBram-_YsKG4hlqzbt1VQGJIZcsEI-_LymkavkzmdrrbDSNe1lBDVhtMVZJxmhimVQREO5_faCg4la-rGcz9tzLq9zH_bWjSEgA-qwnm";

const INITIAL_REQUESTS: StudentRequest[] = [
  {
    id: "req-1",
    studentName: "Nguyễn Minh Anh",
    avatarChar: "JD",
    avatarColor: "bg-teal-700",
    subject: "Giải tích nâng cao",
    requestedDate: "Oct 24, 2023",
    status: "pending",
  },
  {
    id: "req-2",
    studentName: "Trần Ngọc Mai",
    avatarChar: "SR",
    avatarColor: "bg-emerald-700",
    subject: "Sinh học phân tử",
    requestedDate: "Oct 25, 2023",
    status: "pending",
  },
  {
    id: "req-3",
    studentName: "Lê Minh Trí",
    avatarChar: "LM",
    avatarColor: "bg-indigo-700",
    subject: "Vật lý lượng tử",
    requestedDate: "Oct 26, 2023",
    status: "pending",
  },
];

const INITIAL_SCHEDULE: ScheduleItem[] = [
  {
    id: "sch-1",
    time: "09:00",
    period: "AM",
    title: "Buổi học Giải tích II",
    detailType: "students",
    detailValue: "12 học viên đã đăng ký",
    status: "active",
  },
  {
    id: "sch-2",
    time: "13:30",
    period: "PM",
    title: "Học 1-1: Nguyễn Hoàng",
    detailType: "virtual",
    detailValue: "Phòng học trực tuyến B",
    status: "active",
  },
  {
    id: "sch-3",
    time: "16:00",
    period: "PM",
    title: "Giờ hỗ trợ",
    detailType: "location",
    detailValue: "Phòng 4B",
    status: "past",
  },
];

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "vance",
    partnerName: "Dr. Julian Vance",
    partnerAvatar: tutorAvatar2,
    partnerRole: "Mathematics Department Head",
    lastMessage: "I found those composite derivatives pretty tricky.",
    lastMessageTime: "12:45 PM",
    unreadCount: 0,
    isOnline: true,
    messages: [
      {
        id: "m-1",
        sender: "partner",
        text: "Hello Alex! I've just reviewed your latest calculus assignment on composition of functions. You scored a solid 94%!",
        timestamp: "12:30 PM",
      },
      {
        id: "m-2",
        sender: "partner",
        text: "I have some extra notes on how to apply the Chain Rule without making standard bracket typos. I am attaching a PDF practice sheet below.",
        timestamp: "12:32 PM",
        attachments: [
          {
            name: "Calculus_ChainRule_Adv.pdf",
            size: "1.2 MB",
            type: "pdf",
          },
        ],
      },
      {
        id: "m-3",
        sender: "user",
        text: "That sounds perfect, Dr. Vance! I found those composite derivatives pretty tricky during the exam.",
        timestamp: "12:42 PM",
      },
      {
        id: "m-4",
        sender: "user",
        text: "Thanks, I will download the sheet now to practice.",
        timestamp: "12:45 PM",
      },
    ],
  },
  {
    id: "jenkins",
    partnerName: "Dr. Sarah Jenkins",
    partnerAvatar: tutorAvatar1,
    partnerRole: "AI Lead Researcher",
    lastMessage: "Let me check the prompt engineering curriculum.",
    lastMessageTime: "Yesterday",
    unreadCount: 2,
    isOnline: false,
    messages: [
      {
        id: "m-5",
        sender: "partner",
        text: "Hello, have you had a chance to work with the NLP modules yet?",
        timestamp: "Yesterday",
      },
    ],
  },
];

const INITIAL_SYSTEM_USERS: SystemUser[] = [
  {
    id: "u-1",
    name: "Alex Thompson",
    email: "alex.thompson@university.edu",
    role: "Student",
    joinedDate: "Oct 12, 2023",
    status: "Active",
    avatarUrl: studentAvatar,
  },
  {
    id: "u-2",
    name: "Dr. Sarah Jenkins",
    email: "s.jenkins@academy.org",
    role: "Tutor",
    joinedDate: "Sep 05, 2023",
    status: "Active",
    avatarUrl: tutorAvatar1,
  },
  {
    id: "u-3",
    name: "Liam Sterling",
    email: "l.sterling@coll.edu",
    role: "Student",
    joinedDate: "Oct 24, 2023",
    status: "Active",
    avatarUrl: studentAvatar,
  },
  {
    id: "u-4",
    name: "Mark Vance",
    email: "m.vance@university.edu",
    role: "Tutor",
    joinedDate: "Oct 20, 2023",
    status: "Pending",
    avatarUrl: tutorAvatar2,
  },
  {
    id: "u-5",
    name: "Jessica Miller",
    email: "j.miller@educonnect.com",
    role: "Admin",
    joinedDate: "Aug 15, 2023",
    status: "Active",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBhwW3n6U0eBWTDne_iulj_Auj40EVPpMpQb_Ty2AmFqUqnCNtOtcugJcmoz3Wqy5667xVuLljO9Q7wnie5Nlxc0xfVQ4EW-BkKrLtK7ulPXjCY2tNCUPRksiYJkTTOuRQi4l12qR7vruVIbGkokyxG2U5HamxYV8xTj2EAiBram-_YsKG4hlqzbt1VQGJIZcsEI-_LymkavkzmdrrbDSNe1lBDVhtMVZJxmhimVQREO5_faCg4la-rGcz9tzLq9zH_bWjSEgA-qwnm",
  },
];

const INITIAL_PROFILE_SETTINGS: AppProfileSettings = {
  fullName: "Alex Thompson",
  email: "alex.thompson@university.edu",
  phoneNumber: "+1 (555) 000-1234",
  gender: "Male",
  educationLevel: "Undergraduate",
  availableTime: "Afternoons (12PM - 5PM)",
  physicalAddress: "123 Academic Drive, Knowledge Park, Boston, MA 02115",
  profileStrength: 85,
  status: "none",
};

const ENROLLMENTS_DATA = [
  { name: "AI Tech", students: 120 },
  { name: "Web Dev", students: 240 },
  { name: "Finance", students: 85 },
  { name: "Physics", students: 45 },
];

const FULL_TUTOR_PAGE_IDS = new Set([
  "dashboard",
  "subjects",
  "my-classes",
  "class-management",
  "contracts",
  "wallet",
  "requests",
  "messages",
  "schedule",
  "complaints"
]);

interface PortalUser {
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  currentRole?: UserRole;
}

interface AppProps {
  user: PortalUser;
  onLogout: () => void;
}

export default function App({ user, onLogout }: AppProps) {
  const feedback = useFeedback();
  // Global States holding data consistently across tabs
  const [activeRole] = useState<UserRole>(user.currentRole || user.role || "student");
  const [currentPage, setCurrentPage] = useState<string>(() => {
    return activeRole === "staff" ? "tutor-approval" : "dashboard";
  });
  const [searchValue, setSearchValue] = useState("");

  // Custom mock database tables binded in React
  const [requests, setRequests] = useState<StudentRequest[]>(INITIAL_REQUESTS);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(INITIAL_SCHEDULE);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_SYSTEM_USERS);
  const [profileSettings, setProfileSettings] = useState<AppProfileSettings>({
    ...INITIAL_PROFILE_SETTINGS,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phone || '',
  });

  const [activeConversationId, setActiveConversationId] = useState<string>("vance");
  const [settingsTab, setSettingsTab] = useState<"info" | "password">("info");
  const {
    data: tutorApplication,
    isLoading: tutorApplicationLoading,
    isFetching: tutorApplicationFetching
  } = useTutorApplication({
    enabled: activeRole === "tutor"
  });

  const tutorApplicationStatus = activeRole === "tutor" ? tutorApplication?.status || null : null;
  const restrictedTutor = activeRole === "tutor" && (tutorApplicationLoading || tutorApplicationFetching || tutorApplicationStatus !== "APPROVED");
  const fullTutorAccess = activeRole === "tutor" && !restrictedTutor;

  const handleNavigate = React.useCallback((page: string) => {
    if (page === "settings-password") {
      setSettingsTab("password");
      setCurrentPage("settings");
      return;
    }

    if (page === "settings") {
      setSettingsTab("info");
    }

    if (restrictedTutor && FULL_TUTOR_PAGE_IDS.has(page)) {
      setCurrentPage("dashboard");
      return;
    }

    setCurrentPage(page);
  }, [restrictedTutor]);

  useEffect(() => {
    if (restrictedTutor && FULL_TUTOR_PAGE_IDS.has(currentPage) && currentPage !== "dashboard") {
      setCurrentPage("dashboard");
    }
  }, [currentPage, restrictedTutor]);

  // Interaction handlers
  const handleStartSession = () => {
    feedback.info("Phòng học trực tuyến sẽ được kết nối khi module video/audio thật sẵn sàng.");
  };

  // Messages handlers
  const handleSendMessage = (conversationId: string, text: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          const newMsg = {
            id: Date.now().toString(),
            sender: "user" as const,
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          return {
            ...c,
            lastMessage: text,
            lastMessageTime: newMsg.timestamp,
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );
  };

  // Tutor specific handlers
  const handleAcceptRequest = (id: string) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" as const } : r)));
    // Append to schedule or students list!
    const target = requests.find((r) => r.id === id);
    if (target) {
      const newSch: ScheduleItem = {
        id: `sch-${Date.now()}`,
        time: "11:00",
        period: "AM",
        title: `1-on-1: ${target.studentName}`,
        detailType: "virtual",
        detailValue: `Virtual Room - ${target.subject}`,
        status: "active",
      };
      setSchedule((prev) => [...prev, newSch]);
    }
  };

  const handleRejectRequest = (id: string) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r)));
  };

  // Admin specific CRUD handlers
  const handleAddUser = (user: Omit<SystemUser, "id" | "joinedDate">) => {
    const newUser: SystemUser = {
      ...user,
      id: `u-${Date.now()}`,
      joinedDate: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    };
    setUsers((prev) => [...prev, newUser]);
  };

  const handleUpdateUser = (updatedUser: SystemUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // Main Page Router switch board
  const renderMainContent = () => {
    if (activeRole === "tutor" && restrictedTutor && FULL_TUTOR_PAGE_IDS.has(currentPage)) {
      return (
        <TutorRestrictedHome
          onNavigate={handleNavigate}
        />
      );
    }

    switch (currentPage) {
      case "dashboard":
        if (activeRole === "tutor") {
          return (
            <TutorDashboard
              userName={user.fullName}
              requests={requests}
              schedule={schedule}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
              onNavigate={handleNavigate}
            />
          );
        } else if (activeRole === "admin") {
          return <AdminPortal />;
        } else if (activeRole === "staff") {
          return <TutorApprovalPanel />;
        }
        return null;

      case "courses":
        return activeRole === "student" ? (
          <StudentClassManagement />
        ) : (
          activeRole === "tutor" ? <TutorClassManagement /> : <AdminClassManagement activeRole={activeRole} />
        );

      case "messages":
        return (
          <MessagesView
            conversations={conversations}
            onSendMessage={handleSendMessage}
            activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
          />
        );

      case "settings":
        return <ProfileSettings settings={profileSettings} onSaveSettings={setProfileSettings} activeRole={activeRole} initialTab={settingsTab} onQuickNavigate={handleNavigate} />;

      case "subjects":
        return fullTutorAccess ? <TeachingRegistrationPage embedded={true} /> : null;

      case "contracts":
        return <EscrowContractsView activeRole={activeRole} userEmail={user.email} />;

      case "wallet":
        return activeRole === "tutor"
          ? <MyWalletView activeRole="tutor" userEmail={user.email} />
          : null;

      case "tutor-approval":
        return <TutorApprovalPanel />;

      case "complaints":
        return <DisputeManagementPanel activeRole={activeRole} userEmail={user.email} />;

      case "reports":
        return (
          <div className="mx-auto max-w-3xl border border-brand-border/30 bg-white p-10 text-center shadow-sm">
            <HelpCircle className="mx-auto mb-4 h-10 w-10 text-[#ff695f]" />
            <h3 className="font-display text-lg font-black text-brand-text">Module nghiệp vụ đang được chuẩn bị</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-brand-text-variant/70">
              Staff hiện tập trung vào duyệt hồ sơ gia sư và xử lý khiếu nại Smart Contract.
            </p>
          </div>
        );

      case "user-management":
        return <AdminPortal />;

      case "subject-catalog":
        return <TeachingCatalogManagement />;

      case "class-management":
        return activeRole === "tutor" ? <TutorClassManagement /> : <AdminClassManagement activeRole={activeRole} />;

      case "my-classes":
        return activeRole === "student" ? <StudentClassManagement onNavigate={handleNavigate} /> : <TutorClassManagement />;

      case "sessions":
        return <TutorSessionManagement />;

      case "requests":
        return <StudentRequestsView onNavigate={handleNavigate} />;

      case "schedule":
        return <TutorAvailabilityScheduler />;

      case "help":
        return (
          <div className="bg-white border border-brand-border/30 rounded-3xl p-8 max-w-3xl mx-auto my-8">
            <h3 className="font-display font-black text-lg text-brand-text uppercase tracking-wider mb-4 border-b border-brand-border/10 pb-2">
              EduConnect Help Desk
            </h3>
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-sm text-brand-text mb-1">How can I switch my active account workspace rules?</h4>
                <p className="text-xs text-brand-text-variant leading-relaxed">
                  Use the persistent role selection header (STUDENT / TUTOR / ADMIN) on the top right to instantly swap client settings.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-brand-text mb-1">How do I verify certifications or degrees?</h4>
                <p className="text-xs text-brand-text-variant leading-relaxed">
                  Navigate to User Settings &gt; Become Tutor, append certificates (AWS, IELTS) and upload pdf sheets. Administrators will instantly approve them in administrative view.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-surface text-brand-text selection:bg-brand-primary/10 select-none">
      {/* Dynamic Unified Header */}
      <Header
        activeRole={activeRole}
        user={user}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onNavigate={handleNavigate}
      />

      {/* Main Structural Frame Component */}
      <div className="pt-24 pl-80 pr-8 min-h-screen">
        <Sidebar
          activeRole={activeRole}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onStartSession={handleStartSession}
          onLogout={onLogout}
          restrictedTutor={restrictedTutor}
        />

        {/* Core Main View Container */}
        <main className="animate-fade-in relative">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}
