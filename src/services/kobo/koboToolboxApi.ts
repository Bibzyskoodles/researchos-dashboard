import {
  KoboAsset,
  KoboDeployment,
  KoboSubmission,
  PublishResult,
  SyncResult,
  Questionnaire,
} from './kobo.types';

/**
 * KoboToolbox API utilities for publishing and syncing questionnaires
 */

const KOBO_BASE_URL = 'https://kf.kobotoolbox.org/api/v2';

export class KoboToolboxError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KoboToolboxError';
  }
}

export async function verifyKoboToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${KOBO_BASE_URL}/user/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      throw new KoboToolboxError(response.status, 'Invalid KoboToolbox token');
    }
    return true;
  } catch (error) {
    if (error instanceof KoboToolboxError) throw error;
    throw new KoboToolboxError(500, 'Failed to verify token', {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function questionnaireToXLSForm(questionnaire: Questionnaire): string {
  const settings = {
    form_title: questionnaire.name,
    form_id: questionnaire.id,
    version: questionnaire.version || new Date().getTime().toString(),
  };

  const settingsRows = Object.entries(settings)
    .map(([key, value]) => `${key}\t${value}`)
    .join('\n');

  const surveyHeader = ['type', 'name', 'label', 'hint', 'relevant', 'required', 'appearance'].join('\t');

  const surveyRows = (questionnaire.questions || [])
    .map((q, idx) => {
      const type = mapQuestionType(q.type);
      const required = q.required ? 'yes' : 'no';
      const relevant = q.condition || '';
      const name = q.name || `q${idx}`;
      const label = q.label || `Question ${idx + 1}`;
      return [type, name, label, '', relevant, required, ''].join('\t').trim();
    })
    .join('\n');

  let choicesSheet = '';
  const hasChoices = (questionnaire.questions || []).some(
    (q) => q.type === 'select_one' || q.type === 'select_multiple'
  );

  if (hasChoices) {
    const choicesHeader = ['list_name', 'name', 'label'].join('\t');
    const choicesRows: string[] = [];
    (questionnaire.questions || []).forEach((q) => {
      if ((q.type === 'select_one' || q.type === 'select_multiple') && q.options) {
        const listName = q.name || `q${q.id}`;
        q.options.forEach((opt) => {
          choicesRows.push([listName, opt.value, opt.label].join('\t'));
        });
      }
    });
    if (choicesRows.length > 0) {
      choicesSheet = `[choices]\n${choicesHeader}\n${choicesRows.join('\n')}\n\n`;
    }
  }

  return `[settings]\n${settingsRows}\n\n${choicesSheet}[survey]\n${surveyHeader}\n${surveyRows}`;
}

function mapQuestionType(fieldScoreType: string): string {
  const typeMap: Record<string, string> = {
    text: 'text',
    number: 'integer',
    select_one: 'select_one',
    select_multiple: 'select_multiple',
    date: 'date',
    time: 'time',
    datetime: 'datetime',
    geopoint: 'geopoint',
    image: 'image',
    audio: 'audio',
    video: 'video',
  };
  return typeMap[fieldScoreType] || 'text';
}

export function questionnaireToKoboContent(questionnaire: Questionnaire): Record<string, unknown> {
  const survey: Record<string, unknown>[] = [];
  const choices: Record<string, unknown>[] = [];

  (questionnaire.questions || []).forEach((q, idx) => {
    const name = q.name || `q${idx + 1}`;
    const type = mapQuestionType(q.type);
    const hasOptions = (q.type === 'select_one' || q.type === 'select_multiple') && q.options?.length;

    let fullType = type;
    if (hasOptions) {
      const listName = `list_${name}`;
      fullType = `${type} ${listName}`;
      q.options!.forEach(opt => {
        choices.push({ list_name: listName, name: opt.value, label: opt.label });
      });
    }

    survey.push({
      type: fullType,
      name,
      label: q.label || `Question ${idx + 1}`,
      hint: '',
      required: q.required ? true : false,
      ...(q.condition ? { relevant: q.condition } : {}),
    });
  });

  return {
    survey,
    choices,
    settings: {
      form_title: questionnaire.name,
      form_id: questionnaire.id,
      version: questionnaire.version || '1',
    },
  };
}

export async function createKoboAsset(
  token: string,
  name: string,
  content: Record<string, unknown>,
): Promise<KoboAsset> {
  try {
    const response = await fetch(`${KOBO_BASE_URL}/assets/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, asset_type: 'survey', content }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new KoboToolboxError(response.status, 'Failed to create asset', errorData);
    }
    return response.json();
  } catch (error) {
    if (error instanceof KoboToolboxError) throw error;
    throw new KoboToolboxError(500, 'Failed to create asset', {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function deployKoboAsset(token: string, assetUid: string): Promise<KoboDeployment> {
  try {
    const response = await fetch(`${KOBO_BASE_URL}/assets/${assetUid}/deployment/`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new KoboToolboxError(response.status, 'Failed to deploy asset', errorData);
    }
    return response.json();
  } catch (error) {
    if (error instanceof KoboToolboxError) throw error;
    throw new KoboToolboxError(500, 'Failed to deploy asset', {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function getKoboAsset(token: string, assetUid: string): Promise<KoboAsset> {
  try {
    const response = await fetch(`${KOBO_BASE_URL}/assets/${assetUid}/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      throw new KoboToolboxError(response.status, 'Asset not found');
    }
    return response.json();
  } catch (error) {
    if (error instanceof KoboToolboxError) throw error;
    throw new KoboToolboxError(500, 'Failed to fetch asset', {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function listKoboAssets(token: string): Promise<KoboAsset[]> {
  try {
    const response = await fetch(`${KOBO_BASE_URL}/assets/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      throw new KoboToolboxError(response.status, 'Failed to list assets');
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    if (error instanceof KoboToolboxError) throw error;
    throw new KoboToolboxError(500, 'Failed to list assets', {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function getKoboSubmissions(
  token: string,
  assetUid: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ submissions: KoboSubmission[]; total: number }> {
  try {
    const url = new URL(`${KOBO_BASE_URL}/data/${assetUid}/`);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      throw new KoboToolboxError(response.status, 'Failed to fetch submissions');
    }
    const data = await response.json();
    return { submissions: data.results || [], total: data.count || 0 };
  } catch (error) {
    if (error instanceof KoboToolboxError) throw error;
    throw new KoboToolboxError(500, 'Failed to fetch submissions', {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function generateShareLink(assetUid: string): string {
  return `https://kf.kobotoolbox.org/#/forms/${assetUid}`;
}

export function generatePublicSurveyLink(_assetUid: string, deploymentUid: string): string {
  return `https://kf.kobotoolbox.org/forms/${deploymentUid}`;
}

export async function publishToKoboToolbox(
  token: string,
  questionnaire: Questionnaire,
  config: { projectName: string; description?: string; isPublic?: boolean }
): Promise<PublishResult> {
  try {
    await verifyKoboToken(token);
    const content = questionnaireToKoboContent(questionnaire);
    const asset = await createKoboAsset(token, config.projectName, content);
    await deployKoboAsset(token, asset.uid);
    const shareLink = generateShareLink(asset.uid);
    return {
      success: true,
      assetUid: asset.uid,
      shareLink,
      xlsLink: asset.downloads?.xls,
      version: parseInt(questionnaire.version || '1', 10) || 1,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: message, timestamp: new Date().toISOString() };
  }
}

export async function syncResponses(
  token: string,
  assetUid: string,
  _questionnaireId: string,
  lastSyncTime?: string
): Promise<SyncResult> {
  try {
    const submissions = await getKoboSubmissions(token, assetUid);
    let filtered = submissions.submissions;
    if (lastSyncTime) {
      const lastSync = new Date(lastSyncTime);
      filtered = submissions.submissions.filter((s) => new Date(s._date_modified) > lastSync);
    }
    return {
      success: true,
      submissionsImported: filtered.length,
      submissionsUpdated: 0,
      submissionsSkipped: 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      submissionsImported: 0,
      submissionsUpdated: 0,
      submissionsSkipped: 0,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }
}
