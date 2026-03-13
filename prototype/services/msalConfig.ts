import { Configuration, LogLevel } from '@azure/msal-node';

/**
 * MSAL Configuration for Microsoft Graph API
 * Documentation: https://github.com/AzureAD/microsoft-authentication-library-for-js
 */

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
    },
  },
};

/**
 * Microsoft Graph API scopes
 * These are the permissions we need for the prototype
 */
export const graphScopes = {
  // User profile
  userRead: ['User.Read'],
  userReadAll: ['User.Read.All'], // For manager/direct reports

  // Mail access
  mailRead: ['Mail.Read'],
  mailReadWrite: ['Mail.ReadWrite'],
  mailSend: ['Mail.Send'],

  // Contacts access (for relationship context)
  contactsRead: ['Contacts.Read'],
  peopleRead: ['People.Read'],

  // OneDrive access
  filesReadWrite: ['Files.ReadWrite'],
  filesReadWriteAll: ['Files.ReadWrite.All'],

  // Offline access for refresh tokens
  offlineAccess: ['offline_access'],
};

/**
 * Combined scopes for initial authentication
 */
export const authScopes = [
  'User.Read',
  'User.Read.All',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Contacts.Read',
  'People.Read',
  'Files.ReadWrite',
  'Files.ReadWrite.All',
  'offline_access',
];

/**
 * Microsoft Graph API endpoints
 */
export const graphEndpoints = {
  me: 'https://graph.microsoft.com/v1.0/me',
  messages: 'https://graph.microsoft.com/v1.0/me/messages',
  sendMessage: 'https://graph.microsoft.com/v1.0/me/sendMail',
  // Microsoft Search API for relevance-ranked email search
  search: 'https://graph.microsoft.com/v1.0/search/query',
  // Mail folder endpoints for searching different folders
  sentItems: 'https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages',
  archive: 'https://graph.microsoft.com/v1.0/me/mailFolders/Archive/messages',
  drafts: 'https://graph.microsoft.com/v1.0/me/mailFolders/Drafts/messages',
  // OneDrive endpoints
  driveRoot: 'https://graph.microsoft.com/v1.0/me/drive/root',
  driveChildren: 'https://graph.microsoft.com/v1.0/me/drive/root/children',
};
