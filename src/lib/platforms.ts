// Single source of truth for platforms across the app.
// Add a new platform here and it appears in accounts, pixels, models and filters.

export type PlatformDef = {
  name: string;
  icon: string;
  /** shown in the account platform dropdown / filters */
  account?: boolean;
  /** shown as a grouped section inside pixel profiles */
  pixelGroup?: boolean;
  /** shown in the model platform selector */
  model?: boolean;
};

export const PLATFORMS: PlatformDef[] = [
  { name: "Instagram", icon: "📸", account: true, pixelGroup: true, model: true },
  { name: "Threads",   icon: "🧵", account: true, pixelGroup: true, model: true },
  { name: "X",         icon: "𝕏",  account: true, pixelGroup: true, model: true },
  { name: "Facebook",  icon: "📘", account: true, pixelGroup: true },
  { name: "Reddit",    icon: "👽", account: true, model: true },
  { name: "Fansly",    icon: "💙", account: true, model: true },
  { name: "OnlyFans",  icon: "🔵", account: true, model: true },
  { name: "TikTok",    icon: "🎵" },
  { name: "AI",        icon: "🤖", model: true },
  { name: "Other",     icon: "🌐", model: true },
];

export const PLATFORM_ICONS: Record<string, string> =
  Object.fromEntries(PLATFORMS.map((p) => [p.name, p.icon]));

export function platformIcon(name: string | null | undefined) {
  return (name && PLATFORM_ICONS[name]) || "🌐";
}

export const ACCOUNT_PLATFORMS = PLATFORMS.filter((p) => p.account).map((p) => p.name);
export const PIXEL_GROUP_PLATFORMS = PLATFORMS.filter((p) => p.pixelGroup).map((p) => p.name);
export const MODEL_PLATFORMS = PLATFORMS.filter((p) => p.model).map((p) => p.name);
