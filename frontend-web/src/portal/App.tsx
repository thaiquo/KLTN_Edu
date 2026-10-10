/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { TutorHomeworkManagement } from "./components/TutorHomeworkManagement";
import { StudentClassManagement } from "./components/StudentClassManagement";
import { AdminFinanceMonitoring } from "./components/AdminFinanceMonitoring";
import { CommunityFeedPage } from "../pages/community/CommunityFeedPage";
import { TutorCommunityManagement } from "./components/TutorCommunityManagement";
import { StudentCommunityManagement } from "./components/StudentCommunityManagement";

// High Resolution course and avatar placeholders
const studentAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBYfodNBlGcqTaAKMNzNGEaAOg2AUygYGk8XYUF-_NxGI0SZ75MJgFNJvnmJOrkWem-SdVi53mp7A_Wnz4MmsG2XPHrfEQDt4ZmgHzGQFPvWonX1v39Fb71Q5zdulTudkDaMij4Xw9Q4Y57T8jqjnkI-7mohDZBerRX-WeA0xJNdv_gXWnBJu5hwIMtOWgoxSaYkJWwoQhgaRZss0L-r-SwS2c2dlRlQPWBtoeTCIDIR_sv_jgEgBVf97PjoOk6KVZHKS6VAf0II9GY";
const tutorAvatar1 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDRu0OVaIcgue-YXnknr5dY-iLecwj2hXTJCP1BwuiISehZGksR-kfcE_isqtt_tihIolfeslpHxKMuBXKWj1CNOEPPXE_SPy1rX-sqbLCrxHwNk54BB6KmaV1A8q0s1sJ39bCu88RA6dgS87wdrEjUcCdlGfQpH1lyt7fPWk1MpWLgNUnqX6eD_VwF8ubV_scELBg1jr2mgcQQpc6kljNIC1fqkJIH5NcJ_m80UfxpT4VhjTp7Mzbtq_sbr1Y9F-IfTdEIHvnvFyaN";
const tutorAvatar2 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBhwW3n6U0eBWTDne_iulj_Auj40EVPpMpQb_Ty2AmFqUqnCNtOtcugJcmoz3Wqy5667xVuLljO9Q7wnie5Nlxc0xfVQ4EW-BkKrLtK7ulPXjCY2tNCUPRksiYJkTTOuRQi4l12qR7vruVIbGkokyxG2U5HamxYV8xTj2EAiBram-_YsKG4hlqzbt1VQGJIZcsEI-_LymkavkzmdrrbDSNe1lBDVhtMVZJxmhimVQREO5_faCg4la-rGcz9tzLq9zH_bWjSEgA-qwnm";

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
  "homework",
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
  const [searchParams, setSearchParams] = useSearchParams();
  // Global States holding data consistently across tabs
  const [activeRole] = useState<UserRole>(user.currentRole || user.role || "student");
  const requestedTab = searchParams.get("tab");
  const [currentPage, setCurrentPage] = useState<string>(() => {
    if (requestedTab) return requestedTab;
    return activeRole === "staff" ? "tutor-approval" : "dashboard";
  });
  const [searchValue, setSearchValue] = useState("");

  // Custom mock database tables binded in React
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_SYSTEM_USERS);
  const [profileSettings, setProfileSettings] = useState<AppProfileSettings>({
    ...INITIAL_PROFILE_SETTINGS,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phone || '',
  });

  const [settingsTab, setSettingsTab] = useState<"info" | "password">("info");
  const {
    data: tutorApplication,
    isLoading: tutorApplicationLoading,
    isFetching: tutorApplicationFetching
  } = useTutorApplication({
    enabled: activeRole === "tutor"
  });

  const tutorApplicationStatus = activeRole === "tutor" ? tutorApplication?.status || null : null;
  const tutorAccessPending = activeRole === "tutor" && (tutorApplicationLoading || tutorApplicationFetching);
  const restrictedTutor = activeRole === "tutor" && !tutorAccessPending && tutorApplicationStatus !== "APPROVED";
  const fullTutorAccess = activeRole === "tutor" && !restrictedTutor;

  useEffect(() => {
    if (requestedTab && requestedTab !== currentPage) {
      if (!restrictedTutor || !FULL_TUTOR_PAGE_IDS.has(requestedTab)) {
        setCurrentPage(requestedTab);
      }
    }
  }, [requestedTab, restrictedTutor]);

  const handleNavigate = React.useCallback((page: string) => {
    if (page === "settings-password") {
      setSettingsTab("password");
      setCurrentPage("settings");
      setSearchParams({ tab: "settings" });
      return;
    }

    if (page === "settings") {
      setSettingsTab("info");
    }

    if (restrictedTutor && FULL_TUTOR_PAGE_IDS.has(page)) {
      setCurrentPage("dashboard");
      setSearchParams({ tab: "dashboard" });
      return;
    }

    setCurrentPage(page);
    setSearchParams({ tab: page });
  }, [restrictedTutor, setSearchParams]);

  useEffect(() => {
    if (restrictedTutor && FULL_TUTOR_PAGE_IDS.has(currentPage) && currentPage !== "dashboard") {
      setCurrentPage("dashboard");
      setSearchParams({ tab: "dashboard" });
    }
  }, [currentPage, restrictedTutor, setSearchParams]);

  // Interaction handlers
  const handleStartSession = () => {
    feedback.info("Phòng học trực tuyến sẽ được kết nối khi module video/audio thật sẵn sàng.");
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
              onNavigate={handleNavigate}
            />
          );
        } else if (activeRole === "admin") {
          return <AdminPortal />;
        } else if (activeRole === "staff") {
          return <TutorApprovalPanel />;
        }
        return null;

      case "admin-finance":
        return <AdminFinanceMonitoring />;

      case "courses":
        return activeRole === "student" ? (
          <StudentClassManagement />
        ) : (
          activeRole === "tutor" ? <TutorClassManagement /> : <AdminClassManagement activeRole={activeRole} />
        );

      case "messages":
        return <MessagesView />;

      case "settings":
        return <ProfileSettings settings={profileSettings} onSaveSettings={setProfileSettings} activeRole={activeRole} initialTab={settingsTab} onQuickNavigate={handleNavigate} />;

      case "community":
        return activeRole === "tutor"
          ? <TutorCommunityManagement onNavigate={handleNavigate} />
          : <StudentCommunityManagement onNavigate={handleNavigate} />;

      case "subjects":
        return fullTutorAccess ? <TeachingRegistrationPage embedded={true} /> : null;

      case "contracts":
        return <EscrowContractsView activeRole={activeRole} userEmail={user.email} onNavigate={handleNavigate} />;

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

      case "homework":
        return <TutorHomeworkManagement onNavigate={handleNavigate} />;

      case "sessions":
        return <TutorSessionManagement />;

      case "requests":
        return <StudentRequestsView onNavigate={handleNavigate} />;

      case "schedule":
        return <TutorAvailabilityScheduler onNavigate={handleNavigate} />;

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
