import { logger } from '../utils/logger';

export interface OCapConsentPolicy {
  communityId: string;
  ownershipClaimed: boolean;
  allowThirdPartySharing: boolean;
  accessTier: 'community_only' | 'regional_agronomy' | 'anonymized_research';
  possessionMode: 'local_on_prem' | 'encrypted_cloud_canada';
  purposeScopes: string[];
}

export class OCapConsentService {
  /**
   * Enforces OCAP (Ownership, Control, Access, Possession) data tagging
   * before persisting or processing Indigenous agricultural telemetry.
   */
  public static enforceOCapPolicy(
    data: Record<string, unknown>,
    policy: OCapConsentPolicy
  ): Record<string, unknown> {
    logger.info(`Enforcing OCAP® Data Sovereignty Policy for Community: ${policy.communityId}`);

    // Inject OCAP Metadata Stamp into telemetry record
    const ocapMetadata = {
      _ocap_stamped: true,
      _community_id: policy.communityId,
      _ownership: policy.ownershipClaimed ? 'First Nations Owned' : 'Standard Tenant',
      _access_tier: policy.accessTier,
      _possession: policy.possessionMode,
      _stamped_at: new Date().toISOString(),
    };

    // Filter out third-party telemetry if consent is restricted
    if (!policy.allowThirdPartySharing) {
      delete data.third_party_analytics;
      delete data.commercial_marketplace_sync;
    }

    return {
      ...data,
      _ocap: ocapMetadata,
    };
  }

  /**
   * Audit check for OCAP compliance on outgoing data export
   */
  public static validateAccessRight(
    policy: OCapConsentPolicy,
    requestedScope: string
  ): boolean {
    if (policy.accessTier === 'community_only' && requestedScope !== 'community_internal') {
      logger.warn(`OCAP Access Denied: Scope ${requestedScope} violates community_only policy.`);
      return false;
    }
    return policy.purposeScopes.includes(requestedScope);
  }
}
