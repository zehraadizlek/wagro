/** Shared, quiet styling for Recharts charts (colours from the theme). */

export const AXIS_TICK = { fontSize: 12, fill: "#5d5a52" };

export const TOOLTIP_PROPS = {
  contentStyle: {
    background: "#fbfaf6",
    border: "1px solid #dcd5c8",
    borderRadius: 12,
    fontSize: 13,
    padding: "8px 12px",
  },
  labelStyle: { color: "#2e3229", fontWeight: 600, marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { fill: "rgba(95, 112, 82, 0.08)" },
} as const;

export const LEGEND_PROPS = {
  iconType: "circle" as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 13, paddingTop: 8 },
};

/** A short axis title written along a vertical axis. */
export function axisTitle(value: string, side: "left" | "right" = "left") {
  return {
    value,
    angle: side === "left" ? -90 : 90,
    position: side === "left" ? ("insideLeft" as const) : ("insideRight" as const),
    style: { fontSize: 12, fill: "#5d5a52", textAnchor: "middle" as const },
  };
}
