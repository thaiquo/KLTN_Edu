/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { HomeHeader } from "../components/home/HomeHeader";
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
        sender: "user",
        text: "Thank you Dr. Vance! I spent a good chunk of time on the chain rule applications.",
        timestamp: "12:35 PM",
      },
      {
        id: "m-3",
        sender: "partner",
        text: "It clearly paid off. Are you ready for our interactive workshop tomorrow morning?",
        timestamp: "12:40 PM",
      },
      {
        id: "m-4",
        sender: "user",
        text: "Yes, I'll be in Virtual Consultation Room B at 09:00 AM.",
        timestamp: "12:42 PM",
      },
    ],
  },
  {
    id: "jenkins",
    partnerName: "Dr. Sarah Jenkins",
    partnerAvatar: tutorAvatar1,
    partnerRole: "AI Research Lead",
    lastMessage: "Hello, have you had a chance to work with the NLP modules yet?",
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
  availableTime: "15 Hours / Week",
  physicalAddress: "Los Angeles, CA",
  profileStrength: 85,
  status: "none",
};

// Analytics Mock Datasets
const PERFORMANCE_DATA = [
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
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");

  // Global States holding data consistently across tabs
  const [activeRole] = useState<UserRole>(user.currentRole || user.role || "student");
  const [currentPage, setCurrentPage] = useState<string>(() => {
    if (tabParam) return tabParam;
    return activeRole === "staff" ? "tutor-approval" : "dashboard";
  });
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (tabParam) {
      setCurrentPage(tabParam);
    }
  }, [tabParam]);
  
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

  // Render view engine
  const renderMainContent = () => {
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
              onNavigate={setCurrentPage}
            />
          );
        } else if (activeRole === "admin") {
          return <AdminPortal />;
        } else if (activeRole === "staff") {
          return <TutorApprovalPanel />;
        } else {
          // Student Dashboard View
          return (
            <div className="space-y-8 animate-fade-in font-sans">
              
              {/* Dynamic Welcome Hero Panel */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-primary via-indigo-700 to-brand-secondary p-8 text-white shadow-xl shadow-brand-primary/10">
                <div className="relative z-10 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-widest text-brand-surface mb-4">
                    <Sparkles className="w-3.5 h-3.5 text-brand-secondary" />
                    EduConnect Fall Semester
                  </div>
                  <h2 className="font-display font-black text-2xl lg:text-3xl tracking-tight leading-tight">
                    Welcome back, {user.fullName}! 
                  </h2>
                  <p className="mt-2 text-brand-surface/80 text-sm font-medium leading-relaxed">
                    You have <span className="text-brand-secondary font-black underline decoration-2">2 live sessions</span> scheduled today. Your academic progress is trending up +14% compared to last week.
                  </p>
                  
                  <div className="mt-6 flex flex-wrap gap-4">
                    <button
                      onClick={() => setCurrentPage("schedule")}
                      className="px-5 py-2.5 bg-brand-surface text-brand-primary rounded-xl font-display font-black text-xs hover:bg-white transition-all shadow-md active:scale-95"
                    >
                      View Live Schedule
                    </button>
                    <button
                      onClick={() => setCurrentPage("courses")}
                      className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-display font-black text-xs transition-all backdrop-blur-md"
                    >
                      Explore New Courses
                    </button>
                  </div>
                </div>

                {/* Ambient Decorative Accents */}
                <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-brand-secondary/20 rounded-full blur-3xl pointer-events-none" />
              </div>

              {/* Quick KPIs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm hover:border-brand-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-brand-text-variant/60 uppercase font-display">Enrolled Classes</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-display font-black text-2xl text-brand-text mt-3">4 Courses</p>
                  <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> 2 active this term
                  </p>
                </div>

                <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm hover:border-brand-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-brand-text-variant/60 uppercase font-display">Weekly Study Time</span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-display font-black text-2xl text-brand-text mt-3">18.5 Hours</p>
                  <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> +2.5h from goal
                  </p>
                </div>

                <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm hover:border-brand-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-brand-text-variant/60 uppercase font-display">Completed Credits</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-display font-black text-2xl text-brand-text mt-3">32 Credits</p>
                  <p className="text-[11px] text-brand-text-variant/60 font-semibold mt-1">GPA: 3.84 / 4.0</p>
                </div>

                <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm hover:border-brand-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-brand-text-variant/60 uppercase font-display">Next Session</span>
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Video className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-display font-black text-lg text-brand-text mt-3 truncate">Calculus II</p>
                  <p className="text-[11px] text-rose-600 font-bold mt-1">Today, 01:30 PM</p>
                </div>
              </div>

              {/* Study Performance Visualizer & Upcoming schedule */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Performance Chart Column */}
                <div className="lg:col-span-2 bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-display font-black text-base text-brand-text">
                        Weekly Study Frequency
                      </h3>
                      <p className="text-xs text-brand-text-variant/60 font-medium mt-0.5">
                        Hours spent in lectures & 1-on-1 tutor rooms
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-brand-low rounded-lg text-xs font-bold text-brand-primary">
                      Oct 2023
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={PERFORMANCE_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            borderColor: "#334155",
                            borderRadius: "12px",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="hours"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: "#f59e0b" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Upcoming Live Sessions Column */}
                <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-display font-black text-base text-brand-text mb-1">
                      Today's Live Sessions
                    </h3>
                    <p className="text-xs text-brand-text-variant/60 font-medium mb-6">
                      Click room button when session time arrives
                    </p>

                    <div className="space-y-4">
                      {schedule.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="p-4 border border-brand-border/20 rounded-2xl bg-brand-low/30 hover:border-brand-primary/40 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-display font-black text-xs text-brand-primary">
                              {item.time} {item.period}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Confirmed
                            </span>
                          </div>
                          <p className="font-bold text-sm text-brand-text leading-tight">{item.title}</p>
                          <p className="text-xs text-brand-text-variant/60 font-medium mt-1">{item.detailValue}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleStartSession}
                    className="w-full mt-6 py-3 bg-brand-primary text-white rounded-xl font-display font-black text-xs flex items-center justify-center gap-2 hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20 active:scale-95"
                  >
                    <Video className="w-4 h-4" />
                    Enter Scheduled Room (4B)
                  </button>
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
        return activeRole === "student" ? (
          <StudentClassManagement />
        ) : (
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
          ? <MyWalletView activeRole={activeRole} userEmail={user?.email} />
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
        return activeRole === "student" ? <StudentClassManagement /> : <TutorClassManagement />;

      case "sessions":
        return <TutorSessionManagement />;

      case "requests":
        return <StudentRequestsView onNavigate={setCurrentPage} />;

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

  const isStudent = activeRole === "student";

  return (
    <div className="min-h-screen bg-brand-surface text-brand-text selection:bg-brand-primary/10 select-none">
      
      {/* Dynamic Unified Header */}
      {isStudent ? (
        <HomeHeader />
      ) : (
        <Header
          activeRole={activeRole}
          user={user}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
      )}

      {/* Main Structural Frame Component */}
      <div className={`pt-20 min-h-screen ${isStudent ? "px-6 max-w-7xl mx-auto" : "pl-80 pr-8"}`}>
        {!isStudent && (
          <Sidebar
            activeRole={activeRole}
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            onStartSession={handleStartSession}
            onLogout={onLogout}
          />
        )}

        {/* Core Main View Container */}
        <main className="animate-fade-in relative">
          {renderMainContent()}
        </main>
      </div>

    </div>
  );
}
