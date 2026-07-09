"""
FieldScore — Questionnaire Collaboration Panel
React Component for Real-time Collaboration Features
"""

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Share2,
  Users,
  MessageSquare,
  History,
  Activity,
  Loader,
  CheckCircle,
  AlertCircle,
  X,
  Clock,
  Edit2,
  Send,
  AtSign,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';

interface Collaborator {
  id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  added_at: string;
  last_seen_at?: string;
  is_online: boolean;
  name: string;
  email: string;
  avatar_url?: string;
}

interface Comment {
  id: string;
  question_id?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  content: string;
  mentions: string[];
  status: 'open' | 'resolved';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
  replies: Comment[];
}

interface ActivityEvent {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  action: string;
  message: string;
  context: Record<string, any>;
  created_at: string;
}

interface Version {
  version_id: string;
  version_number: number;
  created_by: string;
  created_by_name: string;
  created_by_avatar?: string;
  created_at: string;
  change_description: string;
  change_type: string;
}

interface Presence {
  user_id: string;
  is_online: boolean;
  last_seen_at?: string;
  name: string;
  avatar_url?: string;
  cursor_position?: Record<string, any>;
  cursor_color: string;
}

interface CollaborationPanelProps {
  questionnaireId: string;
  currentUserId: string;
  userRole: 'owner' | 'editor' | 'commenter' | 'viewer';
  onCommentAdded?: (comment: Comment) => void;
  onActivityUpdate?: (activity: ActivityEvent) => void;
}

/**
 * Share Modal
 */
const ShareModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  questionnaireId: string;
  onShared: (collaborators: Collaborator[]) => void;
}> = ({ isOpen, onClose, questionnaireId, onShared }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [role, setRole] = useState<'editor' | 'commenter' | 'viewer'>('commenter');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    email: string;
  }>>([]);

  // Search users
  useEffect(() => {
    if (!searchQuery.trim()) {
      setAvailableUsers([]);
      return;
    }

    // In real implementation, call your user search API
    const fetchUsers = async () => {
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        const data = await response.json();
        setAvailableUsers(data.users || []);
      } catch (error) {
        console.error('Failed to search users:', error);
      }
    };

    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleShare = async () => {
    if (selectedUsers.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/questionnaires/${questionnaireId}/share`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            user_ids: selectedUsers,
            role,
            message,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to share');

      const data = await response.json();
      onShared(data.added_collaborators);
      setSelectedUsers([]);
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Questionnaire</DialogTitle>
          <DialogDescription>
            Invite teammates to collaborate on this questionnaire
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Search */}
          <div>
            <label className="text-sm font-medium">Find teammates</label>
            <div className="relative mt-2">
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Search Results */}
            {availableUsers.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                {availableUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUsers((prev) =>
                        prev.includes(user.id)
                          ? prev.filter((id) => id !== user.id)
                          : [...prev, user.id]
                      );
                    }}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between border-b last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Selected ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((userId) => {
                  const user = availableUsers.find((u) => u.id === userId);
                  return (
                    <Badge key={userId} variant="secondary">
                      {user?.name}
                      <X
                        className="ml-1 w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setSelectedUsers((prev) =>
                            prev.filter((id) => id !== userId)
                          )
                        }
                      />
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="text-sm font-medium">Access level</label>
            <div className="mt-2 space-y-2">
              {[
                {
                  value: 'editor' as const,
                  label: 'Editor',
                  description: 'Can edit & comment',
                },
                {
                  value: 'commenter' as const,
                  label: 'Commenter',
                  description: 'Can view & comment',
                },
                {
                  value: 'viewer' as const,
                  label: 'Viewer',
                  description: 'Read-only access',
                },
              ].map((r) => (
                <label
                  key={r.value}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium">Message (optional)</label>
            <Input
              placeholder="Add a personal message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={selectedUsers.length === 0 || isLoading}
              className="flex-1"
            >
              {isLoading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
              Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Comments Section
 */
const CommentsSection: React.FC<{
  questionnaireId: string;
  comments: Comment[];
  onCommentAdded: () => void;
}> = ({ questionnaireId, comments, onCommentAdded }) => {
  const [newComment, setNewComment] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<Collaborator[]>([]);

  const handleMentionSearch = (text: string) => {
    const lastAtSymbol = text.lastIndexOf('@');
    if (lastAtSymbol === -1) {
      setShowMentionSuggestions(false);
      return;
    }

    const query = text.substring(lastAtSymbol + 1).toLowerCase();
    if (query.length < 1) {
      setShowMentionSuggestions(false);
      return;
    }

    // Filter suggestions (in real impl, fetch from API)
    setShowMentionSuggestions(true);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/questionnaires/${questionnaireId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            content: newComment,
            mentions,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to add comment');

      setNewComment('');
      setMentions([]);
      onCommentAdded();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <ScrollArea className="h-96 rounded-lg border p-4">
        {comments.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No comments yet. Start a discussion!
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-3 hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.user_avatar} />
                    <AvatarFallback>
                      {comment.user_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{comment.user_name}</p>
                      <span className="text-xs text-gray-500">
                        {comment.created_at
                          ? format(new Date(comment.created_at), 'MMM d')
                          : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{comment.content}</p>

                    {comment.status === 'resolved' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        Resolved
                      </div>
                    )}

                    {comment.replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-gray-200 pl-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="text-sm">
                            <p className="font-medium text-xs">
                              {reply.user_name}
                            </p>
                            <p className="text-gray-700">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* New Comment Input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder="Add a comment... (@mention teammates)"
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value);
                handleMentionSearch(e.target.value);
              }}
              className="w-full"
            />

            {/* Mention Suggestions */}
            {showMentionSuggestions && mentionSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 border rounded-lg bg-white shadow-lg z-10 max-h-32 overflow-y-auto">
                {mentionSuggestions.map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => {
                      setMentions([...mentions, user.user_id]);
                      setShowMentionSuggestions(false);
                    }}
                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  >
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={handleAddComment}
            disabled={!newComment.trim() || isLoading}
            size="sm"
          >
            {isLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Mentioned Users */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mentions.map((userId) => (
              <Badge key={userId} variant="secondary" className="text-xs">
                <AtSign className="w-2 h-2 mr-1" />
                {userId}
                <X
                  className="ml-1 w-3 h-3 cursor-pointer"
                  onClick={() =>
                    setMentions((prev) => prev.filter((id) => id !== userId))
                  }
                />
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Activity Feed
 */
const ActivityFeed: React.FC<{
  activities: ActivityEvent[];
}> = ({ activities }) => {
  return (
    <ScrollArea className="h-96 rounded-lg border p-4">
      {activities.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-8">
          No activity yet
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 pb-3 border-b last:border-b-0"
            >
              <Avatar className="w-6 h-6 mt-1">
                <AvatarImage src={activity.user_avatar} />
                <AvatarFallback>
                  {activity.user_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user_name}</span>{' '}
                  {activity.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {activity.created_at
                    ? format(new Date(activity.created_at), 'MMM d, h:mm a')
                    : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
};

/**
 * Version History
 */
const VersionHistory: React.FC<{
  questionnaireId: string;
  versions: Version[];
  onRestore: (versionId: string) => void;
}> = ({ questionnaireId, versions, onRestore }) => {
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const handleRestore = async (versionId: string) => {
    setIsRestoring(versionId);
    try {
      const response = await fetch(
        `/api/questionnaires/${questionnaireId}/versions/${versionId}/restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to restore version');

      onRestore(versionId);
    } catch (error) {
      console.error('Error restoring version:', error);
    } finally {
      setIsRestoring(null);
    }
  };

  return (
    <ScrollArea className="h-96 rounded-lg border p-4">
      {versions.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-8">
          No version history yet
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={version.version_id}
              className="border rounded-lg p-3 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Version {version.version_number}
                    </span>
                    {index === 0 && (
                      <Badge variant="default" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {version.change_description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {version.created_at
                      ? format(new Date(version.created_at), 'MMM d, h:mm a')
                      : ''}
                    {' • '}
                    <Avatar className="w-4 h-4 inline">
                      <AvatarImage src={version.created_by_avatar} />
                      <AvatarFallback>
                        {version.created_by_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {version.created_by_name}
                  </div>
                </div>

                {index > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(version.version_id)}
                    disabled={isRestoring === version.version_id}
                  >
                    {isRestoring === version.version_id ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
};

/**
 * Main Collaboration Panel
 */
export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  questionnaireId,
  currentUserId,
  userRole,
  onCommentAdded,
  onActivityUpdate,
}) => {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [collabRes, commentsRes, activityRes, versionsRes] =
          await Promise.all([
            fetch(`/api/questionnaires/${questionnaireId}/collaborators`, {
              headers,
            }),
            fetch(`/api/questionnaires/${questionnaireId}/comments`, {
              headers,
            }),
            fetch(`/api/questionnaires/${questionnaireId}/activity`, {
              headers,
            }),
            fetch(`/api/questionnaires/${questionnaireId}/versions`, {
              headers,
            }),
          ]);

        if (collabRes.ok)
          setCollaborators((await collabRes.json()).collaborators);
        if (commentsRes.ok) setComments((await commentsRes.json()).comments);
        if (activityRes.ok) setActivities((await activityRes.json()).activities);
        if (versionsRes.ok) setVersions((await versionsRes.json()).versions);
      } catch (error) {
        console.error('Failed to load collaboration data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [questionnaireId]);

  // Real-time presence polling
  useEffect(() => {
    const updatePresence = async () => {
      try {
        const response = await fetch(
          `/api/questionnaires/${questionnaireId}/presence/update`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              position: { focused: true },
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            }),
          }
        );

        if (response.ok) {
          const presenceRes = await fetch(
            `/api/questionnaires/${questionnaireId}/presence`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            }
          );

          if (presenceRes.ok) {
            setPresence((await presenceRes.json()).presence);
          }
        }
      } catch (error) {
        console.error('Failed to update presence:', error);
      }
    };

    presenceIntervalRef.current = setInterval(updatePresence, 5000);
    updatePresence();

    return () => {
      if (presenceIntervalRef.current)
        clearInterval(presenceIntervalRef.current);

      // Mark as offline on unmount
      fetch(
        `/api/questionnaires/${questionnaireId}/presence/leave`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      ).catch(() => {});
    };
  }, [questionnaireId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <Loader className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Collaboration</CardTitle>
            <CardDescription>
              {presence.filter((p) => p.is_online).length} active collaborator
              {presence.filter((p) => p.is_online).length !== 1 ? 's' : ''}
            </CardDescription>
          </div>

          {userRole === 'owner' || userRole === 'editor' ? (
            <Button
              onClick={() => setShareModalOpen(true)}
              size="sm"
              variant="outline"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="collaborators" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="collaborators">
              <Users className="w-4 h-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="versions">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Collaborators Tab */}
          <TabsContent value="collaborators" className="space-y-4">
            {/* Online Collaborators */}
            <div>
              <h4 className="text-sm font-medium mb-3">Currently viewing</h4>
              <div className="space-y-2">
                {presence.filter((p) => p.is_online).map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div
                      className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                      title={`Cursor: ${user.cursor_color}`}
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-gray-500">Online now</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Collaborators */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">All collaborators</h4>
              <div className="space-y-2">
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={collab.avatar_url} />
                        <AvatarFallback>
                          {collab.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{collab.name}</p>
                        <p className="text-xs text-gray-500">{collab.email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {collab.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments">
            <CommentsSection
              questionnaireId={questionnaireId}
              comments={comments}
              onCommentAdded={() => {
                // Reload comments
                fetch(`/api/questionnaires/${questionnaireId}/comments`, {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                  },
                })
                  .then((r) => r.json())
                  .then((d) => setComments(d.comments));
              }}
            />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <ActivityFeed activities={activities} />
          </TabsContent>

          {/* Version History Tab */}
          <TabsContent value="versions">
            <VersionHistory
              questionnaireId={questionnaireId}
              versions={versions}
              onRestore={(versionId) => {
                // Reload versions after restore
                fetch(`/api/questionnaires/${questionnaireId}/versions`, {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                  },
                })
                  .then((r) => r.json())
                  .then((d) => setVersions(d.versions));
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        questionnaireId={questionnaireId}
        onShared={(newCollabs) => {
          setCollaborators([...collaborators, ...newCollabs]);
          setShareModalOpen(false);
        }}
      />
    </Card>
  );
};

export default CollaborationPanel;
