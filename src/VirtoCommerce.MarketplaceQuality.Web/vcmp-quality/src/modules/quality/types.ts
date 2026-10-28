/**
 * The entity as the host details blade exposes it via defineBladeContext({ item }) — a seller product
 * or an offer. The quality blades receive it through blade options and hand it to the AI agent
 * context, so the assistant knows which entity they are about — the same item the host blade sends.
 */
export interface QualityItem {
  id?: string;
  name?: string;
  objectType?: string;
  [key: string]: unknown;
}

/** Options the quality blades pass along: the entity being evaluated and its quality entity type. */
export interface QualityBladeOptions {
  entityType?: string;
  entityId?: string;
  entityName?: string;
  item?: QualityItem;
}
