/**
 * Email Knowledge Graph Data Types
 *
 * Core data structures for the email knowledge graph system.
 * This system maps emails by semantic topics regardless of subject lines,
 * creates persistent connections between emails, and enables visualization.
 */

/**
 * Entity extracted from email content
 */
export interface Entity {
  type: 'person' | 'company' | 'location' | 'date' | 'topic' | 'other';
  text: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Email Node in the Knowledge Graph
 * Represents a single email with semantic analysis data
 */
export interface EmailNode {
  // Core Microsoft Graph properties
  id: string;
  conversationId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  body: string;
  bodyPreview: string;
  importance: 'low' | 'normal' | 'high';
  hasAttachments: boolean;

  // Graph-specific fields (semantic analysis)
  embedding?: number[];          // Semantic embedding vector from GLM-4.7
  topics: string[];              // Extracted topics
  sentiment?: 'positive' | 'neutral' | 'negative';
  keywords: string[];            // Extracted keywords
  entities: Entity[];            // Named entities (people, companies, etc.)

  // Folder and direction tracking
  folder: 'inbox' | 'sentItems' | 'archive' | 'drafts' | 'other';
  isSent: boolean;              // Quick flag for sent emails
  direction: 'incoming' | 'outgoing';  // Thread direction

  // Metadata for graph management
  indexedAt: number;             // When added to graph (timestamp)
  lastAccessed: number;          // Last time used in query (timestamp)
  accessCount: number;           // Usage frequency
}

/**
 * Topic Line
 * Groups semantically related emails, threads, and other communications
 * A "line" is a cluster that has evolved to include multiple threads, texts, voicemail transcriptions, etc.
 * Users can "push" or "pull" specific lines to control notification preferences.
 */
export interface TopicLine {
  id: string;
  name: string;
  description: string;
  centroidEmbedding: number[];   // Average embedding of line center
  emailIds: string[];            // Emails in this line

  // Subject mutations - tracks different subjects for same topic
  subjectVariations: string[];   // Different subjects about same topic

  // Temporal information
  firstEmailDate: string;
  lastEmailDate: string;

  // Confidence and user feedback
  confidence: number;            // 0-1, line quality score
  userConfirmed?: boolean;       // User explicitly confirmed this line
  userRejected?: boolean;        // User explicitly rejected this line

  // Learning loop metadata
  keyTerms?: string[];           // Top terms for search
  branchCount?: number;          // How many items have been merged/branched in
  lastMergeAt?: number;          // Timestamp of last merge/branch
  pendingSuggestionCount?: number; // Quick lookup for UI badge

  // Thread completeness status
  hasOutgoing?: boolean;         // Whether thread has user's replies
  threadStatus?: 'incoming_only' | 'replied' | 'ongoing';
  incomingCount?: number;         // Count of incoming emails
  outgoingCount?: number;         // Count of outgoing emails

  // Metadata
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Use TopicLine instead */
export type TopicCluster = TopicLine;

/**
 * Email Connection
 * Represents edges in the graph between emails
 */
export interface EmailConnection {
  id: string;
  sourceEmailId: string;
  targetEmailId: string;
  connectionType: 'thread' | 'reply' | 'forward' | 'related_topic' | 'same_sender' | 'same_recipient';
  strength: number;              // 0-1, connection strength

  // For reply/forward chains
  positionInThread?: number;

  // For topic connections
  similarityScore?: number;      // Semantic similarity score

  // Metadata
  discoveredAt: number;
  confirmedByUser?: boolean;
}

/**
 * Branch in a thread conversation
 * Represents forks where multiple people respond to the same email
 */
export interface Branch {
  branchId: string;
  path: string[];                // Email IDs in this branch
  participants: string[];        // Email addresses involved
  subject: string;               // May differ from root subject
  lastEmailDate: string;
}

/**
 * Thread Branch
 * Represents the complete structure of a conversation with all branches
 */
export interface ThreadBranch {
  id: string;
  rootEmailId: string;           // Original email that started thread
  conversationId: string;        // Microsoft Graph conversation ID

  // Branch structure
  branches: Branch[];

  // Metadata
  detectedAt: number;
}

/**
 * Timeline Event
 * Represents an email on the timeline for visualization
 */
export interface TimelineEvent {
  id: string;
  emailId: string;
  timestamp: number;
  type: 'sent' | 'received' | 'thread_start' | 'thread_branch' | 'topic_line';

