/**
 * FieldScore — Collaboration Hook
 * React hook for managing questionnaire collaboration state
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Questionnaire,
  Collaborator,
  Comment,
  ActivityEvent,
  Version,
  PresenceData,
  Notification,
  ShareQuestionnaireRequest,
  UpdateAccessRequest,
  AddCommentRequest,
  UpdateCommentRequest,
  NotificationType,
} from './collaboration.types';

interface UseCollaborationOptions {
  questionnaireId: string;
  currentUserId: string;
  userRole: 'owner' | 'editor' | 'commenter' | 'viewer';
  token: string;
  pollInterval?: number; // ms between presence updates (default: 5000)
  useWebSocket?: boolean; // use WebSocket instead of polling (default: false)
  wsUrl?: string; // WebSocket URL if useWebSocket is true
}

interface UseCollaborationReturn {
  // State
  collaborators: Collaborator[];
  comments: Comment[];
  activities: ActivityEvent[];
  versions: Version[];
  presence: PresenceData[];
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;

  // Methods
  shareQuestionnaire: (req: ShareQuestionnaireRequest) => Promise<void>;
  updateAccess: (userId: string, role: 'owner' | 'editor' | 'commenter' | 'viewer') => Promise<void>;
  addComment: (req: AddCommentRequest) => Promise<Comment>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  getActivityFeed: (limit?: number) => Promise<void>;
  getVersions: () => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  updatePresence: () => Promise<void>;
  getNotifications: (unreadOnly?: boolean) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

/**
 * Main collaboration hook
 */
