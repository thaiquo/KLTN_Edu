import { Sparkles } from 'lucide-react';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';

export function StudentMatchingPage() {
  return (
    <StudentPageScaffold
      eyebrow="AI Matching"
      title="Gợi ý cho bạn"
      description="Khu vực này sẽ dùng cho gợi ý gia sư/lớp học khi AI service và Learning Profile được triển khai."
    >
      <StudentEmptyState
        icon={<Sparkles size={24} />}
        title="Tính năng AI Matching đang được phát triển"
        description="Hiện chưa có AI frontend API hoặc backend service thật để trả recommendation, matching score hay lý do gợi ý."
      />
    </StudentPageScaffold>
  );
}
