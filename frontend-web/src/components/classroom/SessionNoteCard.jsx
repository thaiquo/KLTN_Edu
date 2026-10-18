import { useMemo, useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';

const SECTION_TITLES = {
  'mục tiêu': 'Mục tiêu',
  'khởi động': 'Khởi động',
  'tiến trình': 'Tiến trình buổi học',
  'tiến trình chính': 'Tiến trình buổi học',
  'tiến trình buổi học': 'Tiến trình buổi học',
  'hoạt động luyện tập': 'Hoạt động luyện tập',
  'trọng tâm cần chốt': 'Trọng tâm cần đạt',
  'trọng tâm cần đạt': 'Trọng tâm cần đạt',
  'gợi ý': 'Gợi ý / dặn dò',
  'gợi ý / dặn dò': 'Gợi ý / dặn dò',
  'gợi ý bài tập tham khảo (chưa tự động giao)': 'Bài tập sau buổi học',
  'bài tập sau buổi học': 'Bài tập sau buổi học',
  'gợi ý buổi sau': 'Buổi học tiếp theo',
  'buổi học tiếp theo': 'Buổi học tiếp theo',
  'dặn dò': 'Gợi ý / dặn dò'
};

const SECTION_ORDER = [
  'Mục tiêu',
  'Khởi động',
  'Tiến trình buổi học',
  'Hoạt động luyện tập',
  'Trọng tâm cần đạt',
  'Bài tập sau buổi học',
  'Buổi học tiếp theo',
  'Gợi ý / dặn dò',
  'Ghi chú buổi học'
];

function parseNote(note) {
  const sections = new Map();
  const usedItems = new Set();
  let currentSection = null;

  note.replace(/\r\n?/g, '\n').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const header = line.replace(/:$/, '').toLocaleLowerCase('vi-VN');
    const title = SECTION_TITLES[header];
    if (title) {
      currentSection = sections.get(title) || { title, items: [] };
      sections.set(title, currentSection);
      return;
    }

    if (!currentSection) {
      currentSection = sections.get('Ghi chú buổi học') || { title: 'Ghi chú buổi học', items: [] };
      sections.set('Ghi chú buổi học', currentSection);
    }
    const item = line.replace(/^[-•]\s*/, '');
    const key = item.replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
    if (!usedItems.has(key)) {
      usedItems.add(key);
      currentSection.items.push(item);
    }
  });

  return [...sections.values()]
    .filter((section) => section.items.length > 0)
    .sort((left, right) => SECTION_ORDER.indexOf(left.title) - SECTION_ORDER.indexOf(right.title));
}

export function SessionNoteCard({ note, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const normalizedNote = note?.trim();
  const sections = useMemo(() => normalizedNote ? parseNote(normalizedNote) : [], [normalizedNote]);

  if (!normalizedNote || !sections.length) return null;

  const lineCount = normalizedNote.split(/\r?\n/).filter(Boolean).length;
  const isLong = normalizedNote.length > 360 || lineCount > 9;

  return (
    <section className={`rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 ${className}`}>
      <div className="flex items-start gap-2">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-900">Ghi chú bài giảng từ gia sư</p>
          <div className={`mt-2 space-y-3 ${isLong && !expanded ? 'max-h-40 overflow-hidden' : ''}`}>
            {sections.map((section, sectionIndex) => (
              <div key={`${section.title}-${sectionIndex}`}>
                <p className="font-extrabold text-amber-950">{section.title}</p>
                <ul className="mt-1 space-y-1 pl-4 leading-relaxed marker:text-amber-700">
                  {section.items.map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`} className="break-words">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950"
              aria-expanded={expanded}
            >
              <span>{expanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
