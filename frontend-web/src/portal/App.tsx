/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  MessageSquare,
  Calendar,
  Settings,
  Users,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  LogOut,
  PlayCircle,
  Video,
  Clock,
  Sparkles,
  TrendingUp,
  Award,
  VideoOff,
  UserCheck
} from "lucide-react";
import {
  LineChart,
  Line,
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
  Course,
  Conversation,
  SystemUser,
  AppProfileSettings
} from "./types";

import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TutorDashboard } from "./components/TutorDashboard";
import { Marketplace } from "./components/Marketplace";
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
    studentName: "James Dalton",
    avatarChar: "JD",
    avatarColor: "bg-teal-700",
    subject: "Advanced Calculus II",
    requestedDate: "Oct 24, 2023",
    status: "pending",
  },
  {
    id: "req-2",
    studentName: "Sarah Reed",
    avatarChar: "SR",
    avatarColor: "bg-emerald-700",
    subject: "Molecular Biology",
    requestedDate: "Oct 25, 2023",
    status: "pending",
  },
  {
    id: "req-3",
    studentName: "Leo Martinez",
    avatarChar: "LM",
    avatarColor: "bg-indigo-700",
    subject: "Quantum Physics",
    requestedDate: "Oct 26, 2023",
    status: "pending",
  },
];

const INITIAL_SCHEDULE: ScheduleItem[] = [
  {
    id: "sch-1",
    time: "09:00",
    period: "AM",
    title: "Calc II Workshop",
    detailType: "students",
    detailValue: "12 Students Registered",
    status: "active",
  },
  {
    id: "sch-2",
    time: "01:30",
    period: "PM",
    title: "1-on-1: Emily Chen",
    detailType: "virtual",
    detailValue: "Virtual Consultation Room B",
    status: "active",
  },
  {
    id: "sch-3",
    time: "04:00",
    period: "PM",
    title: "Office Hours",
    detailType: "location",
    detailValue: "Campus Hall Room 4B",
    status: "past",
  },
];

