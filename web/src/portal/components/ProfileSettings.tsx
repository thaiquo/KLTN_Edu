import React, { useEffect, useState } from "react";
import { Briefcase, Camera, Check, CheckCircle2, Settings2, X } from "lucide-react";
import { AppProfileSettings } from "../types";
import { BecomeTutorForm } from "./BecomeTutorForm";

interface ProfileSettingsProps {
  settings: AppProfileSettings;
  onSaveSettings: (updated: AppProfileSettings) => void;
}

export function ProfileSettings({ settings, onSaveSettings }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<"info" | "tutor">("info");
  const [showToast, setShowToast] = useState(false);
  const [formState, setFormState] = useState<AppProfileSettings>({ ...settings });
  useEffect(() => setFormState({ ...settings }), [settings]);

  const update = (key: keyof AppProfileSettings, value: string | number) =>
    setFormState((previous) => ({ ...previous, [key]: value }));

  const save = () => {
    onSaveSettings(formState);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3500);
  };

  return (
    <div className="font-sans max-w-6xl mx-auto pb-10 space-y-8">
      {showToast && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 shadow-2xl">
          <Check className="w-5 h-5 text-emerald-600" />
          <p className="text-xs font-bold text-emerald-800">Profile settings updated successfully.</p>
          <button onClick={() => setShowToast(false)}><X className="w-4 h-4 text-emerald-600" /></button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm text-center">
            <div className="relative w-28 h-28 mx-auto mb-4">
              <div className="w-full h-full rounded-full bg-brand-container flex items-center justify-center text-3xl font-black text-brand-primary">
                {formState.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </div>
              <button type="button" className="absolute bottom-0 right-0 bg-brand-primary text-white p-2 rounded-full shadow-lg" title="Update avatar"><Camera className="w-4 h-4" /></button>
            </div>
            <h2 className="font-display font-black text-lg text-brand-text">{formState.fullName}</h2>
            <p className="text-xs text-brand-text-variant/60 mt-1">{formState.email}</p>
            <button onClick={() => setActiveTab("tutor")} className="mt-6 w-full py-3 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-display font-black text-xs tracking-widest flex items-center justify-center gap-2"><Briefcase className="w-4 h-4" /> Become a Tutor</button>
          </div>
          <div className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm">
            <div className="flex justify-between text-xs font-black mb-3"><span>PROFILE STRENGTH</span><span className="text-brand-primary">{formState.profileStrength}%</span></div>
            <div className="w-full bg-brand-container rounded-full h-2"><div className="bg-brand-primary h-2 rounded-full" style={{ width: `${formState.profileStrength}%` }} /></div>
            <p className="mt-4 flex gap-2 items-center text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Email address verified</p>
          </div>
        </aside>

        <main className="lg:col-span-8">
          <div className="flex border-b border-brand-border/30 mb-6 bg-white rounded-t-2xl px-2">
            <button onClick={() => setActiveTab("info")} className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 ${activeTab === "info" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"}`}><span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Profile Info</span></button>
            <button onClick={() => setActiveTab("tutor")} className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 ${activeTab === "tutor" ? "border-brand-secondary text-brand-secondary" : "border-transparent text-brand-text-variant/60"}`}><span className="inline-flex items-center gap-2"><Briefcase className="w-4 h-4" /> Become Tutor</span></button>
          </div>

          {activeTab === "tutor" ? <BecomeTutorForm /> : (
            <section className="bg-white rounded-2xl border border-brand-border/30 p-7 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="field-label">Full Name<input value={formState.fullName} onChange={(e) => update("fullName", e.target.value)} className="field-control" /></label>
                <label className="field-label opacity-60">Email address<input disabled value={formState.email} className="field-control" /></label>
                <label className="field-label">Phone Number<input value={formState.phoneNumber} onChange={(e) => update("phoneNumber", e.target.value)} className="field-control" /></label>
                <label className="field-label">Gender<select value={formState.gender} onChange={(e) => update("gender", e.target.value)} className="field-control"><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select></label>
                <label className="field-label">Education Level<select value={formState.educationLevel} onChange={(e) => update("educationLevel", e.target.value)} className="field-control"><option>Undergraduate</option><option>Postgraduate</option><option>Doctorate</option><option>High School</option></select></label>
                <label className="field-label">Available Time<input value={formState.availableTime} onChange={(e) => update("availableTime", e.target.value)} className="field-control" /></label>
                <label className="field-label md:col-span-2">Physical Address<textarea rows={3} value={formState.physicalAddress} onChange={(e) => update("physicalAddress", e.target.value)} className="field-control resize-none" /></label>
              </div>
              <div className="mt-6 flex justify-end"><button onClick={save} className="px-7 py-3 bg-brand-primary text-white rounded-xl text-xs font-black tracking-widest">SAVE CHANGES</button></div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
