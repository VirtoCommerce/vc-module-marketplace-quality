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
  /** Host vendor-portal list blade the bulk "Run scoring" button is added to; it exposes the checked rows via defineBladeContext({ selectedItems }). */
  listBlade?: string;
  widgetId: string;
  /** Keeps table sort and paging of the targets blade separate per entity type. */
  stateKey: string;
  /**
   * The platform has an AI expert that scores the entity (see ModuleConstants.QualityScoring.Agents).
   * Without one, targets and stored evaluations are shown, but scoring is not offered.
   */
  scorable?: boolean;
}

export const QUALITY_ENTITIES: QualityEntityConfig[] = [
  {
    entityType: SELLER_PRODUCT_ENTITY_TYPE,
    hostBlade: "ProductDetails",
    listBlade: "Products",
    widgetId: "QualityWidget",
    stateKey: "product_quality_targets",
    scorable: true,
  },
  {
    entityType: OFFER_ENTITY_TYPE,
    hostBlade: "Offer",
    listBlade: "Offers",
    widgetId: "OfferQualityWidget",
    stateKey: "offer_quality_targets",
    scorable: true,
  },
];

export function getQualityEntity(entityType?: string): QualityEntityConfig | undefined {
  return QUALITY_ENTITIES.find((entity) => entity.entityType === entityType);
}
