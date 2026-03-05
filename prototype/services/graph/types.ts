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

  // Metadata for graph management
  indexedAt: number;             // When added to graph (timestamp)
  lastAccessed: number;          // Last time used in query (timestamp)
  accessCount: number;           // Usage frequency
}

/**
 * Topic Cluster
 * Groups semantically related emails even when subjects differ
 */
export interface TopicCluster {
  id: string;
  name: string;
  description: string;
  centroidEmbedding: number[];   // Average embedding of cluster center
  emailIds: string[];            // Emails in this cluster

  // Subject mutations - tracks different subjects for same topic
  subjectVariations: string[];   // Different subjects about same topic

  // Temporal information
  firstEmailDate: string;
  lastEmailDate: string;

  // Confidence and user feedback
  confidence: number;            // 0-1, cluster quality score
  userConfirmed?: boolean;       // User explicitly confirmed this cluster
  userRejected?: boolean;        // User explicitly rejected this cluster

  // Metadata
  createdAt: number;
  updatedAt: number;
}

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
  type: 'sent' | 'received' | 'thread_start' | 'thread_branch' | 'topic_cluster';

  // Visualization coordinates
  x: number;                     // Position on timeline (time-based)
  y: number;                     // Vertical position (thread lane)
  clusterId?: string;            // Topic cluster membership for color coding

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
  manualMerges: Record<string, string[]>;  // clusterId -> emailIds to force merge
  manualSplits: Record<string, string[]>;  // clusterId -> emailIds to force split

  // Visualization preferences
  timelineView: 'chronological' | 'thread' | 'topic';
  showBranches: boolean;
  clusterConfidenceThreshold: number;  // Hide clusters below this confidence

  // Search preferences
  expandSearchByTopic: boolean;  // Use topic clusters for search expansion
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
  type: 'assign_topic' | 'merge_cluster' | 'split_cluster' | 'mark_important' | 'add_keyword';
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
  topicClusters: Map<string, TopicCluster>;
  threadBranches: Map<string, ThreadBranch>;

  // Indexes for fast lookup
  emailByConversation: Map<string, string[]>;  // conversationId -> emailIds
  emailByTopic: Map<string, string[]>;         // clusterId -> emailIds
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
  topicClusterCount: number;
  connectionCount: number;
  lastUpdated: number;
  indexedEmails: string[];       // List of indexed email IDs
}
