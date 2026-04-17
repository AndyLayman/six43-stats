interface TeamLogoBadgeProps {
  logoSvg: string | null | undefined;
  colorBg: string | null | undefined;
  colorFg: string | null | undefined;
  fallback: string;
  /** Outer badge size, Tailwind square classes e.g. "w-6 h-6" */
  sizeClass?: string;
  /** Inner logo size, Tailwind square classes e.g. "w-4 h-4" */
  innerSizeClass?: string;
  /** Tailwind text size for the fallback initial, e.g. "text-xs" */
  fallbackTextClass?: string;
  className?: string;
}

export function TeamLogoBadge({
  logoSvg,
  colorBg,
  colorFg,
  fallback,
  sizeClass = "w-6 h-6",
  innerSizeClass = "w-4 h-4",
  fallbackTextClass = "text-xs",
  className = "",
}: TeamLogoBadgeProps) {
  const initial = fallback?.[0]?.toUpperCase() || "?";
  return (
    <div
      className={`${sizeClass} rounded-md flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ backgroundColor: colorBg || "#1a1a1a" }}
    >
      {logoSvg ? (
        <div
          className={`${innerSizeClass} [&>svg]:w-full [&>svg]:h-full`}
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
      ) : (
        <span className={`${fallbackTextClass} font-bold`} style={{ color: colorFg || "#ffffff" }}>
          {initial}
        </span>
      )}
    </div>
  );
}