export function useCollaboration(options: UseCollaborationOptions): UseCollaborationReturn {
  const {
    questionnaireId,
    currentUserId,
    userRole,
    token,
    pollInterval = 5000,
    useWebSocket = false,
    wsUrl,
  } = options;

  // State
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [presence, setPresence] = useState<PresenceData[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userColorRef = useRef(generateUserColor(currentUserId));

  // ─────────────────────────────────────────────────────────────────────────
  // API UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  const apiCall = useCallback(
    async (method: string, endpoint: string, body?: any) => {
      try {
        const response = await fetch(`/api/questionnaires${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP ${response.status}`
          );
        }

        return await response.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      }
    },
    [token]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // COLLABORATIVE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  const shareQuestionnaire = useCallback(
    async (req: ShareQuestionnaireRequest) => {
      const result = await apiCall(
        'POST',
        `/${questionnaireId}/share`,
        req
      );
      setCollaborators((prev) => [...prev, ...result.added_collaborators]);
    },
    [questionnaireId, apiCall]
  );

  const updateAccess = useCallback(
    async (userId: string, role: string) => {
      await apiCall(
        'PUT',
        `/${questionnaireId}/access/${userId}`,
        { role }
      );
      setCollaborators((prev) =>
        prev.map((c) =>
          c.user_id === userId ? { ...c, role: role as any } : c
        )
      );
    },
    [questionnaireId, apiCall]
  );

  const addComment = useCallback(
    async (req: AddCommentRequest) => {
      const result = await apiCall(
        'POST',
        `/${questionnaireId}/comments`,
        req
      );
      const newComment: Comment = {
        id: result.comment_id,
        questionnaire_id: questionnaireId,
        user_id: currentUserId,
        content: req.content,
        mentions: req.mentions || [],
        status: 'open',
        created_at: result.created_at,
        replies: [],
      };
      setComments((prev) => [newComment, ...prev]);
      return newComment;
    },
    [questionnaireId, currentUserId, apiCall]
  );

  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      await apiCall(
        'PUT',
        `/${questionnaireId}/comments/${commentId}`,
        { content }
      );
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, content } : c
        )
      );
    },
    [questionnaireId, apiCall]
  );

  const resolveComment = useCallback(
    async (commentId: string) => {
      await apiCall(
        'POST',
        `/${questionnaireId}/comments/${commentId}/resolve`,
        {}
      );
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, status: 'resolved' as const }
            : c
        )
      );
    },
    [questionnaireId, apiCall]
  );

  const getActivityFeed = useCallback(
    async (limit = 50) => {
      const result = await apiCall(
        'GET',
        `/${questionnaireId}/activity?limit=${limit}`
      );
      setActivities(result.activities);
    },
    [questionnaireId, apiCall]
  );

  const getVersions = useCallback(
    async () => {
      const result = await apiCall(
        'GET',
        `/${questionnaireId}/versions`
      );
      setVersions(result.versions);
    },
    [questionnaireId, apiCall]
  );

  const restoreVersion = useCallback(
    async (versionId: string) => {
      await apiCall(
        'POST',
        `/${questionnaireId}/versions/${versionId}/restore`,
        {}
      );
      await getVersions();
    },
    [questionnaireId, getVersions, apiCall]
  );

  const updatePresence = useCallback(
    async () => {
      await apiCall(
        'POST',
        `/${questionnaireId}/presence/update`,
        {
          position: { focused: true },
          color: userColorRef.current,
        }
      );

      const result = await apiCall(
        'GET',
        `/${questionnaireId}/presence`
      );
      setPresence(result.presence);
    },
    [questionnaireId, apiCall]
  );

  const getNotifications = useCallback(
    async (unreadOnly = false) => {
      const result = await apiCall(
        'GET',
        `/notifications?unread=${unreadOnly}`
      );
      setNotifications(result.notifications);
    },
    [apiCall]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      await apiCall(
        'POST',
        `/notifications/${notificationId}/read`,
        {}
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    },
    [apiCall]
  );

  const refreshAll = useCallback(
    async () => {
      setIsLoading(true);
      try {
        const [collabRes, commentsRes, activityRes, versionsRes, presenceRes, notifRes] =
          await Promise.all([
            apiCall('GET', `/${questionnaireId}/collaborators`),
            apiCall('GET', `/${questionnaireId}/comments`),
            apiCall('GET', `/${questionnaireId}/activity`),
            apiCall('GET', `/${questionnaireId}/versions`),
            apiCall('GET', `/${questionnaireId}/presence`),
            apiCall('GET', `/notifications`),
          ]);

        setCollaborators(collabRes.collaborators || []);
        setComments(commentsRes.comments || []);
        setActivities(activityRes.activities || []);
        setVersions(versionsRes.versions || []);
        setPresence(presenceRes.presence || []);
        setNotifications(notifRes.notifications || []);
        setError(null);
      } catch (err) {
        console.error('Failed to refresh collaboration data:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [questionnaireId, apiCall]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    refreshAll();
  }, [questionnaireId, refreshAll]);

  // ─────────────────────────────────────────────────────────────────────────
  // REAL-TIME UPDATES: Polling (default)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (useWebSocket) return; // Skip polling if using WebSocket

    // Initial update
    updatePresence().catch(console.error);

    // Set up interval
    pollIntervalRef.current = setInterval(() => {
      updatePresence().catch(console.error);
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Mark as offline when unmounting
      fetch(`/api/questionnaires/${questionnaireId}/presence/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(console.error);
    };
  }, [questionnaireId, token, pollInterval, updatePresence, useWebSocket]);

  // ─────────────────────────────────────────────────────────────────────────
  // REAL-TIME UPDATES: WebSocket (optional)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!useWebSocket || !wsUrl) return;

    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(
          `${wsUrl}?questionnaire_id=${questionnaireId}&user_id=${currentUserId}&token=${token}`
        );

        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'user_joined':
                setCollaborators((prev) => {
                  const exists = prev.find((c) => c.user_id === msg.data.user_id);
                  return exists ? prev : [...prev, msg.data];
                });
                break;

              case 'user_left':
                setCollaborators((prev) =>
                  prev.filter((c) => c.user_id !== msg.data.user_id)
                );
                break;

              case 'cursor_moved':
                setPresence((prev) =>
                  prev.map((p) =>
                    p.user_id === msg.data.user_id
                      ? { ...p, cursor_position: msg.data.position }
                      : p
                  )
                );
                break;

              case 'comment_added':
                setComments((prev) => [msg.data.comment, ...prev]);
                break;

              case 'activity_log':
                setActivities((prev) => [msg.data, ...prev]);
                break;

              case 'presence_update':
                setPresence(msg.data.presence);
                break;
            }
          } catch (err) {
            console.error('Failed to handle WebSocket message:', err);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Real-time connection lost');
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          // Attempt reconnection
          setTimeout(connectWebSocket, 3000);
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
        setError('Failed to establish real-time connection');
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [useWebSocket, wsUrl, questionnaireId, currentUserId, token]);

  return {
    collaborators,
    comments,
    activities,
    versions,
    presence,
    notifications,
    isLoading,
    error,
    shareQuestionnaire,
    updateAccess,
    addComment,
    updateComment,
    resolveComment,
    getActivityFeed,
    getVersions,
    restoreVersion,
    updatePresence,
    getNotifications,
    markNotificationRead,
    refreshAll,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function generateUserColor(userId: string): string {
  // Generate a consistent color for a user based on their ID
  const hash = userId.split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);

  const hue = Math.abs(hash) % 360;
  const saturation = 70 + (Math.abs(hash) % 20);
  const lightness = 50 + (Math.abs(hash) % 20);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Hook for managing a single comment thread
 */
export function useCommentThread(
  questionnaireId: string,
  commentId: string,
  token: string
) {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addReply = useCallback(
    async (content: string, mentions?: string[]) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/questionnaires/${questionnaireId}/comments`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content,
              mentions,
              parent_comment_id: commentId,
            }),
          }
        );

        if (!response.ok) throw new Error('Failed to add reply');

        const data = await response.json();
        setReplies((prev) => [...prev, data]);
      } catch (err) {
        console.error('Error adding reply:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [questionnaireId, commentId, token]
  );

  return {
    replies,
    isLoading,
    addReply,
  };
}

/**
 * Hook for real-time notifications
 */
export function useNotifications(
  currentUserId: string,
  token: string,
  pollInterval = 30000
) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(
    async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/questionnaires/notifications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error('Failed to fetch notifications');

        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await fetch(
          `/api/questionnaires/notifications/${notificationId}/read`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchNotifications();
    pollIntervalRef.current = setInterval(fetchNotifications, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [pollInterval, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    refresh: fetchNotifications,
  };
}