const INITIAL_COURSES: Course[] = [
  {
    id: "c-1",
    title: "Mastering AI Prompt Engineering for Business",
    tag: "Best Seller",
    tagColor: "bg-rose-50 text-rose-700 border-rose-100",
    tutorName: "Dr. Sarah Jenkins",
    tutorAvatar: tutorAvatar1,
    duration: "12h 30m total",
    studentCount: "1.5k students",
    price: 129.99,
    originalPrice: 189.99,
    coverImage: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80",
    isFavorite: true,
  },
  {
    id: "c-2",
    title: "Full Stack Web Dev with Next.js 14",
    tag: "New",
    tagColor: "bg-blue-50 text-blue-700 border-blue-100",
    tutorName: "Alex Rivera",
    tutorAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBYfodNBlGcqTaAKMNzNGEaAOg2AUygYGk8XYUF-_NxGI0SZ75MJgFNJvnmJOrkWem-SdVi53mp7A_Wnz4MmsG2XPHrfEQDt4ZmgHzGQFPvWonX1v39Fb71Q5zdulTudkDaMij4Xw9Q4Y57T8jqjnkI-7mohDZBerRX-WeA0xJNdv_gXWnBJu5hwIMtOWgoxSaYkJWwoQhgaRZss0L-r-SwS2c2dlRlQPWBtoeTCIDIR_sv_jgEgBVf97PjoOk6KVZHKS6VAf0II9GY",
    duration: "45h total",
    studentCount: "3k students",
    price: 149.99,
    originalPrice: 220.00,
    coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80",
    isFavorite: false,
  },
  {
    id: "c-3",
    title: "Corporate Leadership & Team Psychology",
    tag: "",
    tagColor: "",
    tutorName: "David Cohen",
    tutorAvatar: tutorAvatar2,
    duration: "8h intensive",
    studentCount: "500 students",
    price: 79.99,
    originalPrice: 99.99,
    coverImage: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
    isFavorite: false,
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

// Recharts Dummy Analytics Datasets for student / tutor / admin custom dashboards
const WEEKLY_HOURS_DATA = [
  { name: "Mon", hours: 4.5 },
  { name: "Tue", hours: 6.0 },
  { name: "Wed", hours: 3.5 },
  { name: "Thu", hours: 7.0 },
  { name: "Fri", hours: 5.0 },
  { name: "Sat", hours: 2.0 },
  { name: "Sun", hours: 1.5 },
];

const ENROLLMENTS_DATA = [
  { name: "AI Tech", students: 120 },
  { name: "Web Dev", students: 240 },
  { name: "Finance", students: 85 },
  { name: "Physics", students: 45 },
];

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
  const navigate = useNavigate();
  // Global States holding data consistently across tabs
  const [activeRole] = useState<UserRole>(user.currentRole || user.role || "student");
  const [currentPage, setCurrentPage] = useState<string>(activeRole === "staff" ? "tutor-approval" : "dashboard");
  const [searchValue, setSearchValue] = useState("");
  
  // Custom mock database tables binded in React
  const [requests, setRequests] = useState<StudentRequest[]>(INITIAL_REQUESTS);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(INITIAL_SCHEDULE);
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_SYSTEM_USERS);
  const [profileSettings, setProfileSettings] = useState<AppProfileSettings>({
    ...INITIAL_PROFILE_SETTINGS,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phone || '',
  });

  const [activeConversationId, setActiveConversationId] = useState<string>("vance");

  // Interaction handlers
  const handleStartSession = () => {
    alert("Launching EduConnect Peer Video/Audio Room 4B. Your camera and audio systems are online...");
  };

  // Student specific handlers
  const handleToggleFavoriteCourse = (id: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  };

  const handleTutorChat = (tutorId: string) => {
    // If we select Sarah Jenkins
    if (tutorId === "sarah-jenkins") {
      setActiveConversationId("jenkins");
    } else {
      setActiveConversationId("vance");
    }
    setCurrentPage("messages");
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
    switch (currentPage) {
      case "dashboard":
        if (activeRole === "tutor") {
          return (
            <TutorDashboard
              userName={user.fullName}
              requests={requests}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
              schedule={schedule}
              onNavigate={setCurrentPage}
            />
          );
        } else if (activeRole === "staff") {
          return <TutorApprovalPanel />;
        } else if (activeRole === "admin") {
          // Comprehensive ADMIN DASHBOARD layout compiling active graphs!
          const colors = ["#0058be", "#6b38d4", "#f43f5e", "#eab308"];
          const userStatusSummary = [
            { name: "Active", value: users.filter((u) => u.status === "Active").length },
            { name: "Pending", value: users.filter((u) => u.status === "Pending").length },
            { name: "Suspended", value: users.filter((u) => u.status === "Suspended").length },
          ];

          return (
            <div className="space-y-8 select-none font-sans max-w-7xl mx-auto">
              <div>
                <h2 className="font-display font-black text-2xl lg:text-3xl tracking-tight text-brand-text">
                  Administrative Analytics Overview
                </h2>
                <p className="text-brand-text-variant/60 text-sm mt-1">
                  Global data streams, license volumes and infrastructure safety parameters.
                </p>
              </div>

              {/* Advanced Bento Cards & Charts layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Chart 1: Enrollment stats */}
                <div className="bg-white p-6 rounded-3xl border border-brand-border/30 shadow-sm flex flex-col md:col-span-2">
                  <h3 className="font-display font-black text-xs uppercase text-brand-text-variant/50 tracking-wider mb-6">
                    Dynamic Enrollment Distribution
                  </h3>
                  <div className="h-64 select-none w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
                      <BarChart data={ENROLLMENTS_DATA}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="students" fill="#0058be" radius={[8, 8, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart Widget */}
                <div className="bg-white p-6 rounded-3xl border border-brand-border/30 shadow-sm flex flex-col">
                  <h3 className="font-display font-black text-xs uppercase text-brand-text-variant/50 tracking-wider mb-6">
                    Account Breakdown Status
                  </h3>
                  <div className="h-48 w-full select-none justify-center flex relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
                      <PieChart>
                        <Pie
                          data={userStatusSummary}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {userStatusSummary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center select-none font-display">
                      <p className="text-xl font-black text-brand-text leading-none">{users.length}</p>
                      <p className="text-[9px] font-bold text-brand-text-variant/50 uppercase tracing-wider mt-1">Users</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 text-[10px] font-bold font-display select-none uppercase tracking-wide pt-4">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-primary"></span>Active</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-secondary"></span>Pending</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Suspended</span>
                  </div>
                </div>

              </div>

              {/* Quick Actions Router cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div
                  onClick={() => setCurrentPage("user-management")}
                  className="bg-brand-low/50 hover:bg-brand-low border border-brand-border/30 p-6 rounded-3xl cursor-pointer transition-colors group"
                >
                  <Users className="w-8 h-8 text-brand-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-display font-black text-sm text-brand-text mb-1">
                    Manage Accounts
                  </h4>
                  <p className="text-xs text-brand-text-variant">
                    Control permissions, search names, edit status profiles and remove accounts.
                  </p>
                </div>

                <div
                  onClick={() => setCurrentPage("tutor-approval")}
                  className="bg-brand-low/50 hover:bg-brand-low border border-brand-border/30 p-6 rounded-3xl cursor-pointer transition-colors group"
                >
                  <UserCheck className="w-8 h-8 text-brand-secondary mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-display font-black text-sm text-brand-text mb-1">
                    Tutor Onboarding Approvals
                  </h4>
                  <p className="text-xs text-brand-text-variant">
                    Review academic AWS/IELTS transcripts and pending applications.
                  </p>
                </div>
              </div>

            </div>
          );
        } else {
          // Clean high-contrast Student Dashboard
          return (
            <div className="space-y-8 select-none font-sans max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="font-display font-black text-2xl lg:text-3xl tracking-tight text-brand-text">
                    Welcome back, {user.fullName}!
                  </h2>
                  <p className="text-brand-text-variant/60 text-sm mt-1">
                    You have 3 active study classes and 1 consultation scheduled for today.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentPage("courses")}
                  className="px-5 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-display font-black tracking-widest hover:bg-brand-primary/95 transition-all shadow-md shrink-0"
                >
                  EXPLORE MARKETPLACE
                </button>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Recharts Analytics: Weekly Study Hours */}
                <div className="bg-white p-6 rounded-3xl border border-brand-border/30 shadow-sm md:col-span-2">
                  <h3 className="font-display font-black text-xs uppercase text-brand-text-variant/50 tracking-wider mb-6">
                    Weekly Study Time Tracker
                  </h3>
                  <div className="h-64 select-none w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
                      <LineChart data={WEEKLY_HOURS_DATA}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="hours"
                          stroke="#0058be"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Profile Strengths Indicator & launch cards */}
                <div className="bg-brand-secondary text-white p-8 rounded-3xl shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10 space-y-4">
                    <span className="bg-white/15 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      Premium Pass Active
                    </span>
                    <h3 className="font-display font-black text-xl leading-snug">
                      Schedule 1-on-1 calls with Ivy-League tutors
                    </h3>
                  </div>
                  <div className="pt-8 relative z-10">
                    <button
                      onClick={handleStartSession}
                      className="px-5 py-2.5 bg-white text-brand-secondary font-black text-xs font-display tracking-widest rounded-xl hover:-translate-y-0.5 active:translate-y-0 transition-transform shadow-md"
                    >
                      DIAL TUTOR ROOM
                    </button>
                  </div>
                  <Award className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12 shrink-0 pointer-events-none" />
                </div>

              </div>

              {/* Favorite Courses & schedule shortcuts row */}
              <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm">
                <h3 className="font-display font-black text-base text-brand-text mb-4">
                  My Live Subscriptions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.filter((c) => c.isFavorite).map((course) => (
                    <div
                      key={course.id}
                      className="p-4 border border-brand-border/20 rounded-2xl flex gap-3 hover:border-brand-primary transition-colors"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                        <img
                          className="w-full h-full object-cover"
                          src={course.coverImage}
                          alt={course.title}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1 select-none">
                        <h4 className="font-bold text-brand-text text-xs truncate leading-snug">
                          {course.title}
                        </h4>
                        <p className="text-[11px] text-brand-text-variant/60 font-semibold mt-1">
                          {course.tutorName}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-brand-text-variant/40 uppercase tracking-wider font-bold mt-2 font-display">
                          <Clock className="w-3.5 h-3.5" />
                          {course.duration}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        }

      case "courses":
        return (
          <Marketplace
            courses={courses}
            onToggleFavorite={handleToggleFavoriteCourse}
            onTutorChat={handleTutorChat}
            searchTerm={searchValue}
          />
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
        return <ProfileSettings settings={profileSettings} onSaveSettings={setProfileSettings} activeRole={activeRole} />;

      case "contracts":
        return <EscrowContractsView activeRole={activeRole} userEmail={user.email} />;

      case "wallet":
        return activeRole === "student" || activeRole === "tutor"
          ? <MyWalletView />
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
        return <TutorClassManagement />;

      case "requests":
        return (
          <div className="space-y-6 select-none font-sans max-w-5xl mx-auto pb-10">
            <h2 className="font-display font-black text-xl lg:text-2xl text-brand-text">
              Active Student Lecture Requests
            </h2>
            <div className="bg-white border border-brand-border/30 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <tbody className="divide-y divide-brand-border/10 font-semibold text-xs">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-low/40">
                      <td className="px-6 py-4 font-bold">{r.studentName}</td>
                      <td className="px-6 py-4 text-brand-text-variant">{r.subject}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : r.status === "rejected"
                            ? "bg-brand-error/5 text-brand-error border-brand-error/10"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

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
      />

      {/* Main Structural Frame Component */}
      <div className="pt-24 pl-80 pr-8 min-h-screen">
        <Sidebar
          activeRole={activeRole}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onStartSession={handleStartSession}
          onLogout={onLogout}
        />

        {/* Core Main View Container */}
        <main className="animate-fade-in relative">
          {renderMainContent()}
        </main>
      </div>

    </div>
  );
}
