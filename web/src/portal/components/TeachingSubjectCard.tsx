import React from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { LEVEL_GROUPS, LEVELS_BY_GROUP, SUBJECTS_BY_GROUP, TutorTeachingSubject } from "../tutorApplication";
import { EvidenceUploader, StatusBadge } from "./EvidenceUploader";
import { PriceRangeInput } from "./PriceRangeInput";

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
  const toggleLevel = (levelId: string) => patch({
    teachingLevelIds: value.teachingLevelIds.includes(levelId)
      ? value.teachingLevelIds.filter((id) => id !== levelId)
      : [...value.teachingLevelIds, levelId]
  });

  return (
    <article className="rounded-2xl border border-brand-secondary/20 bg-white overflow-hidden shadow-sm">
      <header className="px-5 py-4 bg-brand-secondary/5 border-b border-brand-secondary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand-secondary" />
          <h3 className="font-display font-black text-sm text-brand-text">Teaching Subject {index + 1}</h3>
          {value.verificationStatus && <StatusBadge status={value.verificationStatus} />}
        </div>
        <button disabled={disabled} type="button" onClick={onRemove} className="p-2 text-brand-error rounded-lg hover:bg-brand-error/5 disabled:opacity-40" aria-label="Remove subject"><Trash2 className="w-4 h-4" /></button>
      </header>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="field-label">Level Group
            <select disabled={disabled} value={value.levelGroupId} onChange={(e) => patch({ levelGroupId: e.target.value, subjectId: "", teachingLevelIds: [] })} className="field-control">
              <option value="">Select level group</option>
              {LEVEL_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label className="field-label">Subject
            <select disabled={disabled || !value.levelGroupId} value={value.subjectId} onChange={(e) => patch({ subjectId: e.target.value })} className="field-control">
              <option value="">Select subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>
        </div>

        <div>
          <p className="field-label mb-2">Teaching Levels / Classes</p>
          <div className="flex flex-wrap gap-2">
            {levels.length === 0 && <span className="text-xs text-brand-text-variant/50">Select a level group first.</span>}
            {levels.map((level) => {
              const selected = value.teachingLevelIds.includes(level.id);
              return <button disabled={disabled} key={level.id} type="button" onClick={() => toggleLevel(level.id)} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors disabled:opacity-60 ${selected ? "bg-brand-secondary text-white border-brand-secondary" : "bg-white text-brand-text-variant border-brand-border/40"}`}>{level.name}</button>;
            })}
          </div>
        </div>

        <label className="field-label max-w-xs">Subject Experience (years)
          <input disabled={disabled} type="number" min={0} value={value.yearsOfExperience} onChange={(e) => patch({ yearsOfExperience: Number(e.target.value) })} placeholder="e.g. 2" className="field-control" />
        </label>
        <PriceRangeInput value={value} onChange={patch} disabled={disabled} />
        <EvidenceUploader value={value.evidences} onChange={(evidences) => patch({ evidences })} disabled={disabled} />
        {errors.map((error) => <p key={error} className="text-xs font-semibold text-brand-error">{error}</p>)}
        {value.adminNote && <p className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">Admin note: {value.adminNote}</p>}
      </div>
    </article>
  );
}
