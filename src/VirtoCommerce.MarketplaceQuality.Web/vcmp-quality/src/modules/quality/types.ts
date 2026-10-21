/**
 * The seller product as the host ProductDetails blade exposes it via defineBladeContext({ item }).
 * The quality blades receive it through blade options and hand it to the AI agent context, so the
 * assistant knows which product they are about — the same item the product details blade sends.
 */
export interface QualityProduct {
  id?: string;
  name?: string;
  objectType?: string;
  [key: string]: unknown;
}