  // Visualization coordinates
  x: number;                     // Position on timeline (time-based)
  y: number;                     // Vertical position (thread lane)
  lineId?: string;               // Topic line membership for color coding

  // Connections to other events
  connectedTo: string[];         // Other event IDs this connects to
  connectionTypes: string[];     // Type of each connection
}

/**
 * User Graph Preferences
 * User settings for the knowledge graph system
 */
export interface UserGraphPreferences {
  userId: string;

  // Topic mapping preferences
  autoMergeThreshold: number;    // Similarity threshold for auto-merge (0-1)
  manualMerges: Record<string, string[]>;  // lineId -> emailIds to force merge
  manualSplits: Record<string, string[]>;  // lineId -> emailIds to force split

  // Visualization preferences
  timelineView: 'chronological' | 'thread' | 'topic';
  showBranches: boolean;
  lineConfidenceThreshold: number;  // Hide lines below this confidence

  // Search preferences
  expandSearchByTopic: boolean;  // Use topic lines for search expansion
  topicExpansionLimit: number;   // Max additional topics to include

  // Metadata
  updatedAt: number;
}

/**
 * User Rule for Email Categorization
 * User-defined rules for automatic email categorization
 */
export interface UserRule {
  id: string;
  userId: string;
  name: string;
  description: string;

  // Rule conditions
  conditions: RuleCondition[];

  // Rule actions
  actions: RuleAction[];

  // Metadata
  enabled: boolean;
  priority: number;
  createdAt: number;
  lastMatchedAt?: number;
  matchCount: number;
}

/**
 * Rule condition
 */
export interface RuleCondition {
  field: 'subject' | 'from' | 'to' | 'body' | 'topic' | 'sender_domain' | 'has_attachments';
  operator: 'contains' | 'equals' | 'matches_regex' | 'in_topic' | 'not_in_topic';
  value: string | string[];
}

/**
 * Rule action
 */
export interface RuleAction {
  type: 'assign_topic' | 'merge_line' | 'split_line' | 'mark_important' | 'add_keyword';
  value: string | string[];
}

/**
 * Complete Email Knowledge Graph
 * The main data structure containing all graph data
 */
export interface EmailKnowledgeGraph {
  // Core data
  emails: Map<string, EmailNode>;
  connections: Map<string, EmailConnection>;
  topicLines: Map<string, TopicLine>;
  threadBranches: Map<string, ThreadBranch>;

  // Indexes for fast lookup
  emailByConversation: Map<string, string[]>;  // conversationId -> emailIds
  emailByTopic: Map<string, string[]>;         // lineId -> emailIds
  emailBySender: Map<string, string[]>;        // sender -> emailIds
  emailByDateRange: Map<string, string[]>;     // dateRange -> emailIds

  // Metadata
  lastUpdated: number;
  version: number;
  userId: string;
}

/**
 * Graph metadata stored separately
 */
export interface GraphMetadata {
  userId: string;
  version: number;
  emailCount: number;
  topicLineCount: number;
  connectionCount: number;
  lastUpdated: number;
  indexedEmails: string[];       // List of indexed email IDs
}

/**
 * Suggestion for line improvement
 * Queued items for user review: orphan emails to branch, or threads to merge
 */
export interface Suggestion {
  id: string;
  targetLineId: string;
  type: 'orphan_branch' | 'thread_merge';
  sourceEmailId?: string;        // For orphan_branch
  sourceLineId?: string;         // For thread_merge
  matchScore: number;            // 0-1 similarity
  reason: string;                // Why this was suggested
  queuedAt: number;
  status: 'pending' | 'accepted' | 'rejected';
}

/**
 * Record of executed branch/merge for audit trail
 */
export interface BranchRecord {
  suggestionId: string;
  type: 'orphan_branch' | 'thread_merge';
  targetLineId: string;
  sourceId: string;              // Email or line ID
  confidence: number;
  executedAt: number;
  userApproved: boolean;         // Always true since user confirms
}

/**
 * Semantic profile for enhanced line search
 * Enriched profile including embeddings and key terms
 */
export interface SemanticProfile {
  lineId: string;
  embeddingCentroid: number[];
  keyTerms: Map<string, number>; // term -> weight
  emailCount: number;
  lastUpdated: number;
  version: number;
}

/**
 * Learning feedback from search operations
 */
export interface LearningFeedback {
  linesSearched: number;
  suggestionsQueued: number;
  suggestionTypes: {
    orphanBranches: number;
    threadMerges: number;
  };
}
