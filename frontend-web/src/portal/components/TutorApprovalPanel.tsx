import React, { useEffect, useState } from "react";
import { Award, BookOpen, CalendarDays, Check, FileText, LoaderCircle, RefreshCw, UserCheck, X } from "lucide-react";
import { tutorApplicationApi } from "../../api/tutorApplications";
import { LEVEL_GROUPS, SUBJECTS_BY_GROUP, TutorApplication, TutorTeachingSubject } from "../tutorApplication";
import { StatusBadge } from "./EvidenceUploader";

function subjectName(subject: TutorTeachingSubject) {
  return SUBJECTS_BY_GROUP[subject.levelGroupId]?.find((item) => item.id === subject.subjectId)?.name || subject.subjectId;
}

export function TutorApprovalPanel() {
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [applicationHistory, setApplicationHistory] = useState<TutorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [error, setError] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [pending, history] = await Promise.all([
        tutorApplicationApi.list(),
        tutorApplicationApi.history()
      ]);
      setApplications(pending);
      setApplicationHistory(history);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load tutor applications.");
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const intervalId = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  const reviewEvidence = async (profileId: string, subjectId: string, evidenceId: string, status: "approved" | "rejected") => {
    const key = `evidence-${evidenceId}`;
    setActionKey(key);
    try {
      const adminNote = status === "rejected" ? (window.prompt("Reason for rejecting this evidence:") || "") : "";
      if (status === "rejected" && !adminNote) return;
      await tutorApplicationApi.reviewEvidence(profileId, subjectId, evidenceId, { status, adminNote });
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review this evidence.");
    } finally {
      setActionKey("");
    }
  };

  const reviewSubject = async (profileId: string, subjectId: string, status: "approved" | "rejected") => {
    const key = `subject-${subjectId}`;
    setActionKey(key);
    try {
      const adminNote = status === "rejected" ? (window.prompt("Reason for rejecting this subject or tuition range:") || "") : "";
      if (status === "rejected" && !adminNote) return;
      await tutorApplicationApi.reviewSubject(profileId, subjectId, { status, adminNote });
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review this subject.");
    } finally {
      setActionKey("");
    }
  };

  const openEvidence = async (profileId: string, subjectId: string, evidenceId: string) => {
    const previewWindow = window.open("about:blank", "_blank");
    setActionKey(`open-${evidenceId}`);
    try {
      const result = await tutorApplicationApi.getEvidenceDownloadUrl(profileId, subjectId, evidenceId);
      if (previewWindow) previewWindow.location.href = result.url;
      else window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      previewWindow?.close();
      setError(openError instanceof Error ? openError.message : "Could not open this evidence.");
    } finally {
      setActionKey("");
    }
  };

  if (loading) return <div className="py-24 flex justify-center"><LoaderCircle className="w-8 h-8 animate-spin text-brand-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-xl lg:text-2xl text-brand-text">Tutor Application Review</h2>
          <p className="text-brand-text-variant/60 text-xs mt-1">Review evidence first, then approve each subject and its proposed tuition range.</p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 px-4 py-2.5 border border-brand-border/40 rounded-xl text-xs font-bold text-brand-primary bg-white"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </header>
      {error && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</p>}
      {applications.length === 0 ? (
        <div className="bg-white border border-brand-border/30 rounded-3xl py-16 text-center">
          <UserCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-brand-text">No pending tutor applications.</p>
        </div>
      ) : applications.map((application) => {
        const user = typeof application.userId === "object" ? application.userId : null;
        return (
          <article key={application._id} className="bg-white border border-brand-border/30 rounded-3xl overflow-hidden shadow-sm">
            <header className="p-6 bg-brand-low/40 border-b border-brand-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-display font-black text-base text-brand-text">{user?.fullName || "Tutor applicant"}</h3><StatusBadge status={application.status} /></div>
                <p className="text-xs text-brand-text-variant/60 mt-1">{user?.email}</p>
              </div>
              {application.updatedAt && <span className="inline-flex items-center gap-2 text-xs text-brand-text-variant/60"><CalendarDays className="w-4 h-4" /> Updated {new Date(application.updatedAt).toLocaleString()}</span>}
            </header>
            <div className="p-6 space-y-5">
              <div className="p-4 rounded-xl bg-brand-low/30">
                <p className="text-[10px] font-black uppercase tracking-wider text-brand-text-variant/50 mb-2">Professional Bio</p>
                <p className="text-xs leading-6 text-brand-text">{application.bio}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand-text-variant/50 mb-2">Weekly Availability</p>
                <div className="flex flex-wrap gap-2">{application.weeklyAvailability.map((slot, index) => <span key={slot._id || index} className="px-3 py-1.5 rounded-lg bg-brand-primary/5 border border-brand-primary/15 text-xs font-bold text-brand-primary">Day {slot.dayOfWeek} · {slot.startTime}–{slot.endTime}</span>)}</div>
              </div>
              {application.teachingSubjects.map((subject) => {
                const subjectId = subject._id || "";
                const evidenceApproved = subject.evidences.length > 0 && subject.evidences.every((evidence) => evidence.verificationStatus === "approved");
                return (
                  <section key={subjectId} className="border border-brand-secondary/20 rounded-2xl overflow-hidden">
                    <div className="p-4 bg-brand-secondary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-brand-secondary" />
                        <div><p className="text-sm font-black text-brand-text">{subjectName(subject)}</p><p className="text-[10px] uppercase font-bold text-brand-text-variant/55">{LEVEL_GROUPS.find((item) => item.id === subject.levelGroupId)?.name} · {subject.yearsOfExperience} years</p></div>
                        <StatusBadge status={subject.verificationStatus || "pending"} />
                      </div>
                      <div className="text-left sm:text-right"><p className="text-sm font-black text-brand-secondary">{subject.minPrice.toLocaleString("vi-VN")}₫ – {subject.maxPrice.toLocaleString("vi-VN")}₫</p><p className="text-[10px] font-bold text-brand-text-variant/55">{subject.priceUnit.replaceAll("_", " ")} · {subject.sessionsPerPeriod} × {subject.minutesPerSession} min</p></div>
                    </div>
                    <div className="p-4 space-y-3">
                      {subject.evidences.map((evidence) => {
                        const evidenceId = evidence._id || "";
                        return (
                          <div key={evidenceId} className="p-3 rounded-xl border border-brand-border/30 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {evidence.fileType === "application/pdf" ? <FileText className="w-5 h-5 text-brand-primary shrink-0" /> : <Award className="w-5 h-5 text-brand-secondary shrink-0" />}
                              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openEvidence(application._id || "", subjectId, evidenceId)} className="text-xs font-black text-brand-primary hover:underline text-left">{actionKey === `open-${evidenceId}` ? "Opening..." : evidence.name}</button><StatusBadge status={evidence.verificationStatus || "pending"} /></div><p className="text-[10px] text-brand-text-variant/60 mt-1">{evidence.issuer} · {evidence.originalFileName} · issued {evidence.issueDate}</p>{evidence.description && <p className="text-xs text-brand-text-variant mt-1">{evidence.description}</p>}{evidence.adminNote && <p className="text-xs text-red-700 mt-1">Note: {evidence.adminNote}</p>}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button disabled={!!actionKey} onClick={() => reviewEvidence(application._id || "", subjectId, evidenceId, "approved")} className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-40" title="Approve evidence">{actionKey === `evidence-${evidenceId}` ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
                              <button disabled={!!actionKey} onClick={() => reviewEvidence(application._id || "", subjectId, evidenceId, "rejected")} className="p-2 rounded-lg bg-red-50 text-red-700 border border-red-200 disabled:opacity-40" title="Reject evidence"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                      {subject.adminNote && <p className="text-xs text-red-700 font-semibold">Subject note: {subject.adminNote}</p>}
                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                        <button disabled={!!actionKey} onClick={() => reviewSubject(application._id || "", subjectId, "rejected")} className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-black disabled:opacity-40">Reject Subject</button>
                        <button disabled={!!actionKey || !evidenceApproved} onClick={() => reviewSubject(application._id || "", subjectId, "approved")} title={!evidenceApproved ? "Approve every evidence first" : "Approve subject and tuition range"} className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-black disabled:opacity-40">{actionKey === `subject-${subjectId}` ? "Saving..." : "Approve Subject & Price"}</button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        );
      })} 
      <section className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-black text-base text-brand-text">Application History</h3>
            <p className="text-xs text-brand-text-variant/60 mt-1">Approved, rejected and user-withdrawn applications.</p>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-brand-low text-xs font-black text-brand-primary">{applicationHistory.length}</span>
        </div>
        {applicationHistory.length === 0 ? (
          <p className="p-5 rounded-xl bg-brand-low/30 text-xs text-brand-text-variant">No completed or withdrawn applications yet.</p>
        ) : (
          <div className="divide-y divide-brand-border/15">
            {applicationHistory.map((item) => {
              const historyUser = typeof item.userId === "object" ? item.userId : null;
              return (
                <div key={item._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black text-brand-text">{historyUser?.fullName || "Tutor applicant"}</p>
                      <StatusBadge status={item.status} />
                      <span className="text-[10px] font-bold text-brand-text-variant/50">Revision {item.revision || 1}</span>
                    </div>
                    <p className="text-xs text-brand-text-variant/70 mt-1">
                      {item.teachingSubjects.map(subjectName).join(", ")}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-brand-text-variant/55">
                    {new Date(item.reviewedAt || item.withdrawnAt || item.updatedAt || Date.now()).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
