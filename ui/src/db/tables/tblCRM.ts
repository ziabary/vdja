import { getDB } from '../index';

export const tables = {
  workspaces: 'tblCRMWorkspaces',
  members: 'tblCRMMembers',
  products: 'tblCRMProducts',
  customers: 'tblCRMCustomers',
  contacts: 'tblCRMContacts',
  assets: 'tblCRMAssets',
  tickets: 'tblCRMTickets',
  opportunities: 'tblCRMOpportunities',
  tasks: 'tblCRMTasks',
  conversations: 'tblCRMConversations',
  conversationMessages: 'tblCRMConversationMessages',
  conversationReads: 'tblCRMConversationReads',
  activities: 'tblCRMActivities',
} as const;

export const cols = {
  workspace: {
    id: 'crwID', key: 'crwKey', name: 'crwName', ownerUserID: 'crwOwner_usrID', currency: 'crwCurrency',
    settings: 'crwSettings', status: 'crwStatus', createdAt: 'crwCreatedAt', updatedAt: 'crwUpdatedAt',
  },
  member: {
    id: 'crmID', workspaceID: 'crmWorkspace_crwID', userID: 'crmUser_usrID', role: 'crmRole', status: 'crmStatus',
    createdAt: 'crmCreatedAt', updatedAt: 'crmUpdatedAt',
  },
  product: {
    id: 'crpID', key: 'crpKey', workspaceID: 'crpWorkspace_crwID', code: 'crpCode', name: 'crpName',
    shortName: 'crpShortName', type: 'crpType', category: 'crpCategory', icon: 'crpIcon', price: 'crpPrice',
    description: 'crpDescription', status: 'crpStatus', createdAt: 'crpCreatedAt', updatedAt: 'crpUpdatedAt',
  },
  customer: {
    id: 'crcID', key: 'crcKey', workspaceID: 'crcWorkspace_crwID', ownerUserID: 'crcOwner_usrID', name: 'crcName',
    short: 'crcShort', industry: 'crcIndustry', city: 'crcCity', tier: 'crcTier', health: 'crcHealth',
    lifetimeValue: 'crcLifetimeValue', annualRevenue: 'crcAnnualRevenue', lastInteraction: 'crcLastInteraction',
    nextAction: 'crcNextAction', nextActionDue: 'crcNextActionDue', renewalDate: 'crcRenewalDate', tags: 'crcTags',
    aiSummary: 'crcAISummary', status: 'crcStatus', createdAt: 'crcCreatedAt', updatedAt: 'crcUpdatedAt',
  },
  contact: {
    id: 'ccoID', key: 'ccoKey', customerID: 'ccoCustomer_crcID', name: 'ccoName', title: 'ccoTitle', phone: 'ccoPhone',
    email: 'ccoEmail', decisionRole: 'ccoDecisionRole', isPrimary: 'ccoIsPrimary', status: 'ccoStatus',
    createdAt: 'ccoCreatedAt', updatedAt: 'ccoUpdatedAt',
  },
  asset: {
    id: 'casID', key: 'casKey', customerID: 'casCustomer_crcID', productID: 'casProduct_crpID', name: 'casName',
    quantity: 'casQuantity', status: 'casStatus', contract: 'casContract', expiresAt: 'casExpiresAt', meta: 'casMeta',
    createdAt: 'casCreatedAt', updatedAt: 'casUpdatedAt',
  },
  ticket: {
    id: 'ctkID', key: 'ctkKey', customerID: 'ctkCustomer_crcID', title: 'ctkTitle', status: 'ctkStatus',
    priority: 'ctkPriority', externalRef: 'ctkExternalRef', description: 'ctkDescription', createdAt: 'ctkCreatedAt',
    updatedAt: 'ctkUpdatedAt',
  },
  opportunity: {
    id: 'copID', key: 'copKey', workspaceID: 'copWorkspace_crwID', customerID: 'copCustomer_crcID', productID: 'copProduct_crpID',
    ownerUserID: 'copOwner_usrID', title: 'copTitle', quantity: 'copQuantity', value: 'copValue', stage: 'copStage',
    probability: 'copProbability', expectedClose: 'copExpectedClose', lastActivity: 'copLastActivity', source: 'copSource',
    risk: 'copRisk', nextAction: 'copNextAction', status: 'copStatus', createdAt: 'copCreatedAt', updatedAt: 'copUpdatedAt',
  },
  task: {
    id: 'ctaID', key: 'ctaKey', workspaceID: 'ctaWorkspace_crwID', customerID: 'ctaCustomer_crcID',
    opportunityID: 'ctaOpportunity_copID', assignedUserID: 'ctaAssigned_usrID', createdByUserID: 'ctaCreatedBy_usrID',
    title: 'ctaTitle', dueAt: 'ctaDueAt', priority: 'ctaPriority', doneAt: 'ctaDoneAt', status: 'ctaStatus',
    createdAt: 'ctaCreatedAt', updatedAt: 'ctaUpdatedAt',
  },
  conversation: {
    id: 'ccvID', key: 'ccvKey', workspaceID: 'ccvWorkspace_crwID', customerID: 'ccvCustomer_crcID', contactID: 'ccvContact_ccoID',
    assignedUserID: 'ccvAssigned_usrID', channel: 'ccvChannel', subject: 'ccvSubject', body: 'ccvBody', preview: 'ccvPreview',
    ai: 'ccvAI', status: 'ccvStatus', createdAt: 'ccvCreatedAt', updatedAt: 'ccvUpdatedAt',
  },
  conversationMessage: {
    id: 'ccmID', key: 'ccmKey', conversationID: 'ccmConversation_ccvID', senderUserID: 'ccmSender_usrID',
    direction: 'ccmDirection', body: 'ccmBody', createdAt: 'ccmCreatedAt',
  },
  conversationRead: {
    id: 'ccrID', conversationID: 'ccrConversation_ccvID', userID: 'ccrUser_usrID', readAt: 'ccrReadAt',
  },
  activity: {
    id: 'cacID', key: 'cacKey', workspaceID: 'cacWorkspace_crwID', customerID: 'cacCustomer_crcID',
    createdByUserID: 'cacCreatedBy_usrID', type: 'cacType', title: 'cacTitle', detail: 'cacDetail',
    relatedType: 'cacRelatedType', relatedKey: 'cacRelatedKey', createdAt: 'cacCreatedAt',
  },
} as const;

export function firstInsertedID(result: unknown, idColumn: string): number {
  if (!Array.isArray(result)) return Number(result || 0);
  const first = result[0] as number | Record<string, unknown> | undefined;
  if (typeof first === 'number') return first;
  return Number(first?.[idColumn] || 0);
}

export default {
  tables,
  cols,
  firstInsertedID,
  getDB,
};
