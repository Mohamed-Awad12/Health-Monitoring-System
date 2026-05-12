import { useEffect, useMemo, useRef, useState } from "react";
import {
  getChatConversations,
  getConversationMessages,
  markConversationRead,
  sendConversationMessage,
} from "../../api/chatApi";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { useToast } from "../../hooks/useToast";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import EmptyState from "../ui/EmptyState";
import { FiClock, FiMessageSquare, FiSend } from "react-icons/fi";

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const sortConversations = (items) =>
  [...ensureArray(items)].sort((firstConversation, secondConversation) => {
    const firstDate = new Date(firstConversation.latestActivityAt || 0).getTime();
    const secondDate = new Date(secondConversation.latestActivityAt || 0).getTime();

    return secondDate - firstDate;
  });

const upsertConversation = (conversations, nextConversation) => {
  if (!nextConversation?.id) {
    return sortConversations(conversations);
  }

  if (nextConversation.status && nextConversation.status !== "active") {
    return conversations.filter((conversation) => conversation.id !== nextConversation.id);
  }

  const nextConversations = conversations.filter(
    (conversation) => conversation.id !== nextConversation.id
  );

  nextConversations.unshift(nextConversation);

  return sortConversations(nextConversations);
};

const upsertMessageList = (messages, nextMessage, position = "append") => {
  const currentMessages = ensureArray(messages);

  if (!nextMessage?.id) {
    return currentMessages;
  }

  const withoutDuplicate = currentMessages.filter((message) => message.id !== nextMessage.id);

  return position === "prepend"
    ? [nextMessage, ...withoutDuplicate]
    : [...withoutDuplicate, nextMessage].sort(
        (firstMessage, secondMessage) =>
          new Date(firstMessage.createdAt).getTime() -
          new Date(secondMessage.createdAt).getTime()
      );
};

const mergeMessages = (currentMessages, nextMessages, position = "replace") => {
  if (position === "replace") {
    return ensureArray(nextMessages);
  }

  if (position === "prepend") {
    const orderedIds = new Set();

    return [...ensureArray(nextMessages), ...ensureArray(currentMessages)].filter((message) => {
      if (!message?.id || orderedIds.has(message.id)) {
        return false;
      }

      orderedIds.add(message.id);
      return true;
    });
  }

  return ensureArray(nextMessages).reduce(
    (messages, nextMessage) => upsertMessageList(messages, nextMessage, "append"),
    currentMessages
  );
};

const getParticipantLabel = (conversation, t) =>
  conversation?.participant?.specialty ||
  t(`role.${conversation?.participant?.role}`) ||
  t("common.notAvailable");

const getConversationStatusLabel = (conversation, formatDateTime, t) =>
  conversation?.participant?.onlineStatus?.isOnline
    ? t("chat.participantOnline")
    : conversation?.participant?.onlineStatus?.lastSeenAt
      ? t("chat.participantLastSeen", {
          date: formatDateTime(conversation.participant.onlineStatus.lastSeenAt),
        })
      : t("chat.participantOffline");

