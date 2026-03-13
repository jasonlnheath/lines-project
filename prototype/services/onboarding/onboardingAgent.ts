/**
 * Onboarding Agent Service
 *
 * Conducts role-based onboarding conversation to learn user preferences.
 * No manual tags - the agent asks smart questions based on job function.
 */

import {
  UserRole,
  OnboardingState,
  OnboardingQuestion,
  OnboardingAnswer,
  OnboardingSummary,
  PreFilledContact,
  RoleDetection,
  QuestionCategory,
  RoleQuestionTemplate,
} from './types';
import { ContactPushPreference } from '../contacts/types';
import { RoleDetectorService, getRoleDetectorService } from './roleDetector';

/**
 * Role-based question templates
 * Each role gets customized questions based on their function
 */
const ROLE_TEMPLATES: Record<UserRole, RoleQuestionTemplate> = {
  sales: {
    role: 'sales',
    displayName: 'Sales Professional',
    description: 'focused on customer relationships and revenue growth',
    categories: [
      {
        category: 'customers',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'For your **customers**, I suggest always pushing their emails. Does that work for you?',
      },
      {
        category: 'prospects',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'What about **prospects** in your pipeline? Should those be pushed too?',
      },
      {
        category: 'partners',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'Should emails from **partners** be pushed?',
      },
      {
        category: 'vendors',
        priority: 4,
        suggestedDefault: 'pull',
        questionTemplate:
          'What about **vendors**? I typically suggest pulling those unless urgent.',
      },
    ],
  },
  purchasing: {
    role: 'purchasing',
    displayName: 'Purchasing Agent',
    description: 'focused on vendor relationships and procurement',
    categories: [
      {
        category: 'vendors',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'Since you manage vendor relationships, I suggest **pushing** vendor emails. Sound good?',
      },
      {
        category: 'internal',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'What about **internal requests** from colleagues? Should those be pushed?',
      },
      {
        category: 'partners',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'Should emails from **partners** be pushed?',
      },
      {
        category: 'prospects',
        priority: 4,
        suggestedDefault: 'pull',
        questionTemplate:
          'Salespeople often reach out. Should **sales reps** be pulled by default?',
      },
    ],
  },
  executive: {
    role: 'executive',
    displayName: 'Executive',
    description: 'leading the organization and managing key stakeholders',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'As an executive, I suggest always pushing emails from your **direct reports**. Does that work?',
      },
      {
        category: 'board',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'Should emails from **board members** and **investors** be pushed?',
      },
      {
        category: 'executives',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate:
          'What about other **executives** in the company?',
      },
      {
        category: 'media',
        priority: 4,
        suggestedDefault: 'ask',
        questionTemplate:
          'For **media** contacts, I suggest asking each time. Does that work?',
      },
    ],
  },
  engineering: {
    role: 'engineering',
    displayName: 'Engineer',
    description: 'building and maintaining technical solutions',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **engineering team**. Sound good?',
      },
      {
        category: 'internal',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'What about emails from **product managers** and **designers**?',
      },
      {
        category: 'vendors',
        priority: 3,
        suggestedDefault: 'pull',
        questionTemplate:
          'For **vendor support** emails, I suggest pulling by default.',
      },
    ],
  },
  support: {
    role: 'support',
    displayName: 'Support Specialist',
    description: 'helping customers succeed with products and services',
    categories: [
      {
        category: 'customers',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'Since you handle support, I suggest **pushing** customer emails. Does that work?',
      },
      {
        category: 'team',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate: 'Should emails from your **support team** be pushed?',
      },
      {
        category: 'internal',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'What about **escalations** from other teams?',
      },
    ],
  },
  marketing: {
    role: 'marketing',
    displayName: 'Marketing Professional',
    description: 'driving brand awareness and demand generation',
    categories: [
      {
        category: 'partners',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'For **partners** and **agencies**, I suggest pushing. Sound good?',
      },
      {
        category: 'team',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate: 'Should emails from your **marketing team** be pushed?',
      },
      {
        category: 'media',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'What about **media** and **press** contacts?',
      },
    ],
  },
  finance: {
    role: 'finance',
    displayName: 'Finance Professional',
    description: 'managing financial operations and reporting',
    categories: [
      {
        category: 'vendors',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'For **vendor invoices** and **financial communications**, I suggest pushing.',
      },
      {
        category: 'team',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate: 'Should emails from your **finance team** be pushed?',
      },
      {
        category: 'internal',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'What about **budget requests** from other departments?',
      },
    ],
  },
  hr: {
    role: 'hr',
    displayName: 'HR Professional',
    description: 'managing people operations and talent',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **HR team**. Does that work?',
      },
      {
        category: 'internal',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'What about **employee inquiries**? Those might be time-sensitive.',
      },
      {
        category: 'vendors',
        priority: 3,
        suggestedDefault: 'pull',
        questionTemplate: 'Should **recruiters** and **vendors** be pulled by default?',
      },
    ],
  },
  operations: {
    role: 'operations',
    displayName: 'Operations Manager',
    description: 'keeping the business running smoothly',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **operations team**.',
      },
      {
        category: 'vendors',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate: 'What about **vendor** communications?',
      },
      {
        category: 'internal',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'Should **facility** and **IT** requests be pushed?',
      },
    ],
  },
  legal: {
    role: 'legal',
    displayName: 'Legal Professional',
    description: 'handling legal and compliance matters',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **legal team**.',
      },
      {
        category: 'internal',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'What about **contract requests** from other departments?',
      },
      {
        category: 'vendors',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'Should **outside counsel** emails be pushed?',
      },
    ],
  },
  it: {
    role: 'it',
    displayName: 'IT Professional',
    description: 'managing technology infrastructure',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **IT team**.',
      },
      {
        category: 'internal',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate:
          'What about **support tickets** and **security alerts**?',
      },
      {
        category: 'vendors',
        priority: 3,
        suggestedDefault: 'pull',
        questionTemplate: 'Should **vendor sales** emails be pulled?',
      },
    ],
  },
  product: {
    role: 'product',
    displayName: 'Product Manager',
    description: 'defining and building products',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **product and engineering teams**.',
      },
      {
        category: 'customers',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate: 'What about **customer feedback** emails?',
      },
      {
        category: 'internal',
        priority: 3,
        suggestedDefault: 'push',
        questionTemplate: 'Should **stakeholder** communications be pushed?',
      },
    ],
  },
  other: {
    role: 'other',
    displayName: 'Professional',
    description: 'contributing to the organization',
    categories: [
      {
        category: 'team',
        priority: 1,
        suggestedDefault: 'push',
        questionTemplate:
          'I suggest pushing emails from your **team members**.',
      },
      {
        category: 'internal',
        priority: 2,
        suggestedDefault: 'push',
        questionTemplate: 'What about emails from other **colleagues**?',
      },
      {
        category: 'vendors',
        priority: 3,
        suggestedDefault: 'pull',
        questionTemplate: 'Should **external** emails be pulled by default?',
      },
    ],
  },
};

