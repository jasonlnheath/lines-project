/**
 * Role Detector Service
 *
 * Detects user role from Graph API profile information.
 * Used to customize onboarding questions based on job function.
 */

import {
  UserRole,
  DetectionConfidence,
  RoleDetection,
  GraphOrgInfo,
  GraphUserProfile,
} from './types';

/**
 * Role detection patterns
 * Maps job title keywords to roles
 */
const ROLE_PATTERNS: Record<UserRole, {
  titlePatterns: RegExp[];
  departmentPatterns: RegExp[];
}> = {
  sales: {
    titlePatterns: [
      /\bsales\b/i,
      /\baccount\s*(executive|manager|rep|representative)\b/i,
      /\bbusiness\s*development\b/i,
      /\bbd\b/i,
      /\bclient\s*(success|manager|partner)\b/i,
      /\bcustomer\s*success\b/i,
      /\bterritory\b/i,
      /\bquota\b/i,
    ],
    departmentPatterns: [/\bsales\b/i, /\brevenue\b/i, /\bgrowth\b/i],
  },
  purchasing: {
    titlePatterns: [
      /\bpurchasing\b/i,
      /\bprocurement\b/i,
      /\bbuyer\b/i,
      /\bsourcing\b/i,
      /\bsupply\s*chain\b/i,
      /\bvendor\s*manager\b/i,
      /\bcontracts\s*manager\b/i,
    ],
    departmentPatterns: [/\bprocurement\b/i, /\bsupply\s*chain\b/i, /\bsourcing\b/i],
  },
  executive: {
    titlePatterns: [
      /\bceo\b/i,
      /\bcto\b/i,
      /\bcfo\b/i,
      /\bcoo\b/i,
      /\bcmo\b/i,
      /\bchief\s+/i,
      /\bvice\s*president\b/i,
      /\bvp\b/i,
      /\bpresident\b/i,
      /\bowner\b/i,
      /\bfounder\b/i,
      /\bmanaging\s*director\b/i,
    ],
    departmentPatterns: [/\bexecutive\b/i, /\boffice\s*of\s*ceo\b/i],
  },
  engineering: {
    titlePatterns: [
      /\bengineer\b/i,
      /\bdeveloper\b/i,
      /\bprogrammer\b/i,
      /\barchitect\b/i,
      /\bdevops\b/i,
      /\bsre\b/i,
      /\btech\s*lead\b/i,
      /\bsoftware\b/i,
      /\bfull\s*stack\b/i,
      /\bbackend\b/i,
      /\bfrontend\b/i,
    ],
    departmentPatterns: [/\bengineering\b/i, /\btech\b/i, /\bdevelopment\b/i],
  },
  support: {
    titlePatterns: [
      /\bsupport\b/i,
      /\bhelp\s*desk\b/i,
      /\bcustomer\s*service\b/i,
      /\btechnical\s*support\b/i,
      /\bsuccess\s*engineer\b/i,
      /\bsolutions\s*engineer\b/i,
    ],
    departmentPatterns: [/\bsupport\b/i, /\bcustomer\s*service\b/i],
  },
  marketing: {
    titlePatterns: [
      /\bmarketing\b/i,
      /\bgrowth\s*hacker\b/i,
      /\bcontent\s*strategist\b/i,
      /\bseo\b/i,
      /\bbrand\b/i,
      /\bcampaign\b/i,
      /\bdemand\s*gen\b/i,
    ],
    departmentPatterns: [/\bmarketing\b/i, /\bbrand\b/i, /\bgrowth\b/i],
  },
  finance: {
    titlePatterns: [
      /\bfinance\b/i,
      /\baccountant\b/i,
      /\bcontroller\b/i,
      /\banalyst\b/i,
      /\btax\b/i,
      /\baudit\b/i,
      /\btreasury\b/i,
      /\bfp&a\b/i,
    ],
    departmentPatterns: [/\bfinance\b/i, /\baccounting\b/i, /\bfinancial\b/i],
  },
  hr: {
    titlePatterns: [
      /\bhr\b/i,
      /\bhuman\s*resources\b/i,
      /\bpeople\s*ops\b/i,
      /\brecruiter\b/i,
      /\btalent\b/i,
      /\bcompensation\b/i,
      /\bbenefits\b/i,
      /\btraining\b/i,
    ],
    departmentPatterns: [/\bhr\b/i, /\bhuman\s*resources\b/i, /\bpeople\b/i],
  },
  operations: {
    titlePatterns: [
      /\boperations\b/i,
      /\bops\s*manager\b/i,
      /\bfacilities\b/i,
      /\badministrative\b/i,
      /\badmin\b/i,
      /\bproject\s*manager\b/i,
      /\bprogram\s*manager\b/i,
    ],
    departmentPatterns: [/\boperations\b/i, /\badmin\b/i],
  },
  legal: {
    titlePatterns: [
      /\battorney\b/i,
      /\blawyer\b/i,
      /\bcounsel\b/i,
      /\blegal\b/i,
      /\bcompliance\b/i,
    ],
    departmentPatterns: [/\blegal\b/i, /\bcompliance\b/i],
  },
  it: {
    titlePatterns: [
      /\bit\s*(manager|director|admin|specialist)\b/i,
      /\bsystem\s*admin\b/i,
      /\bnetwork\s*engineer\b/i,
      /\bsecurity\s*engineer\b/i,
      /\binfo\s*sec\b/i,
    ],
    departmentPatterns: [/\bit\b/i, /\binformation\s*technology\b/i, /\bsecurity\b/i],
  },
  product: {
    titlePatterns: [
      /\bproduct\s*(manager|owner|designer)\b/i,
      /\bpm\b/i,
      /\bux\b/i,
      /\bui\b/i,
      /\bdesigner\b/i,
      /\buser\s*research\b/i,
    ],
    departmentPatterns: [/\bproduct\b/i, /\bdesign\b/i, /\bux\b/i],
  },
  other: {
    titlePatterns: [],
    departmentPatterns: [],
  },
};

