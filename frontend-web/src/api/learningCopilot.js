import { apiRequest } from './client';

export const learningCopilotApi = {
  generateLessonDraft({ classId, sessionId }) {
    return apiRequest('/api/ai/learning-copilot/lesson-draft', {
      method: 'POST',
      body: JSON.stringify({ classId, sessionId })
    });
  },
  generateHomeworkFeedbackDraft({ classId, sessionId, attendanceId, score, selectedFeedback, tutorNotes }) {
    return apiRequest('/api/ai/learning-copilot/homework-feedback-draft', {
      method: 'POST',
      body: JSON.stringify({ classId, sessionId, attendanceId, score, selectedFeedback, tutorNotes })
    });
  }
};
