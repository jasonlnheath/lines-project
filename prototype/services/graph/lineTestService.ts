/**
 * Line Test Service
 *
 * Shared logic for comparing Microsoft Graph thread ground truth
 * against local line results. Used by both the test API route
 * and the agent tool.
 */

import { GraphStorageManager } from './storage/graphStorageManager';
import { TopicLine } from './types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export interface GraphThreadMessage {
  id: string;
  subject: string;
  conversationId: string;
  receivedDateTime: string;
  sentDateTime?: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
  body?: { content: string; contentType: string };
  bodyPreview?: string;
  _folder?: 'inbox' | 'sentItems';  // Internal: track source folder
}

export interface ThreadStats {
  conversationId: string;
  name: string;
  emailCount: number;
  subjectVariations: string[];
  emailIds: string[];
  firstDate: string;
  lastDate: string;
  participants: string[];
}

export interface ThreadReport {
  period: string;
  totalEmails: number;
  threadCount: number;
  threads: ThreadStats[];
}

export type MatchType = 'perfect' | 'partial' | 'missing' | 'name_mismatch';

export interface ThreadValidation {
  conversationId: string;
  threadName: string;
  threadEmailCount: number;
  matchedLineId: string | null;
  lineName: string | null;
  lineEmailCount: number | null;
  coverage: number;
  matchType: MatchType;
  nameMatch: boolean;
}

export interface ValidationReport {
  summary: {
    threadCount: number;
    lineCount: number;
    perfectMatches: number;
    partialMatches: number;
    missingLines: number;
    nameMatches: number;
    emailsInLines: number;
    totalThreadEmails: number;
  };
  threads: ThreadValidation[];
  unmatchedLines: Array<{ lineId: string; lineName: string; emailCount: number }>;
}

/**
 * Normalize subject to match lineService.generateThreadName()
 * Also handles legacy line names that end with '...'
 */
export function normalizeThreadName(subject: string): string {
  return subject
    .replace(/^(RE|FW|Fwd):\s*/i, '')
    .replace(/\s*\*/g, ' ')
    .replace(/\.\.\.+$/, '')  // Remove trailing ellipsis (legacy lines)
    .trim()
    .substring(0, 50);
}

/**
 * Fetch all emails from the last 30 days (inbox + sent items), paginating through @odata.nextLink
 */
export async function fetchLast30DaysEmails(accessToken: string): Promise<GraphThreadMessage[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch from both inbox and sent items in parallel
  // Use /me/mailFolders/Inbox/messages to avoid fetching from ALL folders
  const [inboxEmails, sentEmails] = await Promise.all([
    fetchFromFolder(accessToken, '/me/mailFolders/Inbox/messages', thirtyDaysAgo, 'inbox'),
    fetchFromFolder(accessToken, '/me/mailFolders/SentItems/messages', thirtyDaysAgo, 'sentItems')
  ]);

  return [...inboxEmails, ...sentEmails];
}

/**
 * Fetch emails from a specific folder with pagination
 */
async function fetchFromFolder(
  accessToken: string,
  endpoint: string,
  since: Date,
  folder: 'inbox' | 'sentItems'
): Promise<GraphThreadMessage[]> {
  const filter = folder === 'inbox'
    ? `receivedDateTime ge ${since.toISOString()}`
    : `sentDateTime ge ${since.toISOString()}`;
  const select = 'id,subject,conversationId,receivedDateTime,sentDateTime,from,toRecipients,body,bodyPreview';

  let url: string | null =
    `${GRAPH_BASE}${endpoint}?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=999`;

  const all: GraphThreadMessage[] = [];
  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API ${res.status}: ${text}`);
    }
    const data: { value: GraphThreadMessage[]; '@odata.nextLink'?: string } = await res.json();
    all.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }

  // Add folder metadata to each email
  return all.map(email => ({
    ...email,
    _folder: folder,  // Temporary marker, will be used during EmailNode conversion
  }));
}

/**
 * Group raw Graph messages into ThreadReport
 */
export function buildThreadReport(messages: GraphThreadMessage[]): ThreadReport {
  const map = new Map<string, {
    subjects: Set<string>;
    emailIds: string[];
    dates: string[];
    participants: Set<string>;
  }>();

  for (const msg of messages) {
    const key = msg.conversationId || msg.id;
    if (!map.has(key)) {
      map.set(key, { subjects: new Set(), emailIds: [], dates: [], participants: new Set() });
    }
    const t = map.get(key)!;
    t.subjects.add(msg.subject);
    t.emailIds.push(msg.id);
    t.dates.push(msg.receivedDateTime);
    t.participants.add(msg.from.emailAddress.address);
  }

  const threads: ThreadStats[] = [];
  for (const [conversationId, data] of map.entries()) {
    data.dates.sort();
    const sortedEmails = messages
      .filter(m => (m.conversationId || m.id) === conversationId)
      .sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime));

    const rawName = sortedEmails[0]?.subject || '(no subject)';
    threads.push({
      conversationId,
      name: normalizeThreadName(rawName),
      emailCount: data.emailIds.length,
      subjectVariations: Array.from(new Set(Array.from(data.subjects).map(normalizeThreadName))),
      emailIds: data.emailIds,
      firstDate: data.dates[0],
      lastDate: data.dates[data.dates.length - 1],
      participants: Array.from(data.participants),
    });
  }

  threads.sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    period: `${start.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
    totalEmails: messages.length,
    threadCount: threads.length,
    threads,
  };
}

