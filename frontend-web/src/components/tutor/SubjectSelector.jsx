import { useMemo } from 'react';

export function SubjectSelector({
  subjects,
  selectedIds,
  categoryId,
  keyword,
  onCategoryChange,
  onKeywordChange,
  onToggleSubject
}) {
  const categories = useMemo(() => {
    const map = new Map();
    subjects.forEach((subject) => {
      if (subject.category) {
        map.set(subject.category.id, subject.category);
      }
    });
    return Array.from(map.values());
  }, [subjects]);

  const visibleSubjects = subjects.filter((subject) => {
    const matchesCategory = !categoryId || String(subject.category?.id) === String(categoryId);
    const matchesKeyword = !keyword || subject.name.toLowerCase().includes(keyword.toLowerCase());
    return matchesCategory && matchesKeyword;
  });

  return (
    <div className="subject-selector">
      <div className="subject-tools">
        <label>
          <span>Linh vuc</span>
          <select value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">Tat ca linh vuc</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Tim mon</span>
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="java"
          />
        </label>
      </div>

      <div className="subject-grid">
        {visibleSubjects.map((subject) => {
          const checked = selectedIds.includes(subject.id);
          return (
            <button
              key={subject.id}
              type="button"
              className={checked ? 'subject-option selected' : 'subject-option'}
              onClick={() => onToggleSubject(subject.id)}
            >
              <span>{subject.name}</span>
              <b>{checked ? '✓' : '+'}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}
