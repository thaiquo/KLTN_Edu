import { apiRequest } from './client';

export async function sendChatMessage({ message, conversation = [], pageContext = null }) {
  return apiRequest('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      conversation,
      pageContext
    })
  });
}

export async function getChatKnowledgeStatus() {
  return apiRequest('/api/ai/chat/knowledge-status');
}

export async function getAdminChatKnowledgeStatus() {
  return apiRequest('/api/ai/admin/chatbot-knowledge/status');
}

export async function reindexAdminChatKnowledge() {
  return apiRequest('/api/ai/admin/chatbot-knowledge/reindex', {
    method: 'POST'
  });
}
