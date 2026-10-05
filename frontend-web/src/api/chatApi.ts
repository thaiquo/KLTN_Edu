import { apiRequest } from './client';

export interface ChatConversationDto {
  id: string;
  counterpartUserId?: number;
  counterpartEmail?: string;
  counterpartDisplayName?: string;
  counterpartAvatarUrl?: string | null;
  counterpartRole?: string | null;
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

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: number;
  senderEmail?: string;
  recipientId?: number;
  recipientEmail?: string;
  type?: 'TEXT' | 'IMAGE' | 'VIDEO';
  content: string;
  attachments?: ChatAttachmentDto[];
  isRead?: boolean;
  createdAt: string;
}

export interface ChatAttachmentDto {
  id?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  size?: number | null;
  url?: string | null;
}

export interface ChatMessagePageDto {
  content: ChatMessageDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  order: string;
}

export interface MarkReadResponse {
  updatedCount: number;
  unreadCount: number;
}

export const CHAT_MESSAGE_MAX_LENGTH = 3000;
export const CHAT_IMAGE_MAX_FILES = 5;
export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_VIDEO_MAX_BYTES = 40 * 1024 * 1024;
export const CHAT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const CHAT_VIDEO_ACCEPT = 'video/mp4,video/webm';
export const CHAT_ATTACHMENT_ACCEPT = `${CHAT_IMAGE_ACCEPT},${CHAT_VIDEO_ACCEPT}`;
export const CHAT_IMAGE_TYPES = new Set(CHAT_IMAGE_ACCEPT.split(','));
export const CHAT_VIDEO_TYPES = new Set(CHAT_VIDEO_ACCEPT.split(','));
export const CHAT_ATTACHMENT_TYPES = new Set(CHAT_ATTACHMENT_ACCEPT.split(','));

export const chatApi = {
  createDirectConversation(recipientUserId: number | string): Promise<ChatConversationDto> {
    return apiRequest('/api/chat/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ recipientUserId: Number(recipientUserId) })
    });
  },

  getConversations(): Promise<ChatConversationDto[]> {
    return apiRequest('/api/chat/conversations');
  },

  getMessages(conversationId: string, page = 0, size = 30): Promise<ChatMessagePageDto> {
    return apiRequest(`/api/chat/conversations/${conversationId}/messages?page=${page}&size=${size}`);
  },

  sendMessage(conversationId: string, content: string): Promise<ChatMessageDto> {
    return apiRequest('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId, content })
    });
  },

  sendAttachment(conversationId: string, files: File | File[], caption?: string): Promise<ChatMessageDto> {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    fileList.forEach((file) => formData.append('files', file));
    const normalizedCaption = caption?.trim();
    if (normalizedCaption) {
      formData.append('caption', normalizedCaption);
    }
    return apiRequest(`/api/chat/conversations/${conversationId}/attachments`, {
      method: 'POST',
      body: formData
    });
  },

  markRead(conversationId: string): Promise<MarkReadResponse> {
    return apiRequest(`/api/chat/conversations/${conversationId}/read`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }
};
