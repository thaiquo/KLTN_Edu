import React, { useEffect, useState } from "react";
import { Briefcase, Camera, Check, CheckCircle2, Settings2, X, KeyRound } from "lucide-react";
import { AppProfileSettings } from "../types";
import { BecomeTutorForm } from "./BecomeTutorForm";
import { TeachingRegistrationPage } from "../../pages/tutor/TeachingRegistrationPage";
import { ProfilePage } from "../../pages/ProfilePage";
import { ChangePasswordPage } from "../../pages/ChangePasswordPage";

interface ProfileSettingsProps {
  settings: AppProfileSettings;
  onSaveSettings: (updated: AppProfileSettings) => void;
  activeRole?: string;
}

export function ProfileSettings({ settings, onSaveSettings, activeRole }: ProfileSettingsProps) {
  const isTutor = activeRole === "tutor";
  const [activeTab, setActiveTab] = useState<"info" | "tutor" | "teaching" | "password">("info");

  // If activeTab is "teaching", render full width view
  if (isTutor && activeTab === "teaching") {
    return (
      <div className="font-sans max-w-7xl mx-auto pb-10 space-y-6">
        {/* Top Tab Bar for full width settings switcher */}
        <div className="flex border-b border-brand-border/30 bg-white rounded-2xl px-2 shadow-sm">
          <button 
            onClick={() => setActiveTab("info")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "info" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Hồ sơ cá nhân</span>
          </button>
          <button 
            onClick={() => setActiveTab("teaching")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "teaching" ? "border-brand-secondary text-brand-secondary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><Briefcase className="w-4 h-4" /> Đăng ký môn dạy</span>
          </button>
          <button 
            onClick={() => setActiveTab("password")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "password" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><KeyRound className="w-4 h-4" /> Đổi mật khẩu</span>
          </button>
        </div>

        {/* Embedded Teaching Registration page in full width */}
        <div className="bg-transparent rounded-2xl">
          <TeachingRegistrationPage embedded={true} />
        </div>
      </div>
    );
  }

  // If activeTab is "password", render full width change password view
  if (activeTab === "password") {
    return (
      <div className="font-sans max-w-7xl mx-auto pb-10 space-y-6">
        {/* Top Tab Bar for Settings switcher */}
        <div className="flex border-b border-brand-border/30 bg-white rounded-2xl px-2 shadow-sm">
          <button 
            onClick={() => setActiveTab("info")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "info" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Hồ sơ cá nhân</span>
          </button>
          {isTutor && (
            <button 
              onClick={() => setActiveTab("teaching")} 
              className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "teaching" ? "border-brand-secondary text-brand-secondary" : "border-transparent text-brand-text-variant/60"
              }`}
            >
              <span className="inline-flex items-center gap-2"><Briefcase className="w-4 h-4" /> Đăng ký môn dạy</span>
            </button>
          )}
          <button 
            onClick={() => setActiveTab("password")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "password" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><KeyRound className="w-4 h-4" /> Đổi mật khẩu</span>
          </button>
        </div>

        {/* Embedded Change Password page in full width */}
        <div className="bg-transparent rounded-2xl">
          <ChangePasswordPage embedded={true} onTabChange={setActiveTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans max-w-7xl mx-auto pb-10 space-y-6">
      
      {/* Top Tab Bar for Settings switcher */}
      <div className="flex border-b border-brand-border/30 bg-white rounded-2xl px-2 shadow-sm">
        <button 
          onClick={() => setActiveTab("info")} 
          className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "info" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
          }`}
        >
          <span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Hồ sơ cá nhân</span>
        </button>
        
        {isTutor ? (
          <button 
            onClick={() => setActiveTab("teaching")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "teaching" ? "border-brand-secondary text-brand-secondary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><Briefcase className="w-4 h-4" /> Đăng ký môn dạy</span>
          </button>
        ) : (
          <button 
            onClick={() => setActiveTab("tutor")} 
            className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "tutor" ? "border-brand-secondary text-brand-secondary" : "border-transparent text-brand-text-variant/60"
            }`}
          >
            <span className="inline-flex items-center gap-2"><Briefcase className="w-4 h-4" /> Đăng ký làm Gia sư</span>
          </button>
        )}

        <button 
          onClick={() => setActiveTab("password")} 
          className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "password" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
          }`}
        >
          <span className="inline-flex items-center gap-2"><KeyRound className="w-4 h-4" /> Đổi mật khẩu</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-transparent rounded-2xl">
        {activeTab === "info" && <ProfilePage embedded={true} onTabChange={setActiveTab} />}
        {activeTab === "tutor" && (
          <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-brand-border/30 p-7 shadow-sm">
            <BecomeTutorForm />
          </div>
        )}
      </div>
    </div>
  );
}
