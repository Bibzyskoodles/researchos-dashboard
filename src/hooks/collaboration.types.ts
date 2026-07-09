/**
 * Collaboration types for questionnaire real-time collaboration features
 */

export interface Questionnaire {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type CollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface Collaborator {
  user_id: string;
  email: string;
  name: string;
  role: CollaboratorRole;
  avatar?: string;
  joined_at: string;
}

export interface Comment {
  id: string;
  questionnaire_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  status: 'open' | 'resolved';
  created_at: string;
  updated_at?: string;
  replies: Comment[];
  parent_comment_id?: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  user_id: string;
  user_name: string;
  description: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface Version {
  id: string;
  version_number: number;
  created_by: string;
  created_at: string;
  description?: string;
  snapshot?: Record<string, unknown>;
}

export interface PresenceData {
  user_id: string;
  user_name: string;
  color: string;
  cursor_position?: { focused: boolean; element?: string };
  last_seen: string;
}

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'share'
  | 'version'
  | 'access_changed'
  | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  link?: string;
}

export interface ShareQuestionnaireRequest {
  emails: string[];
  role: CollaboratorRole;
  message?: string;
}

export interface UpdateAccessRequest {
  user_id: string;
  role: CollaboratorRole;
}

export interface AddCommentRequest {
  content: string;
  mentions?: string[];
  parent_comment_id?: string;
  element_id?: string;
}

export interface UpdateCommentRequest {
  content: string;
}