/**
 * Compare lines against thread ground truth, return structured report
 */
export function validateLines(
  threadReport: ThreadReport,
  lines: TopicLine[]
): ValidationReport {
  const emailToLine = new Map<string, string>();
  for (const line of lines) {
    for (const emailId of line.emailIds) {
      emailToLine.set(emailId, line.id);
    }
  }

  const lineMap = new Map(lines.map(l => [l.id, l]));
  const matchedLineIds = new Set<string>();
  const threadValidations: ThreadValidation[] = [];

  for (const thread of threadReport.threads) {
    const lineCounts = new Map<string, number>();
    for (const emailId of thread.emailIds) {
      const lId = emailToLine.get(emailId);
      if (lId) lineCounts.set(lId, (lineCounts.get(lId) || 0) + 1);
    }

    if (lineCounts.size === 0) {
      threadValidations.push({
        conversationId: thread.conversationId,
        threadName: thread.name,
        threadEmailCount: thread.emailCount,
        matchedLineId: null,
        lineName: null,
        lineEmailCount: null,
        coverage: 0,
        matchType: 'missing',
        nameMatch: false,
      });
      continue;
    }

    let bestId = '';
    let bestCount = 0;
    for (const [lId, count] of lineCounts.entries()) {
      if (count > bestCount) { bestCount = count; bestId = lId; }
    }

    const best = lineMap.get(bestId)!;
    matchedLineIds.add(bestId);
    const coverage = bestCount / thread.emailCount;
    // Normalize both names for comparison (handles legacy lines with '...' suffix)
    const normalizedLineName = normalizeThreadName(best.name);
    const nameMatch = normalizedLineName.toLowerCase().trim() === thread.name.toLowerCase().trim();

    let matchType: MatchType;
    if (coverage >= 0.9 && lineCounts.size === 1 && nameMatch) {
      matchType = 'perfect';
    } else if (!nameMatch && coverage >= 0.9) {
      matchType = 'name_mismatch';
    } else {
      matchType = coverage >= 0.5 ? 'partial' : 'missing';
    }

    threadValidations.push({
      conversationId: thread.conversationId,
      threadName: thread.name,
      threadEmailCount: thread.emailCount,
      matchedLineId: bestId,
      lineName: best.name,
      lineEmailCount: best.emailIds.length,
      coverage,
      matchType,
      nameMatch,
    });
  }

  const unmatchedLines = lines
    .filter(l => !matchedLineIds.has(l.id))
    .map(l => ({ lineId: l.id, lineName: l.name, emailCount: l.emailIds.length }));

  return {
    summary: {
      threadCount: threadReport.threadCount,
      lineCount: lines.length,
      perfectMatches: threadValidations.filter(t => t.matchType === 'perfect').length,
      partialMatches: threadValidations.filter(t => t.matchType === 'partial' || t.matchType === 'name_mismatch').length,
      missingLines: threadValidations.filter(t => t.matchType === 'missing').length,
      nameMatches: threadValidations.filter(t => t.nameMatch).length,
      emailsInLines: lines.reduce((s, l) => s + l.emailIds.length, 0),
      totalThreadEmails: threadReport.totalEmails,
    },
    threads: threadValidations,
    unmatchedLines,
  };
}

/**
 * Run full report: fetch thread stats + compare against lines in storage
 */
export async function runFullReport(
  accessToken: string,
  userId: string
): Promise<{ threadStats: ThreadReport; lineValidation: ValidationReport }> {
  const [messages, lines] = await Promise.all([
    fetchLast30DaysEmails(accessToken),
    new GraphStorageManager(userId).getTopicLines(),
  ]);
  const threadStats = buildThreadReport(messages);
  const lineValidation = validateLines(threadStats, lines);
  return { threadStats, lineValidation };
}

// Backward compatibility aliases
export const validateClustering = validateLines;
export const clusteringValidation = validateLines;
