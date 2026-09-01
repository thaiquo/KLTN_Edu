import React, { useEffect, useState } from "react";
import { KeyRound, Settings2 } from "lucide-react";
import { AppProfileSettings } from "../types";
import { ProfilePage } from "../../pages/ProfilePage";
import { ChangePasswordPage } from "../../pages/ChangePasswordPage";

interface ProfileSettingsProps {
  settings: AppProfileSettings;
  onSaveSettings: (updated: AppProfileSettings) => void;
  activeRole?: string;
  initialTab?: "info" | "password";
}

export function ProfileSettings({ settings, onSaveSettings, initialTab = "info" }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<"info" | "password">(initialTab);
  void settings;
  void onSaveSettings;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="font-sans max-w-7xl mx-auto pb-10 space-y-6">
      <div className="flex border-b border-brand-border/30 bg-white rounded-2xl px-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "info" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Hồ sơ cá nhân
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "password" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-variant/60"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Đổi mật khẩu
          </span>
        </button>
      </div>

      <div className="bg-transparent rounded-2xl">
        {activeTab === "info" && <ProfilePage embedded={true} onTabChange={setActiveTab} />}
        {activeTab === "password" && <ChangePasswordPage embedded={true} onTabChange={setActiveTab} />}
      </div>
    </div>
  );
}
