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

// Rendering an uploaded SVG via dangerouslySetInnerHTML leaks any <style>
// rules inside it into the host document, which can break unrelated layout
// (e.g. the bottom nav's fixed positioning). Serve the SVG as an <img>
// data URL so it's isolated in its own image document.
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
  const src = logoSvg && logoSvg.trim() ? svgToDataUrl(logoSvg) : null;
  return (
    <div
      className={`${sizeClass} rounded-md flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ backgroundColor: colorBg || "#1a1a1a" }}
    >
      {src ? (
        <img src={src} alt="" className={`${innerSizeClass} object-contain`} />
      ) : (
        <span className={`${fallbackTextClass} font-bold`} style={{ color: colorFg || "#ffffff" }}>
          {initial}
        </span>
      )}
    </div>
  );
}