/**
 * Role Detector Service
 */
export class RoleDetectorService {
  /**
   * Detect user role from Graph API organization info
   */
  detectRole(orgInfo: GraphOrgInfo): RoleDetection {
    const { user, manager, directReports } = orgInfo;

    // Try to detect role from job title and department
    const roleFromProfile = this.detectFromProfile(user);

    // If we have direct reports, might be a manager/executive
    const hasDirectReports = directReports.length > 0;

    // Check if user reports to C-level (might be senior)
    const reportsToExecutive = manager?.jobTitle
      ? this.isExecutiveTitle(manager.jobTitle)
      : false;

    // Combine signals
    let inferredRole = roleFromProfile.role;
    let confidence = roleFromProfile.confidence;

    // Executive detection overrides
    if (this.isExecutiveTitle(user.jobTitle || '')) {
      inferredRole = 'executive';
      confidence = 'high';
    }

    // Adjust confidence based on additional signals
    if (hasDirectReports && confidence === 'low') {
      confidence = 'medium';
    }

    if (reportsToExecutive && confidence === 'low') {
      confidence = 'medium';
    }

    return {
      userId: user.id,
      inferredRole,
      confidence,
      signals: {
        department: user.department,
        jobTitle: user.jobTitle,
        managerTitle: manager?.jobTitle,
        directReportCount: directReports.length,
      },
    };
  }

  /**
   * Detect role from user profile alone
   */
  private detectFromProfile(
    user: GraphUserProfile
  ): { role: UserRole; confidence: DetectionConfidence } {
    const jobTitle = user.jobTitle?.toLowerCase() || '';
    const department = user.department?.toLowerCase() || '';

    // Check each role's patterns
    for (const [role, patterns] of Object.entries(ROLE_PATTERNS) as [UserRole, typeof ROLE_PATTERNS[UserRole]][]) {
      if (role === 'other') continue;

      // Check title patterns
      for (const pattern of patterns.titlePatterns) {
        if (pattern.test(jobTitle)) {
          // High confidence if title matches
          return { role, confidence: 'high' };
        }
      }

      // Check department patterns
      for (const pattern of patterns.departmentPatterns) {
        if (pattern.test(department)) {
          // Medium confidence if only department matches
          return { role, confidence: 'medium' };
        }
      }
    }

    // No match found
    return { role: 'other', confidence: 'low' };
  }

  /**
   * Check if a job title indicates executive level
   */
  isExecutiveTitle(jobTitle: string): boolean {
    const title = jobTitle.toLowerCase();

    // C-level
    if (/^(ceo|cio|cto|cfo|coo|cmo|cro|cso|cpo|clo)\b/.test(title)) return true;
    if (title.includes('chief ')) return true;

    // VP
    if (title.includes('vice president')) return true;
    if (/^vp\b|^vp\s|^\s*vp\s|^\s*vp\./.test(title)) return true;

    // Owner/founder/president
    if (title.includes('owner')) return true;
    if (title.includes('founder')) return true;
    if (title.includes('president')) return true;

    // Managing director
    if (title.includes('managing director')) return true;

    return false;
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role: UserRole): string {
    const displayNames: Record<UserRole, string> = {
      sales: 'Sales Professional',
      purchasing: 'Purchasing Agent',
      executive: 'Executive',
      engineering: 'Engineer',
      support: 'Support Specialist',
      marketing: 'Marketing Professional',
      finance: 'Finance Professional',
      hr: 'HR Professional',
      operations: 'Operations Manager',
      legal: 'Legal Professional',
      it: 'IT Professional',
      product: 'Product Manager',
      other: 'Professional',
    };

    return displayNames[role];
  }

  /**
   * Get role description for onboarding
   */
  getRoleDescription(role: UserRole): string {
    const descriptions: Record<UserRole, string> = {
      sales: 'focused on customer relationships and revenue growth',
      purchasing: 'focused on vendor relationships and procurement',
      executive: 'leading the organization and managing key stakeholders',
      engineering: 'building and maintaining technical solutions',
      support: 'helping customers succeed with products and services',
      marketing: 'driving brand awareness and demand generation',
      finance: 'managing financial operations and reporting',
      hr: 'managing people operations and talent',
      operations: 'keeping the business running smoothly',
      legal: 'handling legal and compliance matters',
      it: 'managing technology infrastructure',
      product: 'defining and building products',
      other: 'contributing to the organization',
    };

    return descriptions[role];
  }
}

// Singleton instance
let detectorInstance: RoleDetectorService | null = null;

/**
 * Get or create the RoleDetectorService singleton
 */
export function getRoleDetectorService(): RoleDetectorService {
  if (!detectorInstance) {
    detectorInstance = new RoleDetectorService();
  }
  return detectorInstance;
}
