import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axios";
import {
  getChatConversations,
  getConversationMessages,
  markConversationRead,
  sendConversationAttachmentMessage,
  sendConversationMessage,
} from "../../api/chatApi";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { useToast } from "../../hooks/useToast";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import EmptyState from "../ui/EmptyState";
import {
  FiArrowDown,
  FiCheck,
  FiClock,
  FiDownload,
  FiFileText,
  FiImage,
  FiMessageSquare,
  FiMic,
  FiPaperclip,
  FiSearch,
  FiSend,
  FiSquare,
  FiX,
} from "react-icons/fi";

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

const isNearBottom = (element, threshold = 96) => {
  if (!element) {
    return true;
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
};

const IMAGE_FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const DOCUMENT_FILE_ACCEPT =
  ".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip,application/pdf,text/plain,text/csv";

const getClientAttachmentKind = (file) => {
  if (String(file?.type || "").startsWith("image/")) {
    return "image";
  }

  if (String(file?.type || "").startsWith("audio/")) {
    return "audio";
  }

  return "file";
};

const getVoiceRecordingMimeType = () => {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  return (
    candidates.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType)) || ""
  );
};

const getVoiceRecordingExtension = (mimeType) => {
  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  return "webm";
};

const formatRecordingDuration = (durationInSeconds) => {
  const totalSeconds = Math.max(0, Math.floor(durationInSeconds));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
};

