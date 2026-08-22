import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileUp,
  Layers3, Pencil, Plus, RefreshCw, RotateCcw, Search, XCircle
} from "lucide-react";
import { adminTeachingCatalogApi } from "../../../api/teachingRegistrations";

const LEVEL_TYPES = [
  ["GRADE", "Lớp phổ thông"],
  ["EXAM_PREPARATION", "Ôn thi"],
  ["UNIVERSITY_LEVEL", "Trình độ đại học"],
  ["CERTIFICATE_TARGET", "Mục tiêu chứng chỉ"],
  ["SKILL_LEVEL", "Trình độ kỹ năng"],
  ["COACHING_LEVEL", "Kèm cặp / định hướng"]
];
const INPUT_CLASS = "w-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#147b77]";

type Editor = null | {
  kind: "CATEGORY" | "SUBJECT" | "LEVEL";
  mode: "CREATE" | "EDIT";
  parent?: any;
  value?: any;
};

const emptyCategory = { programTypeId: "", educationLevelId: "", code: "", name: "", description: "", orderIndex: 999, active: true };
const emptySubject = { code: "", name: "", description: "", orderIndex: 999, active: true, levelCode: "", levelName: "", levelType: "GRADE" };
const emptyLevel = { code: "", name: "", type: "GRADE", description: "", orderIndex: 999, active: true };

