import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  Video,
  Users,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { classApi } from "../../api/classes";
import { contractsApi } from "../../api/contractsApi";
import { ClassSessionsTimeline } from "../../components/classroom/ClassSessionsTimeline";

export const StudentClassManagement: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadMyClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const studentEmail = (user.email || "").trim().toLowerCase();
      const studentId = user.id;
      const classMap = new Map<number, any>();

      // 1. Lấy từ Hợp đồng & Ký quỹ Escrow (Chính xác nhất theo ví & tiền cọc của Học viên)
      try {
        const contractsData = await contractsApi.listAgreements({
          role: "STUDENT",
          email: studentEmail,
          userId: studentId,
          size: 50
        });
        const agreements = Array.isArray(contractsData)
          ? contractsData
          : contractsData?.content || [];

        // Lọc nghiêm ngặt chỉ lấy các hợp đồng đúng của học viên này
        const myAgreements = agreements.filter((agr: any) => {
          const agrEmail = (agr.studentEmail || "").trim().toLowerCase();
          const agrId = agr.studentId;
          const matchEmail = studentEmail && agrEmail && agrEmail === studentEmail;
          const matchId = studentId && agrId && Number(agrId) === Number(studentId);
          return matchEmail || matchId;
        });

        for (const agr of myAgreements) {
          if (agr.classroomId) {
            try {
              const cls = await classApi.getPublicClassById(agr.classroomId);
              if (cls && cls.id) {
                classMap.set(cls.id, {
                  ...cls,
                  agreementId: agr.id,
                  agreementStatus: agr.status,
                  escrowDeposit: agr.totalAmountUsdc
                });
              }
            } catch {
              classMap.set(agr.classroomId, {
                id: agr.classroomId,
                name: agr.className || `Lớp học #${agr.classroomId}`,
                tutorFullName: agr.tutorName,
                tutorEmail: agr.tutorEmail,
                status: "ACTIVE",
                agreementId: agr.id,
                escrowDeposit: agr.totalAmountUsdc
              });
            }
          }
        }
      } catch (e) {
        console.warn("Could not load agreements for student:", e);
      }

      // 2. Lấy từ Danh sách yêu cầu ghi danh của riêng học viên này
      try {
        const requests = await classApi.getMyEnrollmentRequests();
        if (Array.isArray(requests)) {
          const myRequests = requests.filter((r: any) => {
            const reqEmail = (r.studentEmail || "").trim().toLowerCase();
            const matchEmail = studentEmail && reqEmail && reqEmail === studentEmail;
            const isAccepted = r.status === "ENROLLED" || r.status === "ACCEPTED";
            return matchEmail && isAccepted;
          });

          for (const req of myRequests) {
            if (req.classRoomId && !classMap.has(req.classRoomId)) {
              try {
                const cls = await classApi.getPublicClassById(req.classRoomId);
                if (cls && cls.id) {
                  classMap.set(cls.id, {
                    ...cls,
                    enrollmentStatus: req.status
                  });
                }
              } catch {
                classMap.set(req.classRoomId, {
                  id: req.classRoomId,
                  name: req.className || `Lớp học #${req.classRoomId}`,
                  tutorEmail: req.tutorEmail,
                  status: req.status,
                  enrollmentStatus: req.status
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn("Could not load enrollment requests for student:", e);
      }

      const list = Array.from(classMap.values());
      setClasses(list);
      if (list.length > 0) {
        // Chỉ chọn class đầu tiên nếu class hiện tại không nằm trong danh sách
        setSelectedClassId((prev) => (prev && classMap.has(prev) ? prev : list[0].id));
      } else {
        setSelectedClassId(null);
      }
    } catch (err: any) {
      console.error("Failed to load student classes:", err);
      setError("Không thể tải danh sách lớp học của bạn.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.email) {
      loadMyClasses();
    }
  }, [user?.email, loadMyClasses]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
              <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
              Không Gian Học Tập Trực Tuyến
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Lớp Học Của Tôi & Lịch Học Cuốn Chiếu
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl font-medium">
              Theo dõi lịch học theo tuần, điểm danh vào học 1 chạm trong khung giờ học, mở khóa bài tập và tham gia phòng học trực tuyến.
            </p>
          </div>

          {/* Quick stats badge */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-blue-200 font-semibold">Lớp Học Đã Tham Gia</div>
              <div className="text-xl font-black text-white">{classes.length} Lớp Học</div>
            </div>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      {/* 2. Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 text-sm font-semibold">Đang tải danh sách lớp học của bạn...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="text-rose-800 text-sm font-bold">{error}</p>
          <button
            onClick={loadMyClasses}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
          >
            Thử Lại
          </button>
        </div>
      ) : classes.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-3xl text-center">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Bạn chưa tham gia lớp học nào</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Khám phá các lớp học chất lượng cao từ các gia sư uy tín và đăng ký để bắt đầu lộ trình học tập.
          </p>
          <a
            href="/classes"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Khám Phá Tìm Lớp Ngay</span>
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Selector Tabs */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 px-3 uppercase tracking-wider shrink-0">
              Chọn Lớp Đang Học:
            </span>
            {classes.map((cls) => {
              const isSelected = cls.id === selectedClassId;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shrink-0 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  <span className="truncate max-w-[200px]">{cls.name || `Lớp học #${cls.id}`}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {cls.status || "ĐANG HỌC"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Class Info Header Card */}
          {selectedClass && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {selectedClass.registration?.subjectName || selectedClass.subjectName || "Môn học"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                      Gia sư: <b>{selectedClass.tutorFullName || selectedClass.tutorEmail || "Gia sư"}</b>
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{selectedClass.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{selectedClass.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Khai Giảng</span>
                    <span className="font-bold text-slate-800">{selectedClass.startDate || "Chưa có"}</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng Số Buổi</span>
                    <span className="font-bold text-slate-800">{selectedClass.totalSessions || 12} buổi</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">Hình Thức</span>
                    <span className="font-black text-emerald-800">
                      {selectedClass.learningMode === "OFFLINE" ? "Học Trực Tiếp (Offline)" : "Trực Tuyến (Google Meet)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sessions Timeline Component with Student Role */}
              <div className="mt-6">
                <ClassSessionsTimeline
                  classRoomId={selectedClass.id}
                  classRoomName={selectedClass.name}
                  meetingLink={selectedClass.meetingLink}
                  currentUserRole="STUDENT"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