const formatAttachmentSize = (sizeBytes, formatNumber) => {
  const size = Number(sizeBytes || 0);

  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${formatNumber(value, {
    maximumFractionDigits: value >= 10 || unitIndex === 0 ? 0 : 1,
  })} ${units[unitIndex]}`;
};

const getParticipantInitials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const normalizeSearchValue = (value = "") => String(value || "").trim().toLocaleLowerCase();

const isSameCalendarDay = (firstDate, secondDate) =>
  firstDate.getFullYear() === secondDate.getFullYear() &&
  firstDate.getMonth() === secondDate.getMonth() &&
  firstDate.getDate() === secondDate.getDate();

const formatConversationTimestamp = (value, localeTag, t) => {
  if (!value) {
    return t("common.never");
  }

  const targetDate = new Date(value);

  if (Number.isNaN(targetDate.getTime())) {
    return t("common.never");
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(targetDate, now)) {
    return new Intl.DateTimeFormat(localeTag, {
      hour: "numeric",
      minute: "2-digit",
    }).format(targetDate);
  }

  if (isSameCalendarDay(targetDate, yesterday)) {
    return t("chat.yesterday");
  }

  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    ...(targetDate.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(targetDate);
};

const formatMessageTime = (value, localeTag, t) => {
  if (!value) {
    return t("common.never");
  }

  const targetDate = new Date(value);

  if (Number.isNaN(targetDate.getTime())) {
    return t("common.never");
  }

  return new Intl.DateTimeFormat(localeTag, {
    hour: "numeric",
    minute: "2-digit",
  }).format(targetDate);
};

const formatMessageDayLabel = (value, localeTag, t) => {
  if (!value) {
    return t("common.never");
  }

  const targetDate = new Date(value);

  if (Number.isNaN(targetDate.getTime())) {
    return t("common.never");
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(targetDate, now)) {
    return t("chat.today");
  }

  if (isSameCalendarDay(targetDate, yesterday)) {
    return t("chat.yesterday");
  }

  return new Intl.DateTimeFormat(localeTag, {
    dateStyle: "full",
  }).format(targetDate);
};

const downloadBlobFile = (blob, fileName = "attachment") => {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.click();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 0);
};

function useSecureAttachmentBlob(attachmentPath) {
  const [imageUrl, setImageUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revokedUrl = "";
    let cancelled = false;

    const loadImage = async () => {
      if (!attachmentPath) {
        setImageUrl("");
        setFailed(false);
        return;
      }

      setFailed(false);

      try {
        const response = await api.get(attachmentPath, {
          responseType: "blob",
        });
        const nextImageUrl = window.URL.createObjectURL(response.data);

        if (cancelled) {
          window.URL.revokeObjectURL(nextImageUrl);
          return;
        }

        revokedUrl = nextImageUrl;
        setImageUrl(nextImageUrl);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setImageUrl("");
        }
      }
    };

    loadImage().catch(() => {});

    return () => {
      cancelled = true;

      if (revokedUrl) {
        window.URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [attachmentPath]);

  return {
    blobUrl: imageUrl,
    failed,
  };
}

function SecureChatImage({ attachmentPath, alt, fallbackText, onDownload }) {
  const { blobUrl: imageUrl, failed } = useSecureAttachmentBlob(attachmentPath);

  if (failed) {
    return (
      <button
        type="button"
        className="chat-attachment chat-attachment-file chat-attachment-file-button"
        onClick={onDownload}
      >
        <FiFileText aria-hidden="true" />
        <div>
          <strong>{alt}</strong>
          <span>{fallbackText}</span>
        </div>
        <FiDownload aria-hidden="true" />
      </button>
    );
  }

  if (!imageUrl) {
    return <div className="chat-attachment chat-attachment-image chat-attachment-image-loading" />;
  }

  return (
    <a
      className="chat-attachment chat-attachment-image"
      href={imageUrl}
      target="_blank"
      rel="noreferrer"
    >
      <img src={imageUrl} alt={alt} />
    </a>
  );
}

function SecureChatAudio({ attachmentPath, title, fallbackText, onDownload }) {
  const { blobUrl: audioUrl, failed } = useSecureAttachmentBlob(attachmentPath);

  if (failed) {
    return (
      <button
        type="button"
        className="chat-attachment chat-attachment-file chat-attachment-file-button"
        onClick={onDownload}
      >
        <FiFileText aria-hidden="true" />
        <div>
          <strong>{title}</strong>
          <span>{fallbackText}</span>
        </div>
        <FiDownload aria-hidden="true" />
      </button>
    );
  }

  if (!audioUrl) {
    return <div className="chat-attachment chat-attachment-audio chat-attachment-audio-loading" />;
  }

  return (
    <div className="chat-attachment chat-attachment-audio">
      <audio controls preload="metadata" src={audioUrl} />
    </div>
  );
}

export default function ChatPanel({ preferredParticipantId = "" }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();
  const { formatDateTime, formatNumber, localeTag, t } = useUiPreferences();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [paginationByConversation, setPaginationByConversation] = useState({});
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [pendingLatestCount, setPendingLatestCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [error, setError] = useState("");
  const [typingState, setTypingState] = useState({});
  const remoteTypingTimeoutsRef = useRef({});
  const localTypingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesListRef = useRef(null);
  const pendingPrependRestoreRef = useRef(null);
  const scrollToBottomOnNextRenderRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const discardRecordingRef = useRef(false);
  const pendingAttachmentRef = useRef(null);
  const isTypingRef = useRef(false);
  const pendingReadRef = useRef(false);
  const pendingPreferredParticipantIdRef = useRef(preferredParticipantId || "");

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );
  const filteredConversations = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(conversationQuery);

    if (!normalizedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      [
        conversation.participant?.name,
        conversation.participant?.email,
        conversation.participant?.specialty,
        conversation.lastMessage?.bodyPreview,
      ].some((value) => normalizeSearchValue(value).includes(normalizedQuery))
    );
  }, [conversationQuery, conversations]);
  const selectedMessages = selectedConversationId
    ? messagesByConversation[selectedConversationId] || []
    : [];
  const renderedMessageItems = useMemo(() => {
    let lastDayKey = "";

    return selectedMessages.flatMap((message) => {
      const messageDate = new Date(message.createdAt);
      const dayKey = Number.isNaN(messageDate.getTime())
        ? message.id
        : `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
      const items = [];

      if (dayKey !== lastDayKey) {
        items.push({
          type: "separator",
          key: `separator-${dayKey}`,
          label: formatMessageDayLabel(message.createdAt, localeTag, t),
        });
        lastDayKey = dayKey;
      }

      items.push({
        type: "message",
        key: message.id,
        message,
      });

      return items;
    });
  }, [localeTag, selectedMessages, t]);
  const selectedPagination =
    paginationByConversation[selectedConversationId] || {
      hasMore: false,
      nextCursor: null,
    };

  const replacePendingAttachment = (nextAttachment) => {
    setPendingAttachment((currentAttachment) => {
      if (
        currentAttachment?.previewUrl &&
        currentAttachment.previewUrl !== nextAttachment?.previewUrl
      ) {
        window.URL.revokeObjectURL(currentAttachment.previewUrl);
      }

      return nextAttachment;
    });
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
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
    pendingPreferredParticipantIdRef.current = preferredParticipantId || "";
  }, [preferredParticipantId]);

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId("");
      return;
    }

    setSelectedConversationId((currentConversationId) => {
      const pendingPreferredParticipantId = pendingPreferredParticipantIdRef.current;
      const pendingPreferredConversation = pendingPreferredParticipantId
        ? conversations.find(
            (conversation) => conversation.participant?.id === pendingPreferredParticipantId
          )
        : null;

      if (pendingPreferredConversation) {
        pendingPreferredParticipantIdRef.current = "";
        return pendingPreferredConversation.id;
      }

      if (conversations.some((conversation) => conversation.id === currentConversationId)) {
        return currentConversationId;
      }

      const preferredConversation = preferredParticipantId
        ? conversations.find(
            (conversation) => conversation.participant?.id === preferredParticipantId
          )
        : null;

      return preferredConversation?.id || conversations[0]?.id || "";
    });
  }, [conversations, preferredParticipantId]);

  const updateConversationReadState = (conversationId, readAt, recipientId = user?._id) => {
    setMessagesByConversation((currentMessagesByConversation) => {
      const currentMessages = currentMessagesByConversation[conversationId] || [];

      return {
        ...currentMessagesByConversation,
        [conversationId]: currentMessages.map((message) =>
          message.recipientId === recipientId && !message.readAt
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
      if (mode !== "prepend") {
        scrollToBottomOnNextRenderRef.current = true;
      }

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
      if (mode === "prepend") {
        pendingPrependRestoreRef.current = null;
      }

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
    setShowJumpToLatest(false);
    setPendingLatestCount(0);
  }, [selectedConversationId]);

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

      const nearBottom = isNearBottom(messagesListRef.current);

      if (
        nextConversation.id === selectedConversationId &&
        (nextMessage.senderId === user?._id || nearBottom)
      ) {
        scrollToBottomOnNextRenderRef.current = true;
        setPendingLatestCount(0);
        setShowJumpToLatest(false);
      } else if (
        nextConversation.id === selectedConversationId &&
        nextMessage.senderId !== user?._id
      ) {
        setPendingLatestCount((currentCount) => currentCount + 1);
        setShowJumpToLatest(true);
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

    const handleConversationRead = (payload = {}) => {
      if (!payload.conversationId || !payload.readerId || !payload.readAt) {
        return;
      }

      updateConversationReadState(
        payload.conversationId,
        payload.readAt,
        payload.readerId
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
    socket.on("chat:conversation:read", handleConversationRead);
    socket.on("chat:presence:update", handlePresenceUpdate);
    socket.on("chat:typing:update", handleTypingUpdate);

    return () => {
      socket.off("chat:message:new", handleMessage);
      socket.off("chat:conversation:updated", handleConversationUpdate);
      socket.off("chat:conversation:read", handleConversationRead);
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

  const handleAttachmentSelection = (event, attachmentKind) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";

    if (!nextFile) {
      return;
    }

    const resolvedKind = attachmentKind || getClientAttachmentKind(nextFile);
    const previewUrl =
      resolvedKind === "image" || resolvedKind === "audio"
        ? window.URL.createObjectURL(nextFile)
        : "";

    replacePendingAttachment({
      file: nextFile,
      kind: resolvedKind,
      previewUrl,
      name: nextFile.name,
      sizeBytes: nextFile.size,
      mimeType: nextFile.type,
    });
  };

  const handleRemoveAttachment = () => {
    replacePendingAttachment(null);
  };

  const stopVoiceRecording = (discard = false) => {
    const activeRecorder = mediaRecorderRef.current;

    if (!activeRecorder || activeRecorder.state === "inactive") {
      return;
    }

    discardRecordingRef.current = discard;
    activeRecorder.stop();
  };

  const startVoiceRecording = async () => {
    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      addToast({
        type: "error",
        message: t("chat.voiceUnsupported"),
      });
      return;
    }

    if (isRecording) {
      stopVoiceRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getVoiceRecordingMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      discardRecordingRef.current = false;
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (recorderEvent) => {
        if (recorderEvent.data?.size) {
          recordingChunksRef.current.push(recorderEvent.data);
        }
      };
      mediaRecorder.onstop = () => {
        const recordedMimeType =
          mediaRecorder.mimeType || mimeType || "audio/webm";
        const recordedChunks = recordingChunksRef.current;
        const shouldDiscard = discardRecordingRef.current;

        stopRecordingTimer();
        stopRecordingStream();
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        discardRecordingRef.current = false;
        setIsRecording(false);

        if (shouldDiscard || !recordedChunks.length) {
          setRecordingDurationSeconds(0);
          return;
        }

        const audioBlob = new Blob(recordedChunks, {
          type: recordedMimeType,
        });
        const fileExtension = getVoiceRecordingExtension(recordedMimeType);
        const recordingLabel = `voice-note-${Date.now()}.${fileExtension}`;
        const audioFile = new File([audioBlob], recordingLabel, {
          type: recordedMimeType,
        });

        replacePendingAttachment({
          file: audioFile,
          kind: "audio",
          previewUrl: window.URL.createObjectURL(audioBlob),
          name: audioFile.name,
          sizeBytes: audioFile.size,
          mimeType: audioFile.type,
        });
      };
      mediaRecorder.start();
      setRecordingDurationSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDurationSeconds((currentDuration) => currentDuration + 1);
      }, 1000);
    } catch (requestError) {
      stopRecordingTimer();
      stopRecordingStream();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordingDurationSeconds(0);
      addToast({
        type: "error",
        message:
          requestError?.name === "NotAllowedError"
            ? t("chat.voicePermissionDenied")
            : t("chat.voiceCaptureFailed"),
      });
    }
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
    if (
      !selectedConversationId ||
      !selectedPagination.hasMore ||
      loadingOlder ||
      pendingPrependRestoreRef.current
    ) {
      return;
    }

    const messagesListElement = messagesListRef.current;

    if (messagesListElement) {
      pendingPrependRestoreRef.current = {
        conversationId: selectedConversationId,
        scrollHeight: messagesListElement.scrollHeight,
        scrollTop: messagesListElement.scrollTop,
      };
    }

    try {
      await loadConversationMessages(selectedConversationId, {
        before: selectedPagination.nextCursor,
        mode: "prepend",
      });
    } catch (requestError) {
      pendingPrependRestoreRef.current = null;
      throw requestError;
    }
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
    const attachmentToSend = pendingAttachment;

    if (!nextBody && !attachmentToSend) {
      return;
    }

    setSending(true);
    setDraft("");
    scrollToBottomOnNextRenderRef.current = true;
    stopTyping();

    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }

    try {
      if (attachmentToSend) {
        const formData = new FormData();

        if (nextBody) {
          formData.append("body", nextBody);
        }

        formData.append("attachment", attachmentToSend.file);

        const response = await sendConversationAttachmentMessage(
          selectedConversationId,
          formData
        );
        const nextConversation = response.data?.conversation;
        const nextMessage = response.data?.chatMessage;

        if (!socket?.connected) {
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

        replacePendingAttachment(null);
      } else if (socket?.connected) {
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
    pendingAttachmentRef.current = pendingAttachment;
  }, [pendingAttachment]);

  useEffect(() => {
    return () => {
      if (localTypingTimeoutRef.current) {
        window.clearTimeout(localTypingTimeoutRef.current);
      }

      Object.values(remoteTypingTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });

      stopRecordingTimer();

      if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== "inactive") {
        discardRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }

      stopRecordingStream();

      if (pendingAttachmentRef.current?.previewUrl) {
        window.URL.revokeObjectURL(pendingAttachmentRef.current.previewUrl);
      }
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

  useEffect(() => {
    const messagesListElement = messagesListRef.current;

    if (!messagesListElement) {
      return;
    }

    const pendingPrependRestore = pendingPrependRestoreRef.current;

    if (pendingPrependRestore?.conversationId === selectedConversationId) {
      messagesListElement.scrollTop =
        messagesListElement.scrollHeight -
        pendingPrependRestore.scrollHeight +
        pendingPrependRestore.scrollTop;
      pendingPrependRestoreRef.current = null;
      return;
    }

    if (scrollToBottomOnNextRenderRef.current) {
      messagesListElement.scrollTop = messagesListElement.scrollHeight;
      scrollToBottomOnNextRenderRef.current = false;
      setShowJumpToLatest(false);
      setPendingLatestCount(0);
    }
  }, [selectedConversationId, selectedMessages.length]);

  const handleDraftKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event).catch(() => {});
    }
  };

  const handleMessagesScroll = () => {
    const messagesListElement = messagesListRef.current;

    if (!messagesListElement) {
      return;
    }

    const nearBottom = isNearBottom(messagesListElement);
    setShowJumpToLatest((currentValue) =>
      currentValue === !nearBottom ? currentValue : !nearBottom
    );

    if (nearBottom) {
      setPendingLatestCount(0);
    }

    if (
      messagesLoading ||
      loadingOlder ||
      !selectedPagination.hasMore ||
      pendingPrependRestoreRef.current
    ) {
      return;
    }

    if (messagesListElement.scrollTop <= 72) {
      handleLoadOlder().catch(() => {});
    }
  };

  const handleJumpToLatest = () => {
    const messagesListElement = messagesListRef.current;

    if (!messagesListElement) {
      return;
    }

    messagesListElement.scrollTo({
      top: messagesListElement.scrollHeight,
      behavior: "smooth",
    });
    setShowJumpToLatest(false);
    setPendingLatestCount(0);
  };

  const handleDownloadAttachment = async (attachment) => {
    if (!attachment?.urlPath) {
      return;
    }

    try {
      const response = await api.get(attachment.downloadUrlPath || attachment.urlPath, {
        responseType: "blob",
      });

      downloadBlobFile(
        response.data,
        attachment.originalName || attachment.extension || "attachment"
      );
    } catch {
      addToast({
        type: "error",
        message: t("chat.downloadFailed"),
      });
    }
  };

  const renderAttachment = (message) => {
    const attachment = message.attachment;

    if (!attachment?.urlPath) {
      return null;
    }

    if (message.type === "image") {
      return (
        <SecureChatImage
          attachmentPath={attachment.urlPath}
          alt={attachment.originalName || t("chat.imageAttachment")}
          fallbackText={t("chat.openImage")}
          onDownload={() => handleDownloadAttachment(attachment)}
        />
      );
    }

    if (message.type === "audio") {
      return (
        <SecureChatAudio
          attachmentPath={attachment.urlPath}
          title={attachment.originalName || t("chat.voiceMessage")}
          fallbackText={t("chat.downloadAudio")}
          onDownload={() => handleDownloadAttachment(attachment)}
        />
      );
    }

    return (
      <button
        type="button"
        className="chat-attachment chat-attachment-file chat-attachment-file-button"
        onClick={() => handleDownloadAttachment(attachment)}
      >
        <FiFileText aria-hidden="true" />
        <div>
          <strong>{attachment.originalName || t("chat.fileAttachment")}</strong>
          <span>
            {formatAttachmentSize(attachment.sizeBytes, formatNumber)}
          </span>
        </div>
        <FiDownload aria-hidden="true" />
      </button>
    );
  };

  const renderPendingAttachment = () => {
    if (!pendingAttachment) {
      return null;
    }

    return (
      <div className="chat-pending-attachment">
        <div className="chat-pending-attachment-main">
          {pendingAttachment.kind === "image" && pendingAttachment.previewUrl ? (
            <img
              className="chat-pending-image"
              src={pendingAttachment.previewUrl}
              alt={pendingAttachment.name || t("chat.imageAttachment")}
            />
          ) : pendingAttachment.kind === "audio" && pendingAttachment.previewUrl ? (
            <div className="chat-pending-audio">
              <audio controls preload="metadata" src={pendingAttachment.previewUrl} />
            </div>
          ) : (
            <span className="chat-pending-file-icon" aria-hidden="true">
              <FiFileText />
            </span>
          )}

          <div className="chat-pending-copy">
            <strong>{pendingAttachment.name || t("chat.fileAttachment")}</strong>
            <span>
              {formatAttachmentSize(pendingAttachment.sizeBytes, formatNumber)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="ghost-button chat-clear-attachment"
          onClick={handleRemoveAttachment}
          aria-label={t("chat.removeAttachment")}
        >
          <FiX aria-hidden="true" />
        </button>
      </div>
    );
  };

  const getConversationPreviewText = (conversation) => {
    const preview = conversation.lastMessage?.bodyPreview || t("chat.noMessages");

    if (!conversation.lastMessage?.bodyPreview) {
      return preview;
    }

    return conversation.lastMessage.senderId === user?._id
      ? t("chat.youMessagePreview", {
          message: preview,
        })
      : preview;
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

            <div className="chat-sidebar-tools">
              <label className="chat-search-field">
                <span className="chat-search-icon" aria-hidden="true">
                  <FiSearch />
                </span>
                <input
                  type="search"
                  value={conversationQuery}
                  placeholder={t("chat.searchPlaceholder")}
                  aria-label={t("chat.searchPlaceholder")}
                  onChange={(event) => setConversationQuery(event.target.value)}
                />
                {conversationQuery ? (
                  <button
                    type="button"
                    className="chat-search-clear"
                    onClick={() => setConversationQuery("")}
                  >
                    {t("chat.clearSearch")}
                  </button>
                ) : null}
              </label>
            </div>

            <div className="chat-conversation-list">
              {filteredConversations.length ? (
                filteredConversations.map((conversation) => (
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
                      <div className="chat-conversation-identity">
                        <span className="chat-avatar" aria-hidden="true">
                          {getParticipantInitials(conversation.participant?.name)}
                        </span>
                        <div className="chat-conversation-copy">
                          <strong>{conversation.participant?.name}</strong>
                          <span>{getParticipantLabel(conversation, t)}</span>
                        </div>
                      </div>
                      <div className="chat-conversation-indicators">
                        <small className="chat-conversation-time">
                          {formatConversationTimestamp(
                            conversation.latestActivityAt,
                            localeTag,
                            t
                          )}
                        </small>
                        <span
                          className={
                            conversation.participant?.onlineStatus?.isOnline
                              ? "chat-status-dot online"
                              : "chat-status-dot"
                          }
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <p className="chat-conversation-preview">
                      {getConversationPreviewText(conversation)}
                    </p>

                    <div className="chat-conversation-meta">
                      <small>
                        {getConversationStatusLabel(conversation, formatDateTime, t)}
                      </small>
                      {conversation.unreadCount ? (
                        <span className="chat-unread-badge">{conversation.unreadCount}</span>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="chat-sidebar-empty">
                  <strong>{t("chat.noSearchResultsTitle")}</strong>
                  <p>{t("chat.noSearchResultsDescription")}</p>
                </div>
              )}
            </div>
          </aside>

          <section className="chat-thread">
            {selectedConversation ? (
              <>
                <header className="chat-thread-header">
                  <div className="chat-thread-participant">
                    <span className="chat-avatar chat-thread-avatar" aria-hidden="true">
                      {getParticipantInitials(selectedConversation.participant?.name)}
                    </span>
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

                  <div
                    ref={messagesListRef}
                    className="chat-messages-list"
                    role="log"
                    aria-live="polite"
                    onScroll={handleMessagesScroll}
                  >
                    {messagesLoading && !selectedMessages.length ? (
                      <div className="chat-panel-loading">
                        <div className="loading-dot" />
                      </div>
                    ) : renderedMessageItems.length ? (
                      renderedMessageItems.map((item) =>
                        item.type === "separator" ? (
                          <div key={item.key} className="chat-day-separator">
                            <span>{item.label}</span>
                          </div>
                        ) : (
                          <div
                            key={item.key}
                            className={
                              item.message.isOwnMessage
                                ? "chat-message-row own"
                                : "chat-message-row"
                            }
                          >
                            <article
                              className={
                                item.message.isOwnMessage
                                  ? "chat-message-bubble own"
                                  : "chat-message-bubble"
                              }
                            >
                              {renderAttachment(item.message)}
                              {item.message.body ? <p>{item.message.body}</p> : null}
                              <footer>
                                <span>
                                  {formatMessageTime(item.message.createdAt, localeTag, t)}
                                </span>
                                {item.message.isOwnMessage ? (
                                  <span
                                    className={
                                      item.message.readAt
                                        ? "chat-message-status is-read"
                                        : "chat-message-status"
                                    }
                                    role="img"
                                    aria-label={
                                      item.message.readAt
                                        ? t("chat.readAt", {
                                            date: formatDateTime(item.message.readAt),
                                          })
                                        : t("chat.sentStatus")
                                    }
                                    title={
                                      item.message.readAt
                                        ? t("chat.readAt", {
                                            date: formatDateTime(item.message.readAt),
                                          })
                                        : t("chat.sentStatus")
                                    }
                                  >
                                    <span
                                      className={
                                        item.message.readAt
                                          ? "chat-message-status-icon double"
                                          : "chat-message-status-icon single"
                                      }
                                      aria-hidden="true"
                                    >
                                      <FiCheck className="chat-message-check" aria-hidden="true" />
                                      {item.message.readAt ? (
                                        <FiCheck
                                          className="chat-message-check"
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                    </span>
                                  </span>
                                ) : null}
                              </footer>
                            </article>
                          </div>
                        )
                      )
                    ) : (
                      <EmptyState
                        icon={FiMessageSquare}
                        title={t("chat.emptyConversationTitle")}
                        description={t("chat.emptyConversationDescription")}
                      />
                    )}
                  </div>

                  {showJumpToLatest ? (
                    <button
                      type="button"
                      className="chat-jump-latest"
                      onClick={handleJumpToLatest}
                    >
                      <FiArrowDown aria-hidden="true" />
                      <span>
                        {pendingLatestCount
                          ? t("chat.newMessagesCount", {
                              count: formatNumber(pendingLatestCount),
                            })
                          : t("chat.jumpToLatest")}
                      </span>
                    </button>
                  ) : null}
                </div>

                <div className="chat-thread-footer">
                  <div className="chat-typing-row" aria-live="polite">
                    {typingParticipant?.isTyping ? (
                      <span className="chat-typing-pill">
                        <span className="chat-typing-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        <span>{t("chat.typing", { name: typingParticipant.name })}</span>
                      </span>
                    ) : (
                      <span className="chat-typing-hint">
                        {t("chat.openConversation")}
                      </span>
                    )}
                  </div>

                  <form className="chat-compose-form" onSubmit={handleSendMessage}>
                    <div className="chat-compose-input">
                      <div className="chat-compose-toolbar">
                        <div className="chat-compose-actions">
                          <button
                            type="button"
                            className="ghost-button chat-compose-action"
                            disabled={sending || isRecording}
                            onClick={() => imageInputRef.current?.click()}
                          >
                            <FiImage aria-hidden="true" />
                            <span>{t("chat.attachImage")}</span>
                          </button>
                          <button
                            type="button"
                            className="ghost-button chat-compose-action"
                            disabled={sending || isRecording}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <FiPaperclip aria-hidden="true" />
                            <span>{t("chat.attachFile")}</span>
                          </button>
                          {isRecording ? (
                            <>
                              <button
                                type="button"
                                className="ghost-button chat-compose-action is-recording stop-recording"
                                onClick={() => stopVoiceRecording()}
                              >
                                <FiSquare aria-hidden="true" />
                                <span>{t("chat.stopRecording")}</span>
                              </button>
                              <button
                                type="button"
                                className="ghost-button chat-compose-action is-recording cancel-recording"
                                onClick={() => stopVoiceRecording(true)}
                              >
                                <FiX aria-hidden="true" />
                                <span>{t("common.cancel")}</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button chat-compose-action"
                              disabled={sending}
                              onClick={() => startVoiceRecording().catch(() => {})}
                            >
                              <FiMic aria-hidden="true" />
                              <span>{t("chat.recordVoice")}</span>
                            </button>
                          )}
                        </div>

                        <div className="chat-compose-status">
                          {isRecording ? (
                            <div className="chat-recording-indicator row">
                              <span className="chat-recording-dot blinking" aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'red', display: 'inline-block', marginRight: '8px', animation: 'blink 1s infinite' }}></span>
                              <span className="chat-recording-time">
                                {formatRecordingDuration(recordingDurationSeconds)}
                              </span>
                              <div className="chat-recording-waveform" style={{ display: 'inline-flex', marginLeft: '12px', gap: '3px', alignItems: 'center' }}>
                                <span style={{ width: '3px', height: '12px', backgroundColor: '#4a90e2', animation: 'pulse 1s infinite' }}></span>
                                <span style={{ width: '3px', height: '18px', backgroundColor: '#4a90e2', animation: 'pulse 1.2s infinite' }}></span>
                                <span style={{ width: '3px', height: '10px', backgroundColor: '#4a90e2', animation: 'pulse 0.8s infinite' }}></span>
                                <span style={{ width: '3px', height: '16px', backgroundColor: '#4a90e2', animation: 'pulse 1.1s infinite' }}></span>
                                <span style={{ width: '3px', height: '14px', backgroundColor: '#4a90e2', animation: 'pulse 0.9s infinite' }}></span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {renderPendingAttachment()}

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
                        <span className="chat-compose-hint">
                          {t("chat.sendShortcutHint")}
                        </span>
                        <span className="chat-compose-count">{draft.length}/2000</span>
                      </div>
                    </div>
                    <button
                      className="primary-button chat-send-button"
                      type="submit"
                      disabled={(!draft.trim() && !pendingAttachment) || sending}
                    >
                      <FiSend aria-hidden="true" />
                      <span>{sending ? t("chat.sending") : t("chat.send")}</span>
                    </button>
                    <input
                      ref={imageInputRef}
                      className="chat-hidden-input"
                      type="file"
                      accept={IMAGE_FILE_ACCEPT}
                      onChange={(event) => handleAttachmentSelection(event, "image")}
                    />
                    <input
                      ref={fileInputRef}
                      className="chat-hidden-input"
                      type="file"
                      accept={DOCUMENT_FILE_ACCEPT}
                      onChange={(event) => handleAttachmentSelection(event, "file")}
                    />
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
