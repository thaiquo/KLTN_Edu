import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8080',
  withCredentials: true,
});

export interface NotificationItem {
  id: string;
  recipientEmail: string;
  recipientId?: number;
  title: string;
  content: string;
  type: string;
  referenceType?: string;
  referenceId?: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  metadataJson?: string;
}

export interface ConversationItem {
  id: string;
  participant1Id: number;
  participant1Email: string;
  participant2Id: number;
  participant2Email: string;
  lastMessage: string;
  lastMessageTime: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  senderId: number;
  senderEmail: string;
  recipientId: number;
  recipientEmail: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  getNotifications: async (userEmail: string, page = 0, size = 20): Promise<{ content: NotificationItem[]; totalElements: number }> => {
    const res = await api.get('/api/notifications', {
      params: { email: userEmail, page, size },
      headers: { 'X-User-Email': userEmail },
    });
    return res.data;
  },

  getUnreadCount: async (userEmail: string): Promise<number> => {
    const res = await api.get('/api/notifications/unread-count', {
      params: { email: userEmail },
      headers: { 'X-User-Email': userEmail },
    });
    return res.data?.unreadCount || 0;
  },

  markAsRead: async (notificationId: string, userEmail: string): Promise<NotificationItem> => {
    const res = await api.patch(`/api/notifications/${notificationId}/read`, null, {
      params: { email: userEmail },
      headers: { 'X-User-Email': userEmail },
    });
    return res.data;
  },

  markAllAsRead: async (userEmail: string): Promise<number> => {
    const res = await api.patch('/api/notifications/read-all', null, {
      params: { email: userEmail },
      headers: { 'X-User-Email': userEmail },
    });
    return res.data?.updatedCount || 0;
  },

  getConversations: async (userEmail: string): Promise<ConversationItem[]> => {
    const res = await api.get('/api/chat/conversations', {
      params: { email: userEmail },
      headers: { 'X-User-Email': userEmail },
    });
    return res.data || [];
  },

  getMessages: async (conversationId: string, userEmail: string): Promise<ChatMessageItem[]> => {
    const res = await api.get(`/api/chat/conversations/${conversationId}/messages`, {
      params: { email: userEmail },
      headers: { 'X-User-Email': userEmail },
    });
    return res.data || [];
  },

  sendMessage: async (
    senderId: number,
    senderEmail: string,
    recipientId: number,
    recipientEmail: string,
    content: string,
    conversationId?: string
  ): Promise<ChatMessageItem> => {
    const res = await api.post(
      '/api/chat/messages',
      { conversationId, recipientId, recipientEmail, content },
      {
        params: { senderId, senderEmail },
        headers: { 'X-User-Id': String(senderId), 'X-User-Email': senderEmail },
      }
    );
    return res.data;
  },
};
