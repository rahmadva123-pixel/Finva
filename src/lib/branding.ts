export const BRAND_NAME = "Finva";

export function normalizeBrandText(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return BRAND_NAME;

  const oldBrandNames = ["WealthWise", "WealthWise Navigator", "Wealthwise", "Wealthwise Navigator"];
  return oldBrandNames.some((oldName) => text.toLowerCase() === oldName.toLowerCase()) ? BRAND_NAME : text;
}