/**
 * Onboarding Agent Service
 */
export class OnboardingAgentService {
  private roleDetector: RoleDetectorService;
  private onboardingStates: Map<string, OnboardingState> = new Map();

  constructor() {
    this.roleDetector = getRoleDetectorService();
  }

  /**
   * Start onboarding for a user
   */
  startOnboarding(
    userId: string,
    roleDetection: RoleDetection,
    preFilledContacts: PreFilledContact[] = []
  ): OnboardingState {
    const template = ROLE_TEMPLATES[roleDetection.inferredRole];
    const questions = this.generateQuestions(template);

    const state: OnboardingState = {
      userId,
      status: 'in_progress',
      roleDetection,
      preFilledContacts,
      questions,
      answers: [],
      currentQuestionIndex: 0,
      startedAt: Date.now(),
    };

    this.onboardingStates.set(userId, state);
    return state;
  }

  /**
   * Generate questions from role template
   */
  private generateQuestions(template: RoleQuestionTemplate): OnboardingQuestion[] {
    return template.categories
      .sort((a, b) => a.priority - b.priority)
      .map((cat, index) => ({
        id: `q-${index}`,
        category: cat.category,
        question: cat.questionTemplate,
        suggestedDefault: cat.suggestedDefault,
        options: this.generateOptions(cat.suggestedDefault),
      }));
  }

  /**
   * Generate answer options for a question
   */
  private generateOptions(suggestedDefault: ContactPushPreference): OnboardingQuestion['options'] {
    return [
      {
        label: 'Yes, push',
        value: 'push',
        description: 'Always push emails from this category',
      },
      {
        label: 'No, pull',
        value: 'pull',
        description: 'Let me check these emails on my schedule',
      },
      {
        label: 'Ask me each time',
        value: 'ask',
        description: "I'll decide based on the specific email",
      },
    ];
  }

  /**
   * Get current question for a user
   */
  getCurrentQuestion(userId: string): OnboardingQuestion | null {
    const state = this.onboardingStates.get(userId);
    if (!state || state.status !== 'in_progress') return null;

    if (state.currentQuestionIndex >= state.questions.length) {
      return null;
    }

    return state.questions[state.currentQuestionIndex];
  }

