import React from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { LEVEL_GROUPS, LEVELS_BY_GROUP, SUBJECTS_BY_GROUP, subjectLabelVi, TutorTeachingSubject } from "../tutorApplication";
import { EvidenceUploader, StatusBadge } from "./EvidenceUploader";

interface Props {
  index: number;
  value: TutorTeachingSubject;
  onChange: (value: TutorTeachingSubject) => void;
  onRemove: () => void;
  disabled?: boolean;
  errors?: string[];
}

export function TeachingSubjectCard({ index, value, onChange, onRemove, disabled, errors = [] }: Props) {
  const patch = (updates: Partial<TutorTeachingSubject>) => onChange({ ...value, ...updates });
  const subjects = SUBJECTS_BY_GROUP[value.levelGroupId] || [];
  const levels = LEVELS_BY_GROUP[value.levelGroupId] || [];
  const supportsMultipleLevels = ["primary", "secondary", "high_school", "university"].includes(value.levelGroupId);
  const toggleLevel = (levelId: string) => {
    const selected = value.teachingLevelIds.includes(levelId);
    patch({
      teachingLevelIds: supportsMultipleLevels
        ? (selected ? value.teachingLevelIds.filter(id => id !== levelId) : [...value.teachingLevelIds, levelId])
        : (selected ? [] : [levelId]),
      customTeachingLevel: levelId === "__custom__" ? value.customTeachingLevel : ""
    });
  };

  return (
    <article className="rounded-2xl border border-brand-secondary/20 bg-white overflow-hidden shadow-sm">
      <header className="px-5 py-4 bg-brand-secondary/5 border-b border-brand-secondary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand-secondary" />
          <h3 className="font-display font-black text-sm text-brand-text">Môn học {index + 1}</h3>
          {value.verificationStatus && <StatusBadge status={value.verificationStatus} />}
        </div>
        <button disabled={disabled} type="button" onClick={onRemove} className="p-2 text-brand-error rounded-lg hover:bg-brand-error/5 disabled:opacity-40" aria-label="Xóa môn học"><Trash2 className="w-4 h-4" /></button>
      </header>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="field-label">Cấp bậc
            <select disabled={disabled} value={value.levelGroupId} onChange={(e) => patch({ levelGroupId: e.target.value, subjectId: "", teachingLevelIds: [], customLevelGroup: e.target.value === "__custom__" ? value.customLevelGroup : "", customSubject: "", customTeachingLevel: "" })} className="field-control">
              <option value="">Chọn cấp bậc</option>
              {LEVEL_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              <option value="__custom__">Khác (tự nhập)</option>
            </select>
            {value.levelGroupId === "__custom__" && <input disabled={disabled} value={value.customLevelGroup || ""} onChange={(e) => patch({ customLevelGroup: e.target.value })} className="field-control mt-2" placeholder="Nhập cấp bậc" />}
          </label>
          <label className="field-label">Môn học
            <select disabled={disabled || !value.levelGroupId} value={value.subjectId} onChange={(e) => patch({ subjectId: e.target.value })} className="field-control">
              <option value="">Chọn môn học</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subjectLabelVi(subject)}</option>)}
              <option value="__custom__">Khác (tự nhập)</option>
            </select>
            {value.subjectId === "__custom__" && <input disabled={disabled} value={value.customSubject || ""} onChange={(e) => patch({ customSubject: e.target.value })} className="field-control mt-2" placeholder="Nhập tên môn học" />}
          </label>
        </div>

        <div>
          <p className="field-label mb-2">Lớp / trình độ giảng dạy {supportsMultipleLevels && <span className="font-normal text-brand-text-variant">(có thể chọn nhiều)</span>}</p>
          <div className="flex flex-wrap gap-2">
            {levels.length === 0 && <span className="text-xs text-brand-text-variant/50">Vui lòng chọn cấp bậc trước.</span>}
            {levels.map((level) => {
              const selected = value.teachingLevelIds.includes(level.id);
              return <button disabled={disabled} key={level.id} type="button" onClick={() => toggleLevel(level.id)} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors disabled:opacity-60 ${selected ? "bg-brand-secondary text-white border-brand-secondary" : "bg-white text-brand-text-variant border-brand-border/40"}`}>{level.name}</button>;
            })}
            <button disabled={disabled} type="button" onClick={() => toggleLevel("__custom__")} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors disabled:opacity-60 ${value.teachingLevelIds.includes("__custom__") ? "bg-brand-secondary text-white border-brand-secondary" : "bg-white text-brand-text-variant border-brand-border/40"}`}>Khác (tự nhập)</button>
          </div>
          {value.teachingLevelIds.includes("__custom__") && <input disabled={disabled} value={value.customTeachingLevel || ""} onChange={(e) => patch({ customTeachingLevel: e.target.value })} className="field-control mt-3 max-w-md" placeholder="Nhập lớp / trình độ" />}
        </div>

        <label className="field-label">Giới thiệu theo môn học
          <textarea disabled={disabled} value={value.bio || ""} onChange={(e) => patch({ bio: e.target.value })} className="field-control resize-none" rows={3} placeholder="Giới thiệu thế mạnh và phương pháp dạy môn này" />
        </label>
        <label className="field-label">Kinh nghiệm giảng dạy / làm việc
          <textarea disabled={disabled} value={value.experience || ""} onChange={(e) => patch({ experience: e.target.value })} className="field-control resize-none" rows={3} placeholder="Mô tả kinh nghiệm giảng dạy hoặc làm việc liên quan" />
        </label>
        <EvidenceUploader value={value.evidences} onChange={(evidences) => patch({ evidences })} disabled={disabled} />
        {errors.map((error) => <p key={error} className="text-xs font-semibold text-brand-error">{error}</p>)}
        {value.adminNote && <p className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">Ghi chú của quản trị viên: {value.adminNote}</p>}
      </div>
    </article>
  );
}