export default function ChatPanel({ preferredParticipantId = "" }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();
  const { formatDateTime, t } = useUiPreferences();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [paginationByConversation, setPaginationByConversation] = useState({});
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [typingState, setTypingState] = useState({});
  const remoteTypingTimeoutsRef = useRef({});
  const localTypingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);
  const isTypingRef = useRef(false);
  const pendingReadRef = useRef(false);

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );
  const selectedMessages = selectedConversationId
    ? messagesByConversation[selectedConversationId] || []
    : [];
  const selectedPagination =
    paginationByConversation[selectedConversationId] || {
      hasMore: false,
      nextCursor: null,
    };

  useEffect(() => {
    let cancelled = false;

    const loadConversations = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getChatConversations();

        if (cancelled) {
          return;
        }

        setConversations(sortConversations(response.data?.conversations || []));
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.response?.data?.message || t("chat.loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadConversations().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId("");
      return;
    }

    if (preferredParticipantId) {
      const preferredConversation = conversations.find(
        (conversation) => conversation.participant?.id === preferredParticipantId
      );

      if (preferredConversation) {
        setSelectedConversationId((currentConversationId) =>
          currentConversationId === preferredConversation.id
            ? currentConversationId
            : preferredConversation.id
        );
        return;
      }
    }

    setSelectedConversationId((currentConversationId) =>
      conversations.some((conversation) => conversation.id === currentConversationId)
        ? currentConversationId
        : conversations[0]?.id || ""
    );
  }, [conversations, preferredParticipantId]);

  const updateConversationReadState = (conversationId, readAt) => {
    setMessagesByConversation((currentMessagesByConversation) => {
      const currentMessages = currentMessagesByConversation[conversationId] || [];

      return {
        ...currentMessagesByConversation,
        [conversationId]: currentMessages.map((message) =>
          message.recipientId === user?._id && !message.readAt
            ? { ...message, readAt }
            : message
        ),
      };
    });
  };

  const markSelectedConversationRead = async (conversationId) => {
    const targetConversation = conversations.find(
      (conversation) => conversation.id === conversationId
    );

    if (!conversationId || pendingReadRef.current || !targetConversation?.unreadCount) {
      return;
    }

    pendingReadRef.current = true;

    try {
      const response = await markConversationRead(conversationId);
      const nextConversation = response.data?.conversation;
      const readAt = response.data?.readAt;

      if (nextConversation) {
        setConversations((currentConversations) =>
          upsertConversation(currentConversations, nextConversation)
        );
      }

      if (readAt) {
        updateConversationReadState(conversationId, readAt);
      }
    } catch {
      addToast({ type: "error", message: t("chat.readFailed") });
    } finally {
      pendingReadRef.current = false;
    }
  };

  const loadConversationMessages = async (
    conversationId,
    { before = undefined, mode = "replace" } = {}
  ) => {
    if (!conversationId) {
      return;
    }

    if (mode === "prepend") {
      setLoadingOlder(true);
    } else {
      setMessagesLoading(true);
    }

    setError("");

    try {
      const response = await getConversationMessages(conversationId, {
        limit: 30,
        before,
      });
      const nextMessages = response.data?.messages || [];
      const pagination = response.data?.pagination || {
        hasMore: false,
        nextCursor: null,
      };
      const nextConversation = response.data?.conversation;

      if (nextConversation) {
        setConversations((currentConversations) =>
          upsertConversation(currentConversations, nextConversation)
        );
      }

      setMessagesByConversation((currentMessagesByConversation) => ({
        ...currentMessagesByConversation,
        [conversationId]: mergeMessages(
          currentMessagesByConversation[conversationId] || [],
          nextMessages,
          mode
        ),
      }));
      setPaginationByConversation((currentPaginationByConversation) => ({
        ...currentPaginationByConversation,
        [conversationId]: pagination,
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("chat.messagesLoadFailed"));
    } finally {
      setMessagesLoading(false);
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    if (!selectedConversationId) {
      return undefined;
    }

    loadConversationMessages(selectedConversationId).catch(() => {});

    return undefined;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        markSelectedConversationRead(selectedConversationId).catch(() => {});
      }
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedConversationId, conversations]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleMessage = (payload = {}) => {
      const nextConversation = payload.conversation;
      const nextMessage = payload.message;

      if (!nextConversation?.id || !nextMessage?.id) {
        return;
      }

      setConversations((currentConversations) =>
        upsertConversation(currentConversations, nextConversation)
      );
      setMessagesByConversation((currentMessagesByConversation) => ({
        ...currentMessagesByConversation,
        [nextConversation.id]: upsertMessageList(
          currentMessagesByConversation[nextConversation.id] || [],
          nextMessage,
          "append"
        ),
      }));

      if (
        nextConversation.id === selectedConversationId &&
        nextMessage.senderId !== user?._id &&
        document.visibilityState === "visible"
      ) {
        markSelectedConversationRead(nextConversation.id).catch(() => {});
      }
    };

    const handleConversationUpdate = (payload = {}) => {
      const nextConversation = payload.conversation;

      if (!nextConversation?.id) {
        return;
      }

      setConversations((currentConversations) =>
        upsertConversation(currentConversations, nextConversation)
      );
    };

    const handlePresenceUpdate = (payload = {}) => {
      if (!payload.userId) {
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.participant?.id === payload.userId
            ? {
                ...conversation,
                participant: {
                  ...conversation.participant,
                  onlineStatus: {
                    isOnline: Boolean(payload.isOnline),
                    onlineSince: payload.onlineSince || null,
                    lastSeenAt: payload.lastSeenAt || null,
                  },
                },
              }
            : conversation
        )
      );
    };

    const handleTypingUpdate = (payload = {}) => {
      if (!payload.conversationId || payload.userId === user?._id) {
        return;
      }

      setTypingState((currentTypingState) => ({
        ...currentTypingState,
        [payload.conversationId]: payload.isTyping ? payload : null,
      }));

      const existingTimeoutId = remoteTypingTimeoutsRef.current[payload.conversationId];

      if (existingTimeoutId) {
        window.clearTimeout(existingTimeoutId);
      }

      if (payload.isTyping) {
        remoteTypingTimeoutsRef.current[payload.conversationId] = window.setTimeout(() => {
          setTypingState((currentTypingState) => ({
            ...currentTypingState,
            [payload.conversationId]: null,
          }));
        }, 3200);
      }
    };

    socket.on("chat:message:new", handleMessage);
    socket.on("chat:conversation:updated", handleConversationUpdate);
    socket.on("chat:presence:update", handlePresenceUpdate);
    socket.on("chat:typing:update", handleTypingUpdate);

    return () => {
      socket.off("chat:message:new", handleMessage);
      socket.off("chat:conversation:updated", handleConversationUpdate);
      socket.off("chat:presence:update", handlePresenceUpdate);
      socket.off("chat:typing:update", handleTypingUpdate);
    };
  }, [socket, selectedConversationId, user?._id]);

  const emitTypingState = (isTyping) => {
    if (!socket?.connected || !selectedConversationId) {
      return;
    }

    socket.emit(isTyping ? "chat:typing:start" : "chat:typing:stop", {
      conversationId: selectedConversationId,
    });
  };

  const stopTyping = () => {
    if (!isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;
    emitTypingState(false);
  };

  const handleDraftChange = (event) => {
    const nextValue = event.target.value;

    setDraft(nextValue);

    if (!selectedConversationId || !socket?.connected) {
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTypingState(true);
    }

    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
    }

    localTypingTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1400);
  };

  const handleLoadOlder = async () => {
    if (!selectedConversationId || !selectedPagination.hasMore || loadingOlder) {
      return;
    }

    await loadConversationMessages(selectedConversationId, {
      before: selectedPagination.nextCursor,
      mode: "prepend",
    });
  };

  const sendViaSocket = (conversationId, body) =>
    new Promise((resolve, reject) => {
      const payload = {
        conversationId,
        body,
      };

      if (typeof socket?.timeout === "function") {
        socket.timeout(5000).emit("chat:message:send", payload, (error, response) => {
          if (error) {
            reject(new Error(t("chat.sendFailed")));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.message || t("chat.sendFailed")));
            return;
          }

          resolve(response);
        });

        return;
      }

      socket.emit("chat:message:send", payload, (response) => {
        if (!response?.ok) {
          reject(new Error(response?.message || t("chat.sendFailed")));
          return;
        }

        resolve(response);
      });
    });

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!selectedConversationId || sending) {
      return;
    }

    const nextBody = draft.trim();

    if (!nextBody) {
      return;
    }

    setSending(true);
    setDraft("");
    stopTyping();

    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }

    try {
      if (socket?.connected) {
        await sendViaSocket(selectedConversationId, nextBody);
      } else {
        const response = await sendConversationMessage(selectedConversationId, {
          body: nextBody,
        });
        const nextConversation = response.data?.conversation;
        const nextMessage = response.data?.chatMessage;

        if (nextConversation) {
          setConversations((currentConversations) =>
            upsertConversation(currentConversations, nextConversation)
          );
        }

        if (nextMessage) {
          setMessagesByConversation((currentMessagesByConversation) => ({
            ...currentMessagesByConversation,
            [selectedConversationId]: upsertMessageList(
              currentMessagesByConversation[selectedConversationId] || [],
              nextMessage,
              "append"
            ),
          }));
        }
      }
    } catch (requestError) {
      setDraft(nextBody);
      addToast({
        type: "error",
        message: requestError.message || t("chat.sendFailed"),
      });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (localTypingTimeoutRef.current) {
        window.clearTimeout(localTypingTimeoutRef.current);
      }

      Object.values(remoteTypingTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  useEffect(() => {
    const textarea = messageInputRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 220 ? "auto" : "hidden";
  }, [draft, selectedConversationId]);

  const handleDraftKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event).catch(() => {});
    }
  };

  const typingParticipant = typingState[selectedConversationId];
  const selectedStatusText = selectedConversation
    ? selectedConversation.participant?.onlineStatus?.isOnline
      ? t("chat.participantOnline")
      : selectedConversation.participant?.onlineStatus?.lastSeenAt
        ? t("chat.participantLastSeen", {
            date: formatDateTime(selectedConversation.participant.onlineStatus.lastSeenAt),
          })
        : t("chat.participantOffline")
    : "";

  if (loading) {
    return (
      <div className="chat-panel chat-panel-loading">
        <div className="loading-dot" />
      </div>
    );
  }

  return (
    <div className="chat-panel">
      {error ? <div className="form-error">{error}</div> : null}

      {!conversations.length ? (
        <EmptyState
          icon={FiMessageSquare}
          title={t("chat.emptyTitle")}
          description={t("chat.emptyDescription")}
        />
      ) : (
        <div className="chat-layout">
          <aside className="chat-sidebar">
            <div className="chat-sidebar-header">
              <div>
                <strong>{t("chat.secureChannel")}</strong>
                <p>{t("chat.secureChannelDescription")}</p>
              </div>
              <span className="chat-sidebar-count">
                {t("chat.unreadCount", {
                  count: conversations.reduce(
                    (total, conversation) => total + (conversation.unreadCount || 0),
                    0
                  ),
                })}
              </span>
            </div>

            <div className="chat-conversation-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={
                    conversation.id === selectedConversationId
                      ? "chat-conversation-item active"
                      : "chat-conversation-item"
                  }
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <div className="chat-conversation-top">
                    <div>
                      <strong>{conversation.participant?.name}</strong>
                      <span>{getParticipantLabel(conversation, t)}</span>
                    </div>
                    <span
                      className={
                        conversation.participant?.onlineStatus?.isOnline
                          ? "chat-status-dot online"
                          : "chat-status-dot"
                      }
                      aria-hidden="true"
                    />
                  </div>

                  <p className="chat-conversation-preview">
                    {conversation.lastMessage?.bodyPreview || t("chat.noMessages")}
                  </p>

                  <div className="chat-conversation-meta">
                    <small>
                      {getConversationStatusLabel(conversation, formatDateTime, t)}
                    </small>
                    {conversation.unreadCount ? (
                      <span className="chat-unread-badge">{conversation.unreadCount}</span>
                    ) : (
                      <small>{formatDateTime(conversation.latestActivityAt)}</small>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="chat-thread">
            {selectedConversation ? (
              <>
                <header className="chat-thread-header">
                  <div>
                    <div className="chat-thread-title-row">
                      <h3>{selectedConversation.participant?.name}</h3>
                      <span
                        className={
                          selectedConversation.participant?.onlineStatus?.isOnline
                            ? "chat-status-dot online"
                            : "chat-status-dot"
                        }
                        aria-hidden="true"
                      />
                    </div>
                    <p>{getParticipantLabel(selectedConversation, t)}</p>
                    <small>{selectedStatusText}</small>
                  </div>

                  <div className="chat-thread-security">
                    <FiClock aria-hidden="true" />
                    <span>{t("chat.timestampsEnabled")}</span>
                  </div>
                </header>

                <div className="chat-messages-shell">
                  {selectedPagination.hasMore ? (
                    <button
                      className="ghost-button chat-load-older"
                      type="button"
                      disabled={loadingOlder}
                      onClick={handleLoadOlder}
                    >
                      {loadingOlder ? t("common.loading") : t("chat.loadOlder")}
                    </button>
                  ) : null}

                  <div className="chat-messages-list" role="log" aria-live="polite">
                    {messagesLoading && !selectedMessages.length ? (
                      <div className="chat-panel-loading">
                        <div className="loading-dot" />
                      </div>
                    ) : selectedMessages.length ? (
                      selectedMessages.map((message) => (
                        <div
                          key={message.id}
                          className={
                            message.isOwnMessage
                              ? "chat-message-row own"
                              : "chat-message-row"
                          }
                        >
                          <article
                            className={
                              message.isOwnMessage
                                ? "chat-message-bubble own"
                                : "chat-message-bubble"
                            }
                          >
                            <p>{message.body}</p>
                            <footer>
                              <span>{formatDateTime(message.createdAt)}</span>
                            </footer>
                          </article>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        icon={FiMessageSquare}
                        title={t("chat.emptyConversationTitle")}
                        description={t("chat.emptyConversationDescription")}
                      />
                    )}
                  </div>
                </div>

                <div className="chat-thread-footer">
                  <div className="chat-typing-row" aria-live="polite">
                    {typingParticipant?.isTyping
                      ? t("chat.typing", { name: typingParticipant.name })
                      : t("chat.openConversation")}
                  </div>

                  <form className="chat-compose-form" onSubmit={handleSendMessage}>
                    <div className="chat-compose-input">
                      <textarea
                        ref={messageInputRef}
                        value={draft}
                        rows={1}
                        maxLength={2000}
                        placeholder={t("chat.messagePlaceholder")}
                        onChange={handleDraftChange}
                        onKeyDown={handleDraftKeyDown}
                        onBlur={stopTyping}
                      />
                      <div className="chat-compose-meta">
                        <span className="chat-compose-count">{draft.length}/2000</span>
                      </div>
                    </div>
                    <button
                      className="primary-button chat-send-button"
                      type="submit"
                      disabled={!draft.trim() || sending}
                    >
                      <FiSend aria-hidden="true" />
                      <span>{sending ? t("chat.sending") : t("chat.send")}</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <EmptyState
                icon={FiMessageSquare}
                title={t("chat.emptyConversationTitle")}
                description={t("chat.emptyConversationDescription")}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
