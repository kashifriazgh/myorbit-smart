export interface MemberConfig {
  clientId: string;
  premiumMember: boolean;
  membershipTill: string; // ISO date format YYYY-MM-DD
}

// Global list of members mapped to their client ID
export const membersList: MemberConfig[] = [
  {
    clientId: 'client-a-prod',
    premiumMember: true,
    membershipTill: '2026-12-31',
  },
  {
    clientId: 'clt-10003',
    premiumMember: true,
    membershipTill: '2030-12-31',
  },
  // Add other netlify client IDs here as needed
];

/**
 * Checks if a given Client ID belongs to a premium member whose membership is currently active.
 * If the Client ID is null or missing, it will return false (or true for guest mode if desired).
 */
export function isPremiumClient(clientId: string | null | undefined): boolean {
  if (!clientId) return false;
  
  const member = membersList.find((m) => m.clientId === clientId);
  if (!member) return false;
  if (!member.premiumMember) return false;

  // Verify membership validity date
  const expiry = new Date(member.membershipTill);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  return expiry >= today;
}

/**
 * Gets premium membership details for a client.
 */
export function getPremiumDetails(clientId: string | null | undefined): MemberConfig | null {
  if (!clientId) return null;
  return membersList.find((m) => m.clientId === clientId) || null;
}
