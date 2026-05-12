import api from "./axios";

export const getChatConversations = () => api.get("/chat/conversations");

export const getConversationMessages = (conversationId, params = {}) =>
  api.get(`/chat/conversations/${conversationId}/messages`, { params });

export const sendConversationMessage = (conversationId, payload) =>
  api.post(`/chat/conversations/${conversationId}/messages`, payload);

export const markConversationRead = (conversationId) =>
  api.post(`/chat/conversations/${conversationId}/read`);
