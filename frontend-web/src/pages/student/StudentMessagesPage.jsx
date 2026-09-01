import { MessageCircle } from 'lucide-react';
import { StudentEmptyState, StudentPageScaffold } from './StudentPageScaffold';

export function StudentMessagesPage() {
  return (
    <StudentPageScaffold
      eyebrow="Tin nhắn"
      title="Tin nhắn"
      description="Tin nhắn Student sẽ được nối bằng API thật khi messaging backend sẵn sàng."
    >
      <StudentEmptyState
        icon={<MessageCircle size={24} />}
        title="Chưa có trung tâm tin nhắn thật"
        description="Legacy MessagesView đang dùng mock/local state nên không được migrate như dữ liệu thật trong phase này."
      />
    </StudentPageScaffold>
  );
}
