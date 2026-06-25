import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, History, Info, LoaderCircle, Plus, Send, Trash2, UserRoundPen } from "lucide-react";
import { tutorApplicationApi } from "../../api/tutorApplications";
import {
  createSubject, newClientId, SUBJECTS_BY_GROUP, TutorApplication, TutorAvailability, TutorTeachingSubject
} from "../tutorApplication";
import { StatusBadge } from "./EvidenceUploader";
import { TeachingSubjectCard } from "./TeachingSubjectCard";
import { WeeklyAvailabilityEditor } from "./WeeklyAvailabilityEditor";

const createEmptyApplication = (): TutorApplication => ({
  bio: "",
  weeklyAvailability: [{ clientId: newClientId(), dayOfWeek: 1, startTime: "18:00", endTime: "20:00" }],
  teachingSubjects: [createSubject()],
  status: "none"
});

type FormErrors = { general: string[]; availability: string[]; subjects: Record<number, string[]> };

function normalizeApplication(application: TutorApplication): TutorApplication {
  const validStatus = ["pending", "approved", "rejected", "withdrawn"].includes(application.status)
    ? application.status
    : "none";
  return {
    ...application,
    status: validStatus,
    weeklyAvailability: (application.weeklyAvailability || []).map((slot) => ({ ...slot, clientId: slot._id || newClientId() })),
    teachingSubjects: (application.teachingSubjects || []).map((subject) => ({
      ...subject,
      clientId: subject._id || newClientId(),
      evidences: (subject.evidences || []).map((evidence) => ({
        ...evidence,
        clientId: evidence._id || newClientId(),
        originalFileName: evidence.originalFileName || "evidence-file"
      }))
    }))
  };
}

function validate(application: TutorApplication): FormErrors {
  const errors: FormErrors = { general: [], availability: [], subjects: {} };
  if (!application.bio.trim()) errors.general.push("Professional bio is required.");
  if (!application.weeklyAvailability.length) errors.availability.push("Add at least one available time slot.");

  application.weeklyAvailability.forEach((slot) => {
    if (!slot.startTime || !slot.endTime || slot.startTime >= slot.endTime) {
      errors.availability.push("Each start time must be earlier than its end time.");
    }
  });
  const slots = [...application.weeklyAvailability].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  if (slots.some((slot, index) => index > 0 && slots[index - 1].dayOfWeek === slot.dayOfWeek && slot.startTime < slots[index - 1].endTime)) {
    errors.availability.push("Time slots on the same day cannot overlap.");
  }

  if (!application.teachingSubjects.length) errors.general.push("Add at least one teaching subject.");
  const subjectKeys = new Set<string>();
  application.teachingSubjects.forEach((subject, index) => {
    const subjectErrors: string[] = [];
    if (!subject.levelGroupId) subjectErrors.push("Select a level group.");
    if (!subject.subjectId) subjectErrors.push("Select a subject.");
    if (!subject.teachingLevelIds.length) subjectErrors.push("Select at least one teaching level / class.");
    if (subject.yearsOfExperience < 0) subjectErrors.push("Experience cannot be negative.");
    if (subject.minPrice <= 0) subjectErrors.push("Minimum price must be greater than zero.");
    if (subject.maxPrice < subject.minPrice) subjectErrors.push("Maximum price must be at least the minimum price.");
    if (subject.sessionsPerPeriod <= 0) subjectErrors.push("Sessions per period must be greater than zero.");
    if (subject.minutesPerSession <= 0) subjectErrors.push("Minutes per session must be greater than zero.");
    if (subject.priceUnit === "per_course" && !subject.durationDays) subjectErrors.push("Course duration is required.");
    if (!subject.evidences.length) subjectErrors.push("Upload at least one certificate or evidence for this subject.");
    subject.evidences.forEach((evidence) => {
      if (!evidence.name.trim() || !evidence.issuer.trim() || !evidence.issueDate || !evidence.fileKey) {
        subjectErrors.push("Complete the name, issuer and issue date for every evidence file.");
      }
    });
    const key = `${subject.levelGroupId}:${subject.subjectId}`;
    if (subject.levelGroupId && subject.subjectId && subjectKeys.has(key)) subjectErrors.push("This subject was already added for the same level group.");
    subjectKeys.add(key);
    if (subjectErrors.length) errors.subjects[index] = [...new Set(subjectErrors)];
  });
  errors.availability = [...new Set(errors.availability)];
  return errors;
}