  /**
   * Submit answer to current question
   */
  submitAnswer(
    userId: string,
    preference: ContactPushPreference,
    details?: { specificContacts?: string[]; companyDomains?: string[] }
  ): OnboardingState {
    const state = this.onboardingStates.get(userId);
    if (!state || state.status !== 'in_progress') {
      throw new Error('No active onboarding session');
    }

    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('No more questions');
    }

    // Record answer
    const answer: OnboardingAnswer = {
      questionId: currentQuestion.id,
      category: currentQuestion.category,
      selectedPreference: preference,
      ...details,
    };

    state.answers.push(answer);
    state.currentQuestionIndex++;

    // Check if onboarding is complete
    if (state.currentQuestionIndex >= state.questions.length) {
      state.status = 'completed';
      state.completedAt = Date.now();
    }

    return state;
  }

  /**
   * Skip onboarding
   */
  skipOnboarding(userId: string): OnboardingState {
    const state = this.onboardingStates.get(userId);
    if (!state) {
      throw new Error('No active onboarding session');
    }

    state.status = 'skipped';
    state.completedAt = Date.now();
    return state;
  }

  /**
   * Get onboarding state
   */
  getOnboardingState(userId: string): OnboardingState | null {
    return this.onboardingStates.get(userId) || null;
  }

  /**
   * Generate onboarding summary
   */
  generateSummary(userId: string): OnboardingSummary | null {
    const state = this.onboardingStates.get(userId);
    if (!state || state.status !== 'completed') {
      return null;
    }

    // Build always-push contacts list
    const alwaysPushContacts: OnboardingSummary['alwaysPushContacts'] = [];

    // Add pre-filled contacts (manager, executives)
    for (const contact of state.preFilledContacts) {
      if (contact.suggestedPreference === 'push') {
        alwaysPushContacts.push({
          email: contact.email,
          name: contact.name,
          reason: contact.reason,
        });
      }
    }

    // Build company rules from answers
    const companyRules: OnboardingSummary['companyRules'] = [];
    for (const answer of state.answers) {
      if (answer.companyDomains && answer.companyDomains.length > 0) {
        companyRules.push({
          category: answer.category,
          domains: answer.companyDomains,
          preference: answer.selectedPreference,
        });
      }
    }

    // Determine default external behavior
    let defaultExternalBehavior: 'push' | 'pull' | 'ask' = 'pull';
    const externalCategories = state.answers.filter((a) =>
      ['vendors', 'media', 'prospects'].includes(a.category)
    );

    if (externalCategories.length > 0) {
      const pushCount = externalCategories.filter((a) => a.selectedPreference === 'push').length;
      if (pushCount > externalCategories.length / 2) {
        defaultExternalBehavior = 'push';
      }
    }

    return {
      userId,
      role: state.roleDetection?.inferredRole || 'other',
      alwaysPushContacts,
      companyRules,
      defaultExternalBehavior,
      completedAt: state.completedAt!,
    };
  }

  /**
   * Get role template for display
   */
  getRoleTemplate(role: UserRole): RoleQuestionTemplate {
    return ROLE_TEMPLATES[role];
  }

  /**
   * Get welcome message for role
   */
  getWelcomeMessage(roleDetection: RoleDetection): string {
    const displayName = this.roleDetector.getRoleDisplayName(roleDetection.inferredRole);
    const description = this.roleDetector.getRoleDescription(roleDetection.inferredRole);

    return `I see you're a **${displayName}** ${description}. Let me help you set up your email priorities based on your role.

I'll ask a few quick questions to understand who should reach you immediately (push) vs. who can wait for your review (pull).

**Push** = Important emails appear instantly
**Pull** = You check them on your schedule`;
  }

  /**
   * Get completion message with summary
   */
  getCompletionMessage(summary: OnboardingSummary): string {
    const roleTemplate = ROLE_TEMPLATES[summary.role];

    return `Perfect! Here's your email priority setup:

**Always Push (CYA):**
${summary.alwaysPushContacts.map((c) => `- ${c.name || c.email} (${c.reason})`).join('\n') || '- Your manager and executives (auto-detected)'}

**Category Rules:**
${summary.companyRules.map((r) => `- ${r.category}: ${r.preference}`).join('\n') || '- Based on your role as ' + roleTemplate.displayName}

**Default for Unknown:**
- External senders: **${summary.defaultExternalBehavior}**
- Internal colleagues: **push** (same company domain)

You can always adjust these in Settings. Let's start managing your emails!`;
  }
}

// Singleton instance
let agentInstance: OnboardingAgentService | null = null;

/**
 * Get or create the OnboardingAgentService singleton
 */
export function getOnboardingAgentService(): OnboardingAgentService {
  if (!agentInstance) {
    agentInstance = new OnboardingAgentService();
  }
  return agentInstance;
}
