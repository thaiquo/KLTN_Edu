import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatApi } from '../api/chatApi';
import { useFeedback } from '../components/feedback/useFeedback';
import { useAuth } from './useAuth';

export function useStartTutorConversation() {
  const navigate = useNavigate();
  const location = useLocation();
  const feedback = useFeedback();
  const { authenticated, user } = useAuth();
  const [startingTutorUserId, setStartingTutorUserId] = useState(null);

  const currentUserId = user?.id ?? user?.userId;
  const activeRole = String(user?.activeRole || '').toUpperCase();

  const canShowChatAction = useCallback((tutorUserId) => {
    if (currentUserId && tutorUserId && Number(currentUserId) === Number(tutorUserId)) {
      return false;
    }
    return !authenticated || activeRole === 'STUDENT';
  }, [activeRole, authenticated, currentUserId]);

  const startTutorConversation = useCallback(async (tutorUserId) => {
    if (!tutorUserId) {
      feedback.error('Hồ sơ gia sư chưa có mã tài khoản để mở tin nhắn.');
      return null;
    }

    if (!authenticated) {
      navigate('/login', {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search
          }
        }
      });
      return null;
    }

    if (activeRole !== 'STUDENT') {
      feedback.warning('Chỉ tài khoản Học viên mới có thể nhắn tin trực tiếp với gia sư.');
      return null;
    }

    if (currentUserId && Number(currentUserId) === Number(tutorUserId)) {
      feedback.warning('Bạn không thể tự nhắn tin với chính mình.');
      return null;
    }

    setStartingTutorUserId(Number(tutorUserId));
    try {
      const conversation = await chatApi.createDirectConversation(tutorUserId);
      navigate(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
      return conversation;
    } catch (error) {
      if (error?.status === 401) {
        navigate('/login', {
          state: {
            from: {
              pathname: location.pathname,
              search: location.search
            }
          }
        });
      } else if (error?.status === 403) {
        feedback.error('Bạn chỉ có thể nhắn tin với gia sư đã được duyệt khi đang ở vai trò Học viên.');
      } else if (error?.status === 404) {
        feedback.error('Không tìm thấy tài khoản gia sư để mở cuộc trò chuyện.');
      } else {
        feedback.error(error?.message || 'Không thể mở cuộc trò chuyện. Vui lòng thử lại.');
      }
      return null;
    } finally {
      setStartingTutorUserId(null);
    }
  }, [activeRole, authenticated, currentUserId, feedback, location.pathname, location.search, navigate]);

  return useMemo(() => ({
    canShowChatAction,
    startTutorConversation,
    startingTutorUserId
  }), [canShowChatAction, startTutorConversation, startingTutorUserId]);
}
