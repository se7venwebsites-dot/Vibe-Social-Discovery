/**
 * Font utility to handle font loading with fallbacks
 * Ensures text is readable even if custom fonts fail to load
 */

type FontWeight = "bold" | "600" | "500" | "400";

const FONT_FAMILY_MAP: Record<string, Record<FontWeight, string>> = {
  // Primary: Montserrat from Google Fonts
  montserrat: {
    bold: "Montserrat_700Bold",
    "600": "Montserrat_600SemiBold",
    "500": "Montserrat_500Medium",
    "400": "Montserrat_400Regular",
  },
  // Fallback: System fonts
  system: {
    bold: "system-ui",
    "600": "system-ui",
    "500": "system-ui",
    "400": "system-ui",
  },
};

/**
 * Get font family name with fallback
 * @param variant - Font variant like "Montserrat_700Bold"
 * @returns Font family string
 */
export function getFontFamily(variant: string): string {
  // Try to extract weight from variant name
  if (variant.includes("700Bold") || variant.includes("_700Bold")) {
    return `${FONT_FAMILY_MAP.montserrat.bold}, system-ui`;
  }
  if (variant.includes("600SemiBold") || variant.includes("_600SemiBold")) {
    return `${FONT_FAMILY_MAP.montserrat["600"]}, system-ui`;
  }
  if (variant.includes("500Medium") || variant.includes("_500Medium")) {
    return `${FONT_FAMILY_MAP.montserrat["500"]}, system-ui`;
  }
  if (variant.includes("400Regular") || variant.includes("_400Regular")) {
    return `${FONT_FAMILY_MAP.montserrat["400"]}, system-ui`;
  }

  // Default fallback
  return variant;
}

// Direct font family constants
export const fonts = {
  bold: "Montserrat_700Bold",
  semiBold: "Montserrat_600SemiBold",
  medium: "Montserrat_500Medium",
  regular: "Montserrat_400Regular",
};

// Alternative: For use when style needs explicit fallback support
export const fontsFallback = {
  bold: "Montserrat_700Bold",
  semiBold: "Montserrat_600SemiBold",
  medium: "Montserrat_500Medium",
  regular: "Montserrat_400Regular",
};