export function BecomeTutorForm() {
  const [application, setApplication] = useState<TutorApplication>(() => createEmptyApplication());
  const [history, setHistory] = useState<TutorApplication[]>([]);
  const [errors, setErrors] = useState<FormErrors>({ general: [], availability: [], subjects: {} });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const locked = false;

  const loadApplications = async () => {
    const result: TutorApplication[] = await tutorApplicationApi.getMine();
    const applications = Array.isArray(result) ? result.map(normalizeApplication) : [];
    setHistory(applications);
    const editable = applications.find((item) => item.status === "pending" || item.status === "rejected");
    setApplication(editable || createEmptyApplication());
  };

  useEffect(() => {
    let active = true;
    tutorApplicationApi.getMine()
      .then((result: TutorApplication[]) => {
        if (!active) return;
        const applications = Array.isArray(result) ? result.map(normalizeApplication) : [];
        setHistory(applications);
        const editable = applications.find((item) => item.status === "pending" || item.status === "rejected");
        setApplication(editable || createEmptyApplication());
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load your tutor application.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const applicationStatusCopy = useMemo(() => ({
    none: "Complete the four sections below. Your subjects and evidence will be reviewed individually.",
    pending: "Your application is pending review. You can still update or withdraw it; the admin list will sync automatically.",
    approved: "Your tutor application and every teaching subject are approved. Your account now has tutor access.",
    rejected: "Your application needs changes. Review the administrator notes, update the rejected items and submit again.",
    withdrawn: "This application was withdrawn and remains available in your application history."
  }[application.status]), [application.status]);

  const updateSubject = (index: number, subject: TutorTeachingSubject) =>
    setApplication((previous) => ({ ...previous, teachingSubjects: previous.teachingSubjects.map((item, itemIndex) => itemIndex === index ? subject : item) }));

  const submit = async () => {
    const nextErrors = validate(application);
    setErrors(nextErrors);
    if (nextErrors.general.length || nextErrors.availability.length || Object.keys(nextErrors.subjects).length) {
      setMessage("Please fix the highlighted application details before submitting.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        bio: application.bio.trim(),
        weeklyAvailability: application.weeklyAvailability.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
        teachingSubjects: application.teachingSubjects.map((subject) => ({
          levelGroupId: subject.levelGroupId,
          subjectId: subject.subjectId,
          teachingLevelIds: subject.teachingLevelIds,
          yearsOfExperience: Number(subject.yearsOfExperience),
          minPrice: Number(subject.minPrice),
          maxPrice: Number(subject.maxPrice),
          priceUnit: subject.priceUnit,
          durationDays: subject.priceUnit === "per_30_days" ? 30 : subject.durationDays,
          sessionsPerPeriod: Number(subject.sessionsPerPeriod),
          minutesPerSession: Number(subject.minutesPerSession),
          evidences: subject.evidences.map(({ name, issuer, issueDate, expiryDate, description, fileKey, originalFileName, fileType, fileSize }) => ({
            name: name.trim(), issuer: issuer.trim(), issueDate, expiryDate: expiryDate || null,
            description: description.trim(), fileKey, originalFileName, fileType, fileSize
          }))
        }))
      };
      if (application._id) await tutorApplicationApi.update(application._id, payload);
      else await tutorApplicationApi.create(payload);
      await loadApplications();
      setMessage(application._id
        ? "Application updated. The admin review queue now shows your latest information."
        : "Application submitted successfully. Administrators can now review each subject and evidence.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit the tutor application.");
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async () => {
    if (!application._id || !window.confirm("Withdraw this tutor application? It will disappear from the admin review queue but remain in your history.")) return;
    setSubmitting(true);
    setMessage("");
    try {
      await tutorApplicationApi.withdraw(application._id);
      await loadApplications();
      setMessage("Application withdrawn. You can create a new application at any time.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not withdraw the tutor application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><LoaderCircle className="w-8 h-8 text-brand-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${application.status === "approved" ? "bg-emerald-50 border-emerald-200" : application.status === "rejected" ? "bg-red-50 border-red-200" : "bg-brand-secondary/5 border-brand-secondary/20"}`}>
        {application.status === "approved" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : application.status === "rejected" ? <AlertCircle className="w-5 h-5 text-red-600 shrink-0" /> : <Info className="w-5 h-5 text-brand-secondary shrink-0" />}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-text">Tutor Application</h3>
            {application.status !== "none" && <StatusBadge status={application.status} />}
          </div>
          <p className="text-xs text-brand-text-variant">{applicationStatusCopy}</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-brand-secondary/10 text-brand-secondary"><UserRoundPen className="w-5 h-5" /></span>
          <div><h3 className="font-display font-black text-sm text-brand-text">Professional Bio</h3><p className="text-xs text-brand-text-variant/60">A general introduction, shared across all teaching subjects.</p></div>
        </div>
        <textarea disabled={locked} rows={5} value={application.bio} onChange={(e) => setApplication({ ...application, bio: e.target.value })} placeholder="Describe your teaching experience, teaching style, achievements..." className="w-full px-4 py-3 rounded-xl border border-brand-border/40 outline-none focus:border-brand-secondary text-xs resize-none disabled:bg-brand-low/50" />
        {errors.general.map((error) => <p key={error} className="text-xs font-semibold text-brand-error">{error}</p>)}
      </section>

      <WeeklyAvailabilityEditor disabled={locked} value={application.weeklyAvailability} errors={errors.availability} onChange={(weeklyAvailability: TutorAvailability[]) => setApplication({ ...application, weeklyAvailability })} />

      <section className="space-y-4">
        <div className="bg-white rounded-2xl border border-brand-border/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div><h3 className="font-display font-black text-sm text-brand-text">Teaching Subjects</h3><p className="text-xs text-brand-text-variant/60 mt-1">Add pricing, levels and evidence separately for each subject.</p></div>
          <button disabled={locked} type="button" onClick={() => setApplication({ ...application, teachingSubjects: [...application.teachingSubjects, createSubject()] })} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-secondary text-white rounded-xl text-xs font-black disabled:opacity-40"><Plus className="w-4 h-4" /> Add Teaching Subject</button>
        </div>
        {application.teachingSubjects.map((subject, index) => (
          <TeachingSubjectCard key={subject._id || subject.clientId || index} index={index} value={subject} disabled={locked} errors={errors.subjects[index]} onChange={(nextSubject) => updateSubject(index, nextSubject)} onRemove={() => setApplication({ ...application, teachingSubjects: application.teachingSubjects.filter((_, itemIndex) => itemIndex !== index) })} />
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm">
        {message && <p className={`mb-4 text-xs font-semibold ${message.startsWith("Could") || message.startsWith("Please") ? "text-brand-error" : "text-emerald-700"}`}>{message}</p>}
        <div className={application._id ? "grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3" : ""}>
          <button disabled={submitting} type="button" onClick={submit} className="w-full py-4 px-6 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-display font-black text-xs tracking-widest shadow-lg shadow-brand-secondary/15 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {application.status === "pending" ? "UPDATE PENDING APPLICATION" : application.status === "rejected" ? "UPDATE & RESUBMIT" : "SUBMIT NEW TUTOR APPLICATION"}
          </button>
          {application._id && (
            <button disabled={submitting} type="button" onClick={withdraw} className="py-4 px-6 rounded-xl border border-red-200 bg-red-50 text-red-700 font-display font-black text-xs tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> WITHDRAW
            </button>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary"><History className="w-5 h-5" /></span>
          <div>
            <h3 className="font-display font-black text-sm text-brand-text">Application History</h3>
            <p className="text-xs text-brand-text-variant/60">Approved applications stay here while you submit more subjects later.</p>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="p-5 rounded-xl bg-brand-low/40 text-xs text-brand-text-variant">No tutor applications submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <article key={item._id} className="p-4 rounded-xl border border-brand-border/30 bg-brand-low/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] font-bold text-brand-text-variant/50">Revision {item.revision || 1}</span>
                    {item._id === application._id && <span className="text-[10px] font-black uppercase text-brand-secondary">Editing above</span>}
                  </div>
                  <p className="text-xs font-bold text-brand-text mt-2">
                    {item.teachingSubjects.map((subject) =>
                      SUBJECTS_BY_GROUP[subject.levelGroupId]?.find((option) => option.id === subject.subjectId)?.name || subject.subjectId
                    ).join(", ")}
                  </p>
                  <p className="text-[10px] text-brand-text-variant/55 mt-1">
                    Submitted {new Date(item.submittedAt || item.updatedAt || Date.now()).toLocaleString()}
                  </p>
                </div>
                {item.status === "approved" && <span className="text-xs font-bold text-emerald-700">Added to tutor profile</span>}
                {item.status === "withdrawn" && <span className="text-xs font-bold text-brand-text-variant/60">Removed from admin queue</span>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
