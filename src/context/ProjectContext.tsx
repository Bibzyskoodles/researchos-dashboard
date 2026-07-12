import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export interface Project {
  id: string;
  org_id: string;
  name: string;
  study_type_id?: string;
  platform?: string;
  status?: string;
  target_submissions?: number;
  framework_filename?: string;
  framework_content?: string;
  framework_indicators?: string;
  questionnaire_id?: string;
  kobo_asset_uid?: string;
  created_at?: string;
  updated_at?: string;
}

// Per-project KoboToolbox form UID stored in localStorage (key = ros_kobo_uid_<projectId>)
export function getProjectKoboUid(projectId: string): string | null {
  return localStorage.getItem(`ros_kobo_uid_${projectId}`);
}
export function setProjectKoboUid(projectId: string, uid: string | null): void {
  if (uid) {
    localStorage.setItem(`ros_kobo_uid_${projectId}`, uid);
  } else {
    localStorage.removeItem(`ros_kobo_uid_${projectId}`);
  }
  window.dispatchEvent(new CustomEvent('ros-kobo-uid-changed', { detail: { projectId, uid } }));
}

export interface ProjectLifecycle {
  project_id: string;
  name: string;
  industry_id: string;
  study_type_id: string;
  platform: string;
  status: string;
  target_submissions: number;
  stages: {
    design: DesignStage;
    collect: CollectStage;
    verify: VerifyStage;
    analyse: AnalyseStage;
    report: ReportStage;
  };
  ada_next_action: string;
  ada_status: string;
}

interface DesignStage {
  status: string;
  completed_at?: string;
  summary: string;
  question_count: number;
}

interface CollectStage {
  status: string;
  summary: string;
  total_received: number;
  target: number;
  percent_complete: number;
  webhook_connected: boolean;
}

interface VerifyStage {
  status: string;
  summary: string;
  passed: number;
  flagged: number;
  rejected: number;
  pass_rate: number;
  avg_trust_score: number;
}

interface AnalyseStage {
  status: string;
  can_start: boolean;
  minimum_met: boolean;
  minimum_required: number;
  available: number;
}

interface ReportStage {
  status: string;
  can_start: boolean;
  available_formats: string[];
}

interface ProjectContextValue {
  activeProject: Project | null;
  lifecycle: ProjectLifecycle | null;
  currentStage: 'design' | 'collect' | 'verify' | 'analyse' | 'report' | null;
  setActiveProject: (id: string) => void;
  clearActiveProject: () => void; // explicit "All projects" view
  canAdvanceTo: (stage: string) => boolean;
  refreshLifecycle: () => void;
  isLoadingLifecycle: boolean;
}

const ProjectCtx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId?: string }>();
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle | null>(null);
  const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(false);

  const projectId = params.projectId || localStorage.getItem('ros_active_project_id');

  const fetchProject = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/api/projects/${id}`);
      setActiveProjectState(res.data.project);
      localStorage.setItem('ros_active_project_id', id);
    } catch {
      // ignore
    }
  }, []);

  const fetchLifecycle = useCallback(async (id: string) => {
    setIsLoadingLifecycle(true);
    try {
      const res = await api.get(`/api/projects/${id}/lifecycle`);
      setLifecycle(res.data);
      // Store in sessionStorage so AdaDock can include it in every chat message
      try { sessionStorage.setItem('ros_active_lifecycle', JSON.stringify(res.data)); } catch {}
    } catch {
      // ignore
    } finally {
      setIsLoadingLifecycle(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchLifecycle(projectId);
    }
  }, [projectId, fetchProject, fetchLifecycle]);

  const setActiveProject = useCallback((id: string) => {
    fetchProject(id);
    fetchLifecycle(id);
  }, [fetchProject, fetchLifecycle]);

  const clearActiveProject = useCallback(() => {
    setActiveProjectState(null);
    setLifecycle(null);
    localStorage.removeItem('ros_active_project_id');
    try { sessionStorage.removeItem('ros_active_lifecycle'); } catch {}
  }, []);

  const refreshLifecycle = useCallback(() => {
    if (projectId) fetchLifecycle(projectId);
  }, [projectId, fetchLifecycle]);

  const currentStage = (lifecycle?.status as any) || null;

  const canAdvanceTo = useCallback((stage: string): boolean => {
    if (!lifecycle) return false;
    const stageOrder = ['design', 'collect', 'verify', 'analyse', 'report'];
    const currentIdx = stageOrder.indexOf(lifecycle.status);
    const targetIdx = stageOrder.indexOf(stage);
    if (targetIdx === -1) return false;
    if (targetIdx <= currentIdx + 1) return true;
    if (stage === 'analyse') return lifecycle.stages.analyse.can_start;
    if (stage === 'report') return lifecycle.stages.report.can_start;
    return false;
  }, [lifecycle]);

  return (
    <ProjectCtx.Provider value={{
      activeProject,
      lifecycle,
      currentStage,
      setActiveProject,
      clearActiveProject,
      canAdvanceTo,
      refreshLifecycle,
      isLoadingLifecycle,
    }}>
      {children}
    </ProjectCtx.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) return {
    activeProject: null,
    lifecycle: null,
    currentStage: null,
    setActiveProject: () => {},
    clearActiveProject: () => {},
    canAdvanceTo: () => false,
    refreshLifecycle: () => {},
    isLoadingLifecycle: false,
  } as ProjectContextValue;
  return ctx;
}
