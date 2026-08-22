import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpenCheck, CheckCircle2, ChevronRight, LoaderCircle, PlusCircle, RefreshCw } from 'lucide-react';
import { isUnauthorized } from '../../../api/client';
import { subjectApi } from '../../../api/subjects';
import { subjectSuggestionApi } from '../../../api/subjectSuggestions';
import { tutorApplicationApi } from '../../../api/tutorApplications';
import { useAuth } from '../../../hooks/useAuth';
import { ApplicationSubjectCard } from '../subjects/ApplicationSubjectCard';
import { ApplicationSubjectForm } from '../subjects/ApplicationSubjectForm';
import { DeleteSubjectDialog } from '../subjects/DeleteSubjectDialog';

const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];

export function TeachingSubjectsStep({ application, readOnly, onSubjectsChanged }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [catalog, setCatalog] = useState({ categories: [], groups: [], groupSubjects: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestingName, setSuggestingName] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const editable = !readOnly && EDITABLE_STATUSES.includes(application?.status);
  const selectedSubjectIds = useMemo(
    () => subjects.map((item) => item.subject?.id).filter(Boolean),
    [subjects]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setListError('');
      try {
        const [nextSubjects, nextSuggestions] = await Promise.all([
          tutorApplicationApi.getMyTutorApplicationSubjects(),
          user?.id ? subjectSuggestionApi.mine(user.id) : Promise.resolve([])
        ]);
        if (!active) return;
        const normalized = Array.isArray(nextSubjects) ? nextSubjects : [];
        setSubjects(normalized);
        setSuggestions(Array.isArray(nextSuggestions) ? nextSuggestions : []);
        onSubjectsChanged?.(normalized);
      } catch (error) {
        if (!active) return;
        if (error.status === 404) {
          setSubjects([]);
          onSubjectsChanged?.([]);
          setListError('Chưa tìm thấy hồ sơ gia sư nháp. Hãy tải lại wizard rồi thử lại.');
        } else if (isUnauthorized(error)) {
          setListError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else {
          setListError(error.message || 'Không thể tải danh sách môn học.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [onSubjectsChanged]);

  useEffect(() => {
    if (!editable) return undefined;
    let active = true;

    async function loadCategories() {
      setCatalogLoading(true);
      try {
        const [categories, groups] = await Promise.all([
          subjectApi.categories(),
          subjectApi.groups()
        ]);
        if (active) {
          setCatalog((current) => ({
            ...current,
            categories: Array.isArray(categories) ? categories : [],
            groups: Array.isArray(groups) ? groups : []
          }));
        }
      } catch {
        if (active) setCatalog((current) => ({ ...current, categories: [] }));
      } finally {
        if (active) setCatalogLoading(false);
      }
    }

    loadCategories();
    return () => {
      active = false;
    };
  }, [editable]);

  async function refreshSubjects() {
    const nextSubjects = await tutorApplicationApi.getMyTutorApplicationSubjects();
    const normalized = Array.isArray(nextSubjects) ? nextSubjects : [];
    setSubjects(normalized);
    onSubjectsChanged?.(normalized);
    return normalized;
  }

  async function refreshSuggestions() {
    const nextSuggestions = user?.id ? await subjectSuggestionApi.mine(user.id) : [];
    setSuggestions(Array.isArray(nextSuggestions) ? nextSuggestions : []);
  }

  async function chooseCategory(category) {
    setSelectedCategory(category);
    setSelectedGroup(null);
    setCatalog((current) => ({ ...current, groupSubjects: [] }));
    setCatalogLoading(true);
    try {
      const groups = await subjectApi.groups({ categoryId: category.id });
      setCatalog((current) => ({ ...current, groups: Array.isArray(groups) ? groups : [] }));
    } finally {
      setCatalogLoading(false);
    }
  }

  async function chooseGroup(group) {
    setSelectedGroup(group);
    setCatalog((current) => ({ ...current, groupSubjects: [] }));
    setCatalogLoading(true);
    try {
      const groupSubjects = await subjectApi.list({ groupId: group.id, limit: 20 });
      setCatalog((current) => ({ ...current, groupSubjects: Array.isArray(groupSubjects) ? groupSubjects : [] }));
    } finally {
      setCatalogLoading(false);
    }
  }

  function selectSubject(subject) {
    setSelectedSubject(subject);
    setEditingItem(null);
    setSuggestingName('');
    clearActionState();
  }

  async function addSubject(payload) {
    if (!selectedSubject || actionBusy) return;
    setActionBusy('add');
    clearActionState(false);

    try {
      await tutorApplicationApi.addApplicationSubject({ subjectId: selectedSubject.id, ...payload });
      await refreshSubjects();
      setSelectedSubject(null);
      setSuccessMessage('Môn học đã được thêm vào hồ sơ.');
    } catch (error) {
      handleMutationError(error);
    } finally {
      setActionBusy('');
    }
  }

  async function updateSubject(payload) {
    if (!editingItem || actionBusy) return;
    setActionBusy(`edit-${editingItem.id}`);
    clearActionState(false);

    try {
      await tutorApplicationApi.updateApplicationSubject(editingItem.id, payload);
      await refreshSubjects();
      setEditingItem(null);
      setSuccessMessage('Môn học đã được cập nhật.');
    } catch (error) {
      handleMutationError(error);
    } finally {
      setActionBusy('');
    }
  }

  async function deleteSubject() {
    if (!deletingItem || actionBusy) return;
    setActionBusy(`delete-${deletingItem.id}`);
    setDeleteError('');
    setSuccessMessage('');

    try {
      await tutorApplicationApi.deleteApplicationSubject(deletingItem.id);
      await refreshSubjects();
      setDeletingItem(null);
      setSuccessMessage('Môn học đã được xóa khỏi hồ sơ.');
    } catch (error) {
      setDeleteError(toFriendlyMessage(error));
    } finally {
      setActionBusy('');
    }
  }

  function handleMutationError(error) {
    if (error.status === 409) {
      setActionError(toFriendlyMessage(error));
      refreshSubjects().catch(() => null);
      return;
    }
    setValidationErrors(toValidationMap(error));
    setActionError(toFriendlyMessage(error));
  }

  function clearActionState(clearSuccess = true) {
    setActionError('');
    setDeleteError('');
    setValidationErrors({});
    if (clearSuccess) setSuccessMessage('');
  }

  return (
    <section>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">
          <BookOpenCheck size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">Bước 3</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">
            Môn học bạn muốn dạy
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
            Chọn danh mục, nhóm môn, rồi chọn môn chính thức bạn muốn dạy. Admin sẽ kiểm tra từng môn, trình độ, mức học phí và minh chứng trước khi cho phép dùng chúng để tạo lớp.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-6">
        {readOnly && (
          <InfoCard tone="slate" title="Chế độ chỉ đọc">
            Hồ sơ đang ở trạng thái {application?.status}. Bạn có thể xem danh sách môn nhưng chưa thể thêm, sửa hoặc xóa.
          </InfoCard>
        )}

        {successMessage && (
          <InfoCard tone="green" title={successMessage}>
            Danh sách môn học đã được đồng bộ lại từ backend.
          </InfoCard>
        )}

        {listError && (
          <InfoCard tone="red" title="Không thể tải danh sách môn học">
            <span>{listError}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-white px-4 py-3 text-sm font-extrabold text-red-800 hover:bg-red-100"
            >
              <RefreshCw size={16} />
              Tải lại
            </button>
          </InfoCard>
        )}

        {editable && (
          <div className="grid gap-5 rounded-[8px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-extrabold text-slate-950">Bạn muốn dạy môn gì?</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Duyệt catalog theo luồng Danh mục → Nhóm môn → Môn học để tránh chọn nhầm và giữ dữ liệu chuẩn.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-slate-500">
                <PlusCircle size={14} />
                {subjects.length} môn
              </span>
            </div>

            <CatalogBrowser
              catalog={catalog}
              loading={catalogLoading}
              selectedCategory={selectedCategory}
              selectedGroup={selectedGroup}
              selectedSubjectIds={selectedSubjectIds}
              onCategory={chooseCategory}
              onGroup={chooseGroup}
              onSelect={selectSubject}
              onSuggest={() => {
                setSuggestingName(' ');
                setSelectedSubject(null);
                setEditingItem(null);
                clearActionState();
              }}
              onBackToCategories={() => {
                setSelectedCategory(null);
                setSelectedGroup(null);
                setCatalog((current) => ({ ...current, groups: [], groupSubjects: [] }));
              }}
              onBackToGroups={() => {
                setSelectedGroup(null);
                setCatalog((current) => ({ ...current, groupSubjects: [] }));
              }}
            />

            {suggestingName && (
              <SubjectSuggestionForm
                initialName={suggestingName.trim()}
                categories={catalog.categories}
                groups={catalog.groups}
                selectedCategory={selectedCategory}
                selectedGroup={selectedGroup}
                requestedByUserId={user?.id}
                busy={actionBusy === 'suggest'}
                onCancel={() => setSuggestingName('')}
                onSubmit={async (payload) => {
                  setActionBusy('suggest');
                  setActionError('');
                  try {
                    await subjectSuggestionApi.create(payload);
                    await refreshSuggestions();
                    setSuggestingName('');
                    setSuccessMessage('Đề xuất môn học đã được gửi thẳng đến Admin duyệt.');
                  } catch (error) {
                    setActionError(toFriendlyMessage(error));
                  } finally {
                    setActionBusy('');
                  }
                }}
              />
            )}
          </div>
        )}

        <PendingSuggestionsSection suggestions={suggestions} />

        {selectedSubject && editable && (
          <ApplicationSubjectForm
            key={`add-${selectedSubject.id}`}
            subject={selectedSubject}
            mode="add"
            busy={actionBusy === 'add'}
            apiError={actionError}
            validationErrors={validationErrors}
            onCancel={() => {
              setSelectedSubject(null);
              clearActionState();
            }}
            onSubmit={addSubject}
          />
        )}

        {editingItem && editable && (
          <ApplicationSubjectForm
            key={`edit-${editingItem.id}`}
            subject={editingItem.subject}
            initialValue={editingItem}
            mode="edit"
            busy={actionBusy === `edit-${editingItem.id}`}
            apiError={actionError}
            validationErrors={validationErrors}
            onCancel={() => {
              setEditingItem(null);
              clearActionState();
            }}
            onSubmit={updateSubject}
          />
        )}

        <DeleteSubjectDialog
          item={deletingItem}
          busy={deletingItem ? actionBusy === `delete-${deletingItem.id}` : false}
          error={deleteError}
          onCancel={() => {
            setDeletingItem(null);
            setDeleteError('');
          }}
          onConfirm={deleteSubject}
        />

        <div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-950">Môn học của bạn</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Học phí là giá niêm yết/cơ sở cho hình thức dạy 1:1 theo từng môn.
              </p>
            </div>
            {subjects.length > 0 && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700">
                <CheckCircle2 size={14} />
                {subjects.length} môn đã thêm
              </span>
            )}
          </div>

          {loading ? (
            <SubjectListSkeleton />
          ) : subjects.length === 0 ? (
            <EmptyState editable={editable} />
          ) : (
            <div className="grid gap-4">
              {subjects.map((item) => (
                <ApplicationSubjectCard
                  key={item.id}
                  item={item}
                  readOnly={!editable}
                  busy={Boolean(actionBusy)}
                  onEdit={(nextItem) => {
                    setEditingItem(nextItem);
                    setSelectedSubject(null);
                    setDeletingItem(null);
                    clearActionState();
                  }}
                  onDelete={(nextItem) => {
                    setDeletingItem(nextItem);
                    setEditingItem(null);
                    setSelectedSubject(null);
                    clearActionState();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CatalogBrowser({ catalog, loading, selectedCategory, selectedGroup, selectedSubjectIds, onCategory, onGroup, onSelect, onSuggest, onBackToCategories, onBackToGroups }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-500">
        <button type="button" onClick={onBackToCategories} className="hover:text-primary">Danh mục</button>
        {selectedCategory && <><ChevronRight size={14} /><button type="button" onClick={onBackToGroups} className="hover:text-primary">{selectedCategory.name}</button></>}
        {selectedGroup && <><ChevronRight size={14} /><span className="text-slate-950">{selectedGroup.name}</span></>}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-500">
          <LoaderCircle size={16} className="animate-spin" />
          Đang tải catalog...
        </div>
      )}

      {!loading && !selectedCategory && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          {catalog.categories.map((category) => (
            <button key={category.id} type="button" onClick={() => onCategory(category)} className="shrink-0 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary">
              {category.name}
            </button>
          ))}
        </div>
      )}

      {!loading && selectedCategory && !selectedGroup && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.groups.map((group) => (
            <button key={group.id} type="button" onClick={() => onGroup(group)} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-left hover:border-primary/40 hover:bg-white">
              <span className="block text-sm font-extrabold text-slate-950">{group.name}</span>
              <span className="mt-1 block text-xs font-bold text-slate-500">{selectedCategory.name}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && selectedGroup && (
        <div className="mt-4 grid gap-4">
          {catalog.groupSubjects.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.groupSubjects.map((subject) => {
                const added = selectedSubjectIds.includes(subject.id);
                return (
                  <button key={subject.id} type="button" disabled={added} onClick={() => onSelect(subject)} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-left hover:border-primary/40 hover:bg-white disabled:cursor-not-allowed disabled:bg-emerald-50">
                    <span className="block text-sm font-extrabold text-slate-950">{subject.name}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {subject.supportedLevels?.map((level) => (
                        <small key={level} className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-slate-500">
                          {levelLabels[level] || level}
                        </small>
                      ))}
                    </span>
                    {added && <span className="mt-3 inline-block text-xs font-extrabold text-emerald-700">Đã thêm</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Nhóm môn này chưa có môn chính thức nào.
            </div>
          )}
          <div className="rounded-[8px] border border-dashed border-[#147b77]/40 bg-emerald-50/50 p-4">
            <p className="text-sm font-extrabold text-slate-900">Không thấy môn bạn muốn dạy?</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Gửi đề xuất trong nhóm {selectedGroup.name}. Staff sẽ duyệt trước khi môn xuất hiện trong catalog chính thức.
            </p>
            <button
              type="button"
              onClick={onSuggest}
              className="mt-3 inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-900"
            >
              <PlusCircle size={16} />
              Đề xuất môn học mới
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PendingSuggestionsSection({ suggestions }) {
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'PENDING');
  if (pendingSuggestions.length === 0) return null;

  return (
    <section className="rounded-[8px] border border-amber-100 bg-amber-50 p-5 text-amber-900">
      <h2 className="font-display text-xl font-extrabold">Đề xuất đang chờ duyệt</h2>
      <div className="mt-4 grid gap-3">
        {pendingSuggestions.map((suggestion) => (
          <article key={suggestion.id} className="rounded-[8px] border border-amber-100 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-extrabold text-slate-950">{suggestion.suggestedName}</h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {suggestion.category?.name || 'Danh mục'} · {suggestion.group?.name || 'Nhóm môn'}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {(suggestion.levels || []).map((level) => levelLabels[level] || level).join(' · ')}
                </p>
              </div>
              <span className="w-fit rounded-full bg-amber-100 px-3 py-2 text-xs font-extrabold text-amber-800">
                Đang chờ Admin duyệt
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SubjectSuggestionForm({ initialName, categories, groups, selectedCategory, selectedGroup, requestedByUserId, busy, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    suggestedName: initialName,
    categoryId: selectedCategory?.id || '',
    groupId: selectedGroup?.id || '',
    levels: [],
    note: ''
  });
  const availableGroups = groups.filter((group) => !form.categoryId || group.category?.id === Number(form.categoryId));

  function toggleLevel(level) {
    setForm((current) => ({
      ...current,
      levels: current.levels.includes(level)
        ? current.levels.filter((item) => item !== level)
        : [...current.levels, level]
    }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.suggestedName.trim() || !form.categoryId || !form.groupId || form.levels.length === 0) return;
        onSubmit({
          suggestedName: form.suggestedName.trim(),
          categoryId: Number(form.categoryId),
          groupId: Number(form.groupId),
          requestedByUserId,
          levels: form.levels,
          note: form.note.trim() || null
        });
      }}
      className="rounded-[8px] border border-dashed border-[#147b77]/40 bg-white p-4"
    >
      <h3 className="font-display text-lg font-extrabold text-slate-950">Đề xuất môn học mới</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Tên môn đề xuất</span>
          <div><input value={form.suggestedName} onChange={(e) => setForm((c) => ({ ...c, suggestedName: e.target.value }))} /></div>
        </label>
        <label className="field">
          <span>Danh mục</span>
          <div>
            <select value={form.categoryId} onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value, groupId: '' }))}>
              <option value="">Chọn danh mục</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        </label>
        <label className="field sm:col-span-2">
          <span>Nhóm môn</span>
          <div>
            <select value={form.groupId} onChange={(e) => setForm((c) => ({ ...c, groupId: e.target.value }))}>
              <option value="">Chọn nhóm môn</option>
              {availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </div>
        </label>
      </div>
      <div className="mt-4">
        <span className="mb-2 block text-sm font-semibold">Level mong muốn</span>
        <div className="flex flex-wrap gap-2">
          {Object.keys(levelLabels).map((level) => (
            <button key={level} type="button" onClick={() => toggleLevel(level)} className={`rounded-full border px-3 py-2 text-xs font-extrabold ${form.levels.includes(level) ? 'border-[#147b77] bg-[#147b77] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {levelLabels[level]}
            </button>
          ))}
        </div>
      </div>
      <label className="field mt-4">
        <span>Ghi chú thêm</span>
        <div><textarea rows="3" value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} maxLength="1000" /></div>
      </label>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700">Hủy</button>
        <button type="submit" disabled={busy || !form.suggestedName.trim() || !form.categoryId || !form.groupId || form.levels.length === 0} className="rounded-[8px] bg-[#147b77] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">
          {busy ? 'Đang gửi...' : 'Gửi đề xuất'}
        </button>
      </div>
    </form>
  );
}

function InfoCard({ tone, title, children }) {
  const styles = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    red: 'border-red-100 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700'
  };

  return (
    <div className={`rounded-[8px] border p-4 text-sm font-semibold leading-6 ${styles[tone]}`}>
      <div className="flex items-start gap-3">
        {tone === 'red' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : null}
        <div>
          <p className="font-extrabold">{title}</p>
          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SubjectListSkeleton() {
  return (
    <div className="grid gap-4">
      {[0, 1].map((item) => (
        <div key={item} className="rounded-[8px] border border-slate-200 bg-white p-5">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-56 animate-pulse rounded bg-slate-100" />
          <div className="mt-5 h-4 w-full animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ editable }) {
  return (
    <div className="rounded-[8px] border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="font-display text-xl font-extrabold text-slate-950">Bạn chưa thêm môn học nào.</p>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        {editable
          ? 'Hãy tìm và thêm ít nhất một môn chính thức bạn muốn dạy. Đề xuất môn mới sẽ được gửi riêng đến Admin duyệt.'
          : 'Danh sách môn học sẽ hiển thị tại đây khi hồ sơ có dữ liệu.'}
      </p>
    </div>
  );
}

function toValidationMap(error) {
  if (!Array.isArray(error?.validationErrors)) return {};
  return error.validationErrors.reduce((acc, item) => {
    const field = item.field || item.name;
    if (field) acc[field] = item.message || 'Dữ liệu không hợp lệ.';
    return acc;
  }, {});
}

function toFriendlyMessage(error) {
  const message = error?.message || '';
  const lowerMessage = message.toLowerCase();
  if (error?.status === 409 && lowerMessage.includes('subject')) return 'Môn học này đã được thêm vào hồ sơ.';
  if (error?.status === 409) return message || 'Hồ sơ hiện không cho phép chỉnh sửa.';
  if (error?.status === 404) return message || 'Không tìm thấy dữ liệu cần thao tác.';
  if (error?.status === 403) return message || 'Bạn không có quyền thực hiện thao tác này.';
  if (error?.status === 400) return message || 'Vui lòng kiểm tra lại dữ liệu.';
  return message || 'Thao tác không thành công. Vui lòng thử lại.';
}

const levelLabels = {
  PRIMARY: 'Tiểu học',
  LOWER_SECONDARY: 'THCS',
  UPPER_SECONDARY: 'THPT',
  UNIVERSITY: 'Đại học',
  ADULT: 'Người lớn / Người đi làm',
  EXAM_PREPARATION: 'Luyện thi / Chứng chỉ'
};
