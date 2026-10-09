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
