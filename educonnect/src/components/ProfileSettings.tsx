/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Camera,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Award,
  Trash2,
  Upload,
  Info,
  Check,
  X,
  Sparkles
} from "lucide-react";
import { AppProfileSettings } from "../types";

interface ProfileSettingsProps {
  settings: AppProfileSettings;
  onSaveSettings: (updated: AppProfileSettings) => void;
}

export function ProfileSettings({ settings, onSaveSettings }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<"info" | "tutor">("info");
  const [showToast, setShowToast] = useState(false);
  const [formState, setFormState] = useState<AppProfileSettings>({ ...settings });
  const [newSubject, setNewSubject] = useState("");
  const [subjectsList, setSubjectsList] = useState<string[]>([
    "Computer Science",
    "Mathematics",
  ]);

  // Handle standard input updates
  const handleChange = (
    key: keyof AppProfileSettings,
    value: string | number | string[]
  ) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    onSaveSettings(formState);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubject.trim() && !subjectsList.includes(newSubject.trim())) {
      setSubjectsList([...subjectsList, newSubject.trim()]);
      setNewSubject("");
    }
  };

  const handleRemoveSubject = (sub: string) => {
    setSubjectsList(subjectsList.filter((s) => s !== sub));
  };

  const handleApplyTutor = () => {
    handleChange("status", "pending");
    alert("Application submitted! Our academic administrators will review your qualifications and credentials.");
  };

  return (
    <div className="font-sans select-none max-w-6xl mx-auto pb-10 space-y-8">
      
      {/* Dynamic Animated Success Toast */}
      {showToast && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-2xl animate-fade-in w-85">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white rounded-full p-1 shrink-0">
              <Check className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <span className="font-bold text-emerald-800 text-xs">Toast alert</span>
              <p className="text-emerald-700 text-xs mt-0.5">Profile settings updated successfully!</p>
            </div>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-emerald-500 hover:text-emerald-700 p-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Column (Quick summary) vs Right Column (Forms) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column info overview card layout */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Profile Snapshot */}
          <div className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm text-center">
            <div className="relative w-32 h-32 mx-auto mb-4 group select-none">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-brand-container shadow-inner">
                <img
                  className="w-full h-full object-cover select-none pointer-events-none"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1GI2f-zpsl7qS4nN3_VIb1fvIKlLaKn0sKMCck-Ml-XiVUNNW_W2hnp0T5tu0imEmZb7H-2cPV_Q9vKwxdMf34x6ZsoKQN5YMZ-9BQ50g-E80saa0-GRaSfXHpUGvt3_wO_mu50Meen6Hit0r7WC0nGpsJaXx5PjaIf-Cg5Ntk25ZopRiM1U7EFGn-mlZ00JsQ99wJqT1dFSsH_Sw0Yts-Tn8mb8S1-HLEwr2wJT2Bd9Dt0RrraXCwKPBxiwo_96SGp2DgzOHvkUq"
                  alt="Alex Thompson"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button
                type="button"
                onClick={() => alert("Photo uploader dialog opened...")}
                className="absolute bottom-1 right-1 bg-brand-primary text-white p-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Update avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <h2 className="font-display font-black text-lg text-brand-text">
              {formState.fullName}
            </h2>
            <div className="mt-2 inline-flex items-center px-3.5 py-1 bg-brand-primary/10 text-brand-primary rounded-full font-display text-[10px] font-black uppercase tracking-wider border border-brand-primary/10 select-none">
              Student
            </div>

            <div className="mt-6 pt-6 border-t border-brand-border/10 select-none">
              <button
                onClick={() => setActiveTab("tutor")}
                className="w-full py-3 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-display font-black text-xs tracking-widest shadow-md shadow-brand-secondary/15 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Briefcase className="w-4 h-4" />
                Become a Tutor
              </button>
              <p className="mt-3 text-xs text-brand-text-variant/60 font-semibold font-sans">
                Monetize your knowledge today
              </p>
            </div>
          </div>

          {/* Completion metrics container */}
          <div className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm select-none">
            <div className="flex justify-between items-center mb-4">
              <span className="font-display font-black text-xs text-brand-text uppercase tracking-wider">
                Profile Strength
              </span>
              <span className="text-brand-primary font-display font-black text-sm">
                {formState.profileStrength}%
              </span>
            </div>
            <div className="w-full bg-brand-container rounded-full h-2 mb-6 shadow-inner">
              <div
                className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${formState.profileStrength}%` }}
              ></div>
            </div>
            <ul className="space-y-3 font-sans">
              <li className="flex items-center gap-2 text-emerald-600 font-semibold text-xs leading-none">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Email address verified</span>
              </li>
              <li className="flex items-center gap-2 text-emerald-600 font-semibold text-xs leading-none">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Personal info added</span>
              </li>
              <li className="flex items-center gap-2 text-brand-text-variant/60 font-semibold text-xs leading-none">
                <AlertCircle className="w-4 h-4 text-brand-border shrink-0 animate-pulse" />
                <span>Identity document needed</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right column Form Panel containing Tab contents */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-brand-border/30 shadow-sm overflow-hidden flex flex-col">
            
            {/* Header Tabs toggles */}
            <div className="flex border-b border-brand-border/20 bg-brand-low/40 px-2 select-none">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={`px-6 py-4 font-display font-black text-xs tracking-wider transition-all border-b-2 uppercase ${
                  activeTab === "info"
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-brand-text-variant/60 hover:text-brand-text"
                }`}
              >
                Profile Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tutor")}
                className={`px-6 py-4 font-display font-black text-xs tracking-wider transition-all border-b-2 uppercase ${
                  activeTab === "tutor"
                    ? "border-brand-secondary text-brand-secondary"
                    : "border-transparent text-brand-text-variant/60 hover:text-brand-text"
                }`}
              >
                Become Tutor
              </button>
            </div>

            {/* Content: PROFILE INFO */}
            {activeTab === "info" && (
              <div className="p-8">
                <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-brand-text text-xs font-semibold font-sans transition-colors"
                      value={formState.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 opacity-65">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Email address (Account ID)
                    </label>
                    <input
                      type="email"
                      disabled
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/30 bg-brand-low cursor-not-allowed text-brand-text-variant text-xs font-semibold outline-none"
                      value={formState.email}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-brand-text text-xs font-semibold font-sans transition-colors"
                      value={formState.phoneNumber}
                      onChange={(e) => handleChange("phoneNumber", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Gender
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-brand-text text-xs font-semibold font-sans cursor-pointer transition-colors"
                      value={formState.gender}
                      onChange={(e) => handleChange("gender", e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Education Level
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-brand-text text-xs font-semibold font-sans cursor-pointer transition-colors"
                      value={formState.educationLevel}
                      onChange={(e) => handleChange("educationLevel", e.target.value)}
                    >
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Postgraduate">Postgraduate</option>
                      <option value="Doctorate">Doctorate</option>
                      <option value="High School">High School</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Available Time
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-brand-text text-xs font-semibold font-sans cursor-pointer transition-colors"
                      value={formState.availableTime}
                      onChange={(e) => handleChange("availableTime", e.target.value)}
                    >
                      <option value="Mornings (8AM - 12PM)">Mornings (8AM - 12PM)</option>
                      <option value="Afternoons (12PM - 5PM)">Afternoons (12PM - 5PM)</option>
                      <option value="Evenings (5PM - 10PM)">Evenings (5PM - 10PM)</option>
                      <option value="Weekends Only">Weekends Only</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Physical Address
                    </label>
                    <textarea
                      placeholder="Enter street detail location address..."
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none text-brand-text text-xs font-semibold font-sans transition-colors resize-none"
                      rows={3}
                      value={formState.physicalAddress}
                      onChange={(e) => handleChange("physicalAddress", e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-8 py-3 bg-brand-primary text-white rounded-xl font-display font-black text-xs tracking-widest hover:bg-brand-primary/95 hover:shadow-lg hover:shadow-brand-primary/10 active:scale-98 transition-all cursor-pointer shadow-md"
                    >
                      SAVE CHANGES
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Content: BECOME TUTOR APPLICATION */}
            {activeTab === "tutor" && (
              <div className="p-8 space-y-8 select-none">
                
                {/* Banner review indicators */}
                <div className="p-4 bg-brand-secondary/5 rounded-2xl border border-brand-secondary/15 flex items-start gap-4">
                  <Info className="w-5 h-5 text-brand-secondary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-display font-black text-xs text-brand-secondary uppercase tracking-wider mb-1">
                      Tutor Application Status
                    </h4>
                    {formState.status === "none" ? (
                      <p className="text-xs text-brand-text-variant">
                        Apply to start monetization. Our academic board reviews compliance details inside 24 to 48 business hours.
                      </p>
                    ) : formState.status === "pending" ? (
                      <p className="text-xs text-amber-700 font-bold">
                        Status: Pending Approval. Your academic records are being validated!
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-700 font-bold">
                        Status: Application Approved! Switch roles to access tutor features.
                      </p>
                    )}
                  </div>
                </div>

                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Professional Bio
                    </label>
                    <textarea
                      placeholder="Describe your expertise, teaching qualifications, and lecture delivery style..."
                      className="w-full px-4 py-3 rounded-xl border border-brand-border/40 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/20 outline-none text-brand-text text-xs font-semibold font-sans transition-colors resize-none"
                      rows={4}
                      value={formState.bio || ""}
                      onChange={(e) => handleChange("bio", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 5"
                        className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-brand-text text-xs font-semibold font-sans outline-none focus:border-brand-secondary transition-colors"
                        value={formState.experienceYears || ""}
                        onChange={(e) => handleChange("experienceYears", Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                        Hourly Rate ($)
                      </label>
                      <input
                        type="number"
                        min="20"
                        placeholder="e.g. 45"
                        className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-brand-text text-xs font-semibold font-sans outline-none focus:border-brand-secondary transition-colors"
                        value={formState.hourlyRate || ""}
                        onChange={(e) => handleChange("hourlyRate", Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                        Teaching Level Focus
                      </label>
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-brand-border/40 text-brand-text text-xs font-semibold font-sans outline-none focus:border-brand-secondary transition-colors cursor-pointer"
                        value={formState.teachingLevel || "Beginner"}
                        onChange={(e) => handleChange("teachingLevel", e.target.value)}
                      >
                        <option value="Beginner">Beginner focus</option>
                        <option value="Intermediate">Intermediate focus</option>
                        <option value="Advanced">Advanced focus</option>
                        <option value="All Levels">All Levels Welcome</option>
                      </select>
                    </div>
                  </div>

                  {/* Expertise list tags with additions */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                      Expertise Subjects
                    </label>
                    <div className="p-3 border border-brand-border/40 rounded-xl flex flex-wrap gap-2 focus-within:border-brand-secondary transition-colors">
                      {subjectsList.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 bg-brand-secondary/15 text-brand-secondary px-2.5 py-1 rounded-lg text-xs font-bold leading-none select-none border border-brand-secondary/10"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(tag)}
                            className="hover:text-brand-error p-0.5 shrink-0 transition-colors"
                          >
                            <X className="w-3 h-3 shrink-0" />
                          </button>
                        </span>
                      ))}
                      
                      <div className="flex-1 min-w-[120px] relative">
                        <input
                          type="text"
                          placeholder="Add topic..."
                          className="w-full bg-transparent border-none outline-none text-xs font-semibold font-sans py-0.5 text-brand-text"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddSubject(e)}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-brand-text-variant/50 font-sans italic">
                      Type subject name and hit Enter to append topic tag.
                    </p>
                  </div>

                  {/* Certificates block list */}
                  <div className="space-y-4">
                    <h3 className="font-display font-black text-xs text-brand-text uppercase border-b border-brand-border/20 pb-2 tracking-widest">
                      Certificates &amp; Credentials
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="bg-brand-low/40 border border-brand-border/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <Award className="w-5 h-5 text-brand-primary shrink-0" />
                          <div className="min-w-0 select-none">
                            <div className="text-xs font-bold text-brand-text truncate">
                              AWS Solutions Architect
                            </div>
                            <div className="text-[10px] text-brand-text-variant/60 font-semibold uppercase tracking-wider mt-0.5">
                              Amazon • 2023
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert("aws cert deleted.")}
                          className="text-brand-error opacity-65 hover:opacity-100 p-1.5 hover:bg-brand-error/5 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="bg-brand-low/40 border border-brand-border/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <Award className="w-5 h-5 text-brand-primary shrink-0" />
                          <div className="min-w-0 select-none">
                            <div className="text-xs font-bold text-brand-text truncate">
                              IELTS Academic Benchmark C1
                            </div>
                            <div className="text-[10px] text-brand-text-variant/60 font-semibold uppercase tracking-wider mt-0.5">
                              British Council • 2022
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert("ielts cert deleted.")}
                          className="text-brand-error opacity-65 hover:opacity-100 p-1.5 hover:bg-brand-error/5 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                    {/* Drag and drop upload helper zone */}
                    <div
                      onClick={() => alert("Upload dialog opened: select your credentials PDF, certificate image, or transcripts...")}
                      className="border-2 border-dashed border-brand-border/40 hover:border-brand-secondary bg-brand-low/10 rounded-2xl p-10 text-center hover:bg-brand-secondary/5 transition-all cursor-pointer group"
                    >
                      <Upload className="w-8 h-8 text-brand-text-variant/40 group-hover:text-brand-secondary transition-colors mx-auto mb-3 shrink-0" />
                      <div className="font-display font-black text-xs text-brand-text">
                        Click or drag files to upload credentials
                      </div>
                      <p className="text-[10px] text-brand-text-variant/60 font-medium mt-1">
                        PDF, PNG, JPG (Max 5MB per individual file)
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-brand-border/10 select-none">
                    <button
                      type="button"
                      onClick={handleApplyTutor}
                      className="w-full py-4 bg-brand-secondary text-white rounded-xl font-display font-black text-xs tracking-widest hover:bg-brand-secondary-hover active:scale-[0.98] transition-all shadow-lg shadow-brand-secondary/15 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      APPLY TO BECOME TUTOR
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>

          {/* Under state mock preview cards */}
          <div className="mt-8 grid grid-cols-3 gap-4 select-none font-display">
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <span className="font-bold text-[10px] tracking-wider uppercase text-amber-700">
                Pending Approval
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
              <span className="font-bold text-[10px] tracking-wider uppercase text-emerald-700">
                Application Approved
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-brand-error/20 bg-brand-error/5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-error shrink-0"></span>
              <span className="font-bold text-[10px] tracking-wider uppercase text-brand-error">
                Application Rejected
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
