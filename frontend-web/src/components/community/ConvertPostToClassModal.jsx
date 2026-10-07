import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import communityApi from '../../api/community';
import { CreateClassWizard } from '../../portal/components/CreateClassWizard';

export function ConvertPostToClassModal({ isOpen, onClose, post, onConverted }) {
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !post?.id) return;
    let active = true;
    setLoading(true);
    setError('');
    setSuggestion(null);
    communityApi.getClassSuggestion(post.id)
      .then(result => {
        if (active) setSuggestion(result);
      })
      .catch(err => {
        if (active) setError(err?.message || 'Không thể tạo lịch đề xuất từ khảo sát.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isOpen, post?.id]);

  if (!isOpen || !post) return null;

  const initialDraft = suggestion ? {
    subjectId: post.subjectId,
    subjectName: post.subjectName,
    educationLevel: post.educationLevel,
    name: post.title,
    description: post.content,
    learningMode: post.learningMode || 'ONLINE',
    pricePerSession: post.targetPricePerSession,
    address: post.address,
    sessionsPerWeek: suggestion.sessionsPerWeek,
    durationMinutes: suggestion.durationMinutes,
    maxStudents: suggestion.suggestedMaxStudents,
    schedules: suggestion.recommendedSchedules || [],
    participantCount: suggestion.participantCount || 0,
    matchingStudentCount: suggestion.matchingStudentCount || 0,
    warnings: suggestion.warnings || []
  } : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full p-3 sm:p-6">
        <div className="max-w-6xl mx-auto bg-slate-50 border border-slate-200 shadow-2xl rounded-2xl p-4 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>

          {loading && (
            <div className="min-h-[360px] flex flex-col items-center justify-center gap-3 text-slate-600">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <p className="text-sm font-bold">Đang đối chiếu kết quả vote với lịch rảnh của bạn...</p>
            </div>
          )}

          {!loading && error && (
            <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="w-9 h-9 text-rose-500" />
              <p className="text-sm font-bold text-rose-700">{error}</p>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">
                Đóng
              </button>
            </div>
          )}

          {!loading && !error && initialDraft && (
            <CreateClassWizard
              sourcePostId={Number(post.id)}
              initialDraft={initialDraft}
              onBack={onClose}
              onSuccess={result => onConverted?.(result)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ConvertPostToClassModal;
