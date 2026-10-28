export const SELLER_PRODUCT_ENTITY_TYPE = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct";
export const OFFER_ENTITY_TYPE = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.Offer";

/**
 * A vendor-portal entity the quality widget is shown for. Quality targets and evaluations are stored
 * under its entity type, the same type the platform admin picks for a quality target.
 */
export interface QualityEntityConfig {
  entityType: string;
  /** Host vendor-portal details blade the widget is added to; it exposes the entity via defineBladeContext({ item }). */
  hostBlade: string;
  widgetId: string;
  /** Keeps table sort and paging of the targets blade separate per entity type. */
  stateKey: string;
  /** AI expert that scores the entity. Without one, targets and stored evaluations are shown, but scoring is not offered. */
  agentId?: string;
  scoringPrompt?: string;
}

export const QUALITY_ENTITIES: QualityEntityConfig[] = [
  {
    entityType: SELLER_PRODUCT_ENTITY_TYPE,
    hostBlade: "ProductDetails",
    widgetId: "QualityWidget",
    stateKey: "product_quality_targets",
    agentId: "seller-product-quality-expert",
    scoringPrompt: "Evaluate this product against all seller product quality targets.",
  },
  {
    entityType: OFFER_ENTITY_TYPE,
    hostBlade: "Offer",
    widgetId: "OfferQualityWidget",
    stateKey: "offer_quality_targets",
    agentId: "offer-quality-expert",
    scoringPrompt: "Evaluate this offer against all offer quality targets.",
  },
];

export function getQualityEntity(entityType?: string): QualityEntityConfig | undefined {
  return QUALITY_ENTITIES.find((entity) => entity.entityType === entityType);
}