export function TeachingCatalogManagement() {
  const [snapshot, setSnapshot] = useState<any>({ programTypes: [], educationLevels: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [programCode, setProgramCode] = useState("ALL");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<Editor>(null);
  const [form, setForm] = useState<any>(emptyCategory);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await adminTeachingCatalogApi.snapshot();
      setSnapshot(data || { programTypes: [], educationLevels: [], categories: [] });
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh mục giảng dạy.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    return (snapshot.categories || []).filter((category: any) => {
      if (programCode !== "ALL" && category.programType?.code !== programCode) return false;
      if (!includeInactive && !category.active) return false;
      if (!keyword) return true;
      return [category.code, category.name, ...(category.subjects || []).flatMap((subject: any) => [subject.code, subject.name])]
        .some((value) => String(value || "").toLocaleLowerCase("vi-VN").includes(keyword));
    });
  }, [snapshot, query, programCode, includeInactive]);

  function beginCreateCategory() {
    const firstProgram = snapshot.programTypes?.find((item: any) => item.active);
    setForm({ ...emptyCategory, programTypeId: firstProgram?.id || "" });
    setEditor({ kind: "CATEGORY", mode: "CREATE" });
  }

  function beginEditCategory(value: any) {
    setForm({ code: value.code, name: value.name, description: value.description || "", orderIndex: value.orderIndex, active: value.active });
    setEditor({ kind: "CATEGORY", mode: "EDIT", value });
  }

  function beginCreateSubject(category: any) {
    setForm({ ...emptySubject, levelType: defaultLevelType(category) });
    setEditor({ kind: "SUBJECT", mode: "CREATE", parent: category });
  }

  function beginEditSubject(category: any, value: any) {
    setForm({ code: value.code, name: value.name, description: value.description || "", orderIndex: value.orderIndex, active: value.active });
    setEditor({ kind: "SUBJECT", mode: "EDIT", parent: category, value });
  }

  function beginCreateLevel(subject: any) {
    setForm({ ...emptyLevel, type: defaultLevelTypeFromSubject(subject) });
    setEditor({ kind: "LEVEL", mode: "CREATE", parent: subject });
  }

  function beginEditLevel(subject: any, value: any) {
    setForm({ code: value.code, name: value.name, type: value.type, description: value.description || "", orderIndex: value.orderIndex, active: value.active });
    setEditor({ kind: "LEVEL", mode: "EDIT", parent: subject, value });
  }

  async function submitEditor(event: React.FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true); setError("");
    try {
      if (editor.kind === "CATEGORY" && editor.mode === "CREATE") {
        const program = snapshot.programTypes.find((item: any) => String(item.id) === String(form.programTypeId));
        await adminTeachingCatalogApi.createCategory({
          programTypeId: Number(form.programTypeId),
          educationLevelId: program?.code === "ACADEMIC" ? Number(form.educationLevelId) : null,
          code: form.code, name: form.name, description: form.description || null,
          orderIndex: Number(form.orderIndex)
        });
      } else if (editor.kind === "CATEGORY") {
        await adminTeachingCatalogApi.updateCategory(editor.value.id, categoryPayload(form));
      } else if (editor.kind === "SUBJECT" && editor.mode === "CREATE") {
        await adminTeachingCatalogApi.createSubject({
          categoryId: editor.parent.id, code: form.code, name: form.name,
          description: form.description || null, orderIndex: Number(form.orderIndex),
          levels: [{ code: form.levelCode, name: form.levelName, type: form.levelType, orderIndex: 1 }]
        });
      } else if (editor.kind === "SUBJECT") {
        await adminTeachingCatalogApi.updateSubject(editor.value.id, subjectPayload(form));
      } else if (editor.kind === "LEVEL" && editor.mode === "CREATE") {
        await adminTeachingCatalogApi.createLevel({
          subjectId: editor.parent.id, code: form.code, name: form.name, type: form.type,
          description: form.description || null, orderIndex: Number(form.orderIndex)
        });
      } else if (editor.kind === "LEVEL") {
        await adminTeachingCatalogApi.updateLevel(editor.value.id, levelPayload(form));
      }
      setNotice("Đã lưu thay đổi danh mục thành công.");
      setEditor(null);
      await load();
    } catch (err: any) {
      setError(err?.message || "Không thể lưu thay đổi.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(kind: "CATEGORY" | "SUBJECT" | "LEVEL", value: any) {
    const action = value.active ? "vô hiệu hóa" : "khôi phục";
    if (!window.confirm(`Xác nhận ${action} “${value.name}”? Dữ liệu lịch sử sẽ không bị xóa.`)) return;
    setBusy(true); setError("");
    try {
      if (kind === "CATEGORY") await adminTeachingCatalogApi.updateCategory(value.id, categoryPayload({ ...value, active: !value.active }));
      if (kind === "SUBJECT") await adminTeachingCatalogApi.updateSubject(value.id, subjectPayload({ ...value, active: !value.active }));
      if (kind === "LEVEL") await adminTeachingCatalogApi.updateLevel(value.id, levelPayload({ ...value, active: !value.active }));
      setNotice(`Đã ${action} “${value.name}”.`);
      await load();
    } catch (err: any) {
      setError(err?.message || `Không thể ${action} dữ liệu.`);
    } finally { setBusy(false); }
  }

  async function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      const result = await adminTeachingCatalogApi.importCsv(file);
      setNotice(`Import hoàn tất: ${result.successRows}/${result.totalRows} dòng thành công${result.failedRows ? `, ${result.failedRows} dòng lỗi` : ""}.`);
      if (result.errors?.length) setError(result.errors.join("\n"));
      await load();
    } catch (err: any) {
      setError(err?.message || "Không thể import CSV.");
    } finally { setBusy(false); }
  }

  function toggleExpanded(id: number) {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5 pb-10 font-sans text-[#073554]">
      <header className="border border-[#d7dde6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Admin / Danh mục giảng dạy</p>
            <h1 className="mt-1 font-display text-2xl font-black">Quản lý môn học & cấp độ</h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">
              Catalog chuẩn dùng chung cho đăng ký quyền dạy và tạo lớp. Xóa là vô hiệu hóa để giữ nguyên lịch sử đăng ký, lớp học và minh chứng.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 border border-[#d7dde6] px-3 py-2 text-xs font-black hover:border-[#147b77]">
              <FileUp className="h-4 w-4" /> Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={importCsv} />
            </label>
            <button onClick={beginCreateCategory} className="inline-flex items-center gap-2 bg-[#147b77] px-3 py-2 text-xs font-black text-white">
              <Plus className="h-4 w-4" /> Thêm nhóm môn
            </button>
            <button onClick={load} disabled={loading || busy} className="border border-[#d7dde6] p-2 text-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          </div>
        </div>
      </header>

      {notice && <Message tone="success" onClose={() => setNotice("")}>{notice}</Message>}
      {error && <Message tone="error" onClose={() => setError("")}><span className="whitespace-pre-line">{error}</span></Message>}

      <section className="grid gap-3 border border-[#d7dde6] bg-white p-4 md:grid-cols-[1fr_auto_auto]">
        <label className="flex items-center gap-2 border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm nhóm môn, môn học hoặc mã..." className="w-full bg-transparent text-xs font-semibold outline-none" />
        </label>
        <select value={programCode} onChange={(e) => setProgramCode(e.target.value)} className="border border-slate-200 px-3 py-2 text-xs font-bold outline-none">
          <option value="ALL">Tất cả chương trình</option>
          {(snapshot.programTypes || []).map((item: any) => <option key={item.id} value={item.code}>{item.name}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Hiện mục đã vô hiệu hóa
        </label>
      </section>

      {loading ? <div className="h-48 animate-pulse bg-slate-100" /> : categories.length === 0 ? (
        <div className="border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-400">Không có dữ liệu phù hợp.</div>
      ) : (
        <div className="space-y-3">
          {categories.map((category: any) => (
            <CategoryCard key={category.id} category={category} open={expanded.has(category.id)}
              onToggle={() => toggleExpanded(category.id)} onAddSubject={() => beginCreateSubject(category)}
              onEdit={() => beginEditCategory(category)} onToggleActive={() => toggleActive("CATEGORY", category)}
              onAddLevel={beginCreateLevel} onEditSubject={(subject: any) => beginEditSubject(category, subject)}
              onToggleSubject={(subject: any) => toggleActive("SUBJECT", subject)} onEditLevel={beginEditLevel}
              onToggleLevel={(level: any) => toggleActive("LEVEL", level)} />
          ))}
        </div>
      )}

      {editor && <EditorModal editor={editor} form={form} setForm={setForm} snapshot={snapshot}
        busy={busy} onClose={() => setEditor(null)} onSubmit={submitEditor} />}
    </div>
  );
}

function CategoryCard({ category, open, onToggle, onAddSubject, onEdit, onToggleActive, onAddLevel, onEditSubject, onToggleSubject, onEditLevel, onToggleLevel }: any) {
  return <section className={`border bg-white shadow-sm ${category.active ? "border-[#d7dde6]" : "border-slate-200 opacity-70"}`}>
    <header className="flex flex-wrap items-center gap-3 p-4">
      <button onClick={onToggle} className="text-slate-400">{open ? <ChevronDown /> : <ChevronRight />}</button>
      <div className="flex h-10 w-10 items-center justify-center bg-[#e9f5f4] text-[#147b77]"><Layers3 className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{category.name}</h2><Code value={category.code} />{!category.active && <Inactive />}</div>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">{category.programType?.name}{category.educationLevel ? ` · ${category.educationLevel.name}` : ""} · {category.subjects?.length || 0} môn</p>
      </div>
      <button onClick={onAddSubject} disabled={!category.active} className="inline-flex items-center gap-1 border border-[#147b77] px-2.5 py-1.5 text-[11px] font-black text-[#147b77] disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Thêm môn</button>
      <IconButton title="Chỉnh sửa nhóm môn" onClick={onEdit}><Pencil /></IconButton>
      <ToggleButton active={category.active} onClick={onToggleActive} />
    </header>
    {open && <div className="border-t border-slate-100 bg-[#f8fafc] p-3">
      {(category.subjects || []).length === 0 ? <p className="p-5 text-center text-xs font-semibold text-slate-400">Nhóm này chưa có môn học.</p> :
        <div className="space-y-2">{category.subjects.map((subject: any) => <SubjectRow key={subject.id} subject={subject}
          onAddLevel={() => onAddLevel(subject)} onEdit={() => onEditSubject(subject)} onToggle={() => onToggleSubject(subject)}
          onEditLevel={(level: any) => onEditLevel(subject, level)} onToggleLevel={onToggleLevel} />)}</div>}
    </div>}
  </section>;
}

function SubjectRow({ subject, onAddLevel, onEdit, onToggle, onEditLevel, onToggleLevel }: any) {
  return <div className={`border border-slate-200 bg-white p-3 ${subject.active ? "" : "opacity-60"}`}>
    <div className="flex flex-wrap items-center gap-2">
      <BookOpen className="h-4 w-4 text-[#ff695f]" /><span className="font-black">{subject.name}</span><Code value={subject.code} />{!subject.active && <Inactive />}
      <span className="ml-auto text-[10px] font-bold text-slate-400">{subject.levels?.length || 0} cấp độ</span>
      <button onClick={onAddLevel} disabled={!subject.active} className="text-[#147b77] disabled:opacity-30" title="Thêm cấp độ"><Plus className="h-4 w-4" /></button>
      <IconButton title="Sửa môn" onClick={onEdit}><Pencil /></IconButton><ToggleButton active={subject.active} onClick={onToggle} />
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {(subject.levels || []).map((level: any) => <span key={level.id} className={`group inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold ${level.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-400"}`}>
        {level.name}<small className="font-semibold opacity-60">{level.type}</small>
        <button onClick={() => onEditLevel(level)} title="Sửa cấp độ"><Pencil className="h-3 w-3" /></button>
        <button onClick={() => onToggleLevel(level)} title={level.active ? "Vô hiệu hóa" : "Khôi phục"}>{level.active ? <XCircle className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}</button>
      </span>)}
    </div>
  </div>;
}

function EditorModal({ editor, form, setForm, snapshot, busy, onClose, onSubmit }: any) {
  const creating = editor.mode === "CREATE";
  const selectedProgram = snapshot.programTypes?.find((item: any) => String(item.id) === String(form.programTypeId));
  const title = `${creating ? "Thêm" : "Sửa"} ${editor.kind === "CATEGORY" ? "nhóm môn" : editor.kind === "SUBJECT" ? "môn học" : "cấp độ"}`;
  return <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#061827]/70 p-4" onMouseDown={onClose}>
    <form onSubmit={onSubmit} className="w-full max-w-xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-lg font-black">{title}</h2>{editor.parent && <p className="mt-1 text-xs font-semibold text-slate-400">Thuộc: {editor.parent.name}</p>}</div><button type="button" onClick={onClose}><XCircle className="h-5 w-5" /></button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {editor.kind === "CATEGORY" && creating && <>
          <Field label="Loại chương trình"><select required value={form.programTypeId} onChange={(e) => setForm({ ...form, programTypeId: e.target.value, educationLevelId: "" })} className={INPUT_CLASS}><option value="">Chọn chương trình</option>{snapshot.programTypes.filter((item: any) => item.active).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          {selectedProgram?.code === "ACADEMIC" && <Field label="Cấp học"><select required value={form.educationLevelId} onChange={(e) => setForm({ ...form, educationLevelId: e.target.value })} className={INPUT_CLASS}><option value="">Chọn cấp học</option>{snapshot.educationLevels.filter((item: any) => item.active).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        </>}
        <TextField label="Mã chuẩn" value={form.code} onChange={(value: string) => setForm({ ...form, code: value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} placeholder="VD: HIGH_SCHOOL_NATURAL" />
        <TextField label="Tên hiển thị" value={form.name} onChange={(value: string) => setForm({ ...form, name: value })} placeholder="Tên tiếng Việt" />
        {(editor.kind === "LEVEL" || (editor.kind === "SUBJECT" && creating)) && <Field label="Loại cấp độ"><select value={editor.kind === "LEVEL" ? form.type : form.levelType} onChange={(e) => setForm({ ...form, [editor.kind === "LEVEL" ? "type" : "levelType"]: e.target.value })} className={INPUT_CLASS}>{LEVEL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}
        {editor.kind === "SUBJECT" && creating && <>
          <TextField label="Mã cấp độ đầu tiên" value={form.levelCode} onChange={(value: string) => setForm({ ...form, levelCode: value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} placeholder="VD: GRADE_10" />
          <TextField label="Tên cấp độ đầu tiên" value={form.levelName} onChange={(value: string) => setForm({ ...form, levelName: value })} placeholder="VD: Lớp 10" />
        </>}
        <Field label="Thứ tự"><input required min="0" type="number" value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: e.target.value })} className={INPUT_CLASS} /></Field>
        {!creating && <Field label="Trạng thái"><select value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === "true" })} className={INPUT_CLASS}><option value="true">Đang hoạt động</option><option value="false">Đã vô hiệu hóa</option></select></Field>}
        <Field label="Mô tả" wide><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${INPUT_CLASS} resize-none`} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="border border-slate-200 px-4 py-2 text-xs font-black">Hủy</button><button disabled={busy} className="bg-[#147b77] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
    </form>
  </div>;
}

function Field({ label, wide = false, children }: any) { return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }
function TextField({ label, value, onChange, placeholder }: any) { return <Field label={label}><input required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={INPUT_CLASS} /></Field>; }
function Code({ value }: any) { return <code className="bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{value}</code>; }
function Inactive() { return <span className="bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-400">Inactive</span>; }
function IconButton({ title, onClick, children }: any) { return <button title={title} onClick={onClick} className="text-slate-400 hover:text-[#147b77]">{React.cloneElement(children, { className: "h-4 w-4" })}</button>; }
function ToggleButton({ active, onClick }: any) { return <button onClick={onClick} title={active ? "Vô hiệu hóa" : "Khôi phục"} className={active ? "text-rose-500" : "text-emerald-600"}>{active ? <XCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</button>; }
function Message({ tone, onClose, children }: any) { const success = tone === "success"; return <div className={`flex items-start gap-2 border p-3 text-xs font-bold ${success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}<div className="flex-1">{children}</div><button onClick={onClose}>×</button></div>; }
function categoryPayload(value: any) { return { code: value.code, name: value.name, description: value.description || null, orderIndex: Number(value.orderIndex), active: Boolean(value.active) }; }
function subjectPayload(value: any) { return { code: value.code, name: value.name, description: value.description || null, orderIndex: Number(value.orderIndex), active: Boolean(value.active) }; }
function levelPayload(value: any) { return { code: value.code, name: value.name, type: value.type, description: value.description || null, orderIndex: Number(value.orderIndex), active: Boolean(value.active) }; }
function defaultLevelType(category: any) { if (category.programType?.code === "SKILL") return category.code === "LANGUAGE_CERT" ? "CERTIFICATE_TARGET" : "SKILL_LEVEL"; return category.educationLevel?.code === "UNIVERSITY" ? "UNIVERSITY_LEVEL" : "GRADE"; }
function defaultLevelTypeFromSubject(subject: any) { return subject.levels?.find((item: any) => item.active)?.type || "SKILL_LEVEL"; }
