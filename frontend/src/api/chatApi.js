import api, { apiBaseUrl } from "./axios";

export const getChatConversations = () => api.get("/chat/conversations");

export const getConversationMessages = (conversationId, params = {}) =>
  api.get(`/chat/conversations/${conversationId}/messages`, { params });

export const sendConversationMessage = (conversationId, payload) =>
  api.post(`/chat/conversations/${conversationId}/messages`, payload);

export const sendConversationAttachmentMessage = (conversationId, payload) =>
  api.post(`/chat/conversations/${conversationId}/messages/attachment`, payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const markConversationRead = (conversationId) =>
  api.post(`/chat/conversations/${conversationId}/read`);

export const buildConversationAttachmentUrl = (attachmentPath = "") => {
  if (!attachmentPath) {
    return "";
  }

  return new URL(
    attachmentPath.replace(/^\//, ""),
    `${apiBaseUrl.replace(/\/$/, "")}/`
  ).toString();
};
