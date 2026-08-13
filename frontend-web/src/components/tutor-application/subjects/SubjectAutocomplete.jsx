import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, PlusCircle, Search } from 'lucide-react';
import { subjectApi } from '../../../api/subjects';

export function SubjectAutocomplete({ selectedSubjectIds = [], disabled, onSelect, onSuggest }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSeq = useRef(0);

  useEffect(() => {
    if (disabled) return undefined;

    const seq = ++requestSeq.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const subjects = await subjectApi.list({ keyword: keyword.trim(), limit: 10 });
        if (seq === requestSeq.current) {
          setResults(Array.isArray(subjects) ? subjects : []);
        }
      } catch (searchError) {
        if (seq === requestSeq.current) {
          setError(searchError.message || 'Không thể tìm môn học.');
          setResults([]);
        }
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [keyword, disabled]);

  const trimmedKeyword = keyword.trim();

  return (
    <div>
      <label className="field">
        <span>Tìm kiếm môn học</span>
        <div>
          <Search size={18} className="ml-4 mt-3.5 shrink-0 text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Gõ Java, IELTS, Toán..."
            disabled={disabled}
            aria-label="Tìm kiếm môn học"
          />
        </div>
      </label>

      <div className="mt-3 overflow-hidden rounded-[8px] border border-slate-200 bg-white">
        {loading && (
          <div className="flex items-center gap-2 p-4 text-sm font-bold text-slate-500">
            <LoaderCircle size={16} className="animate-spin" />
            Đang tìm môn học...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 p-4 text-sm font-bold text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="p-4">
            <p className="text-sm font-extrabold text-slate-800">Không tìm thấy môn phù hợp.</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Bạn có thể đề xuất môn mới để Staff bổ sung vào catalog chính thức.
            </p>
            {trimmedKeyword && onSuggest && (
              <button
                type="button"
                onClick={() => onSuggest(trimmedKeyword)}
                className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary"
              >
                <PlusCircle size={16} />
                Đề xuất “{trimmedKeyword}”
              </button>
            )}
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="divide-y divide-slate-100">
            {results.map((subject) => {
              const added = selectedSubjectIds.includes(subject.id);
              const categoryName = subject.category?.name || 'Chưa phân loại';
              const groupName = subject.group?.name;

              return (
                <button
                  key={subject.id}
                  type="button"
                  disabled={added || disabled}
                  onClick={() => onSelect(subject)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-slate-950">{subject.name}</span>
                    <span className="mt-1 block truncate text-xs font-bold text-slate-500">
                      {groupName ? `${categoryName} · ${groupName}` : categoryName}
                    </span>
                    {subject.supportedLevels?.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {subject.supportedLevels.slice(0, 4).map((level) => (
                          <small key={level} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-500">
                            {levelLabels[level] || level}
                          </small>
                        ))}
                        {subject.supportedLevels.length > 4 && (
                          <small className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-500">
                            +{subject.supportedLevels.length - 4}
                          </small>
                        )}
                      </span>
                    )}
                  </span>
                  {added ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                      <CheckCircle2 size={14} />
                      Đã thêm
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary">
                      Chọn
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const levelLabels = {
  PRIMARY: 'Tiểu học',
  LOWER_SECONDARY: 'THCS',
  UPPER_SECONDARY: 'THPT',
  UNIVERSITY: 'Đại học',
  ADULT: 'Người lớn / Người đi làm',
  EXAM_PREPARATION: 'Luyện thi / Chứng chỉ'
};
