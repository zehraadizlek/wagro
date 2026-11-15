import { METHOD_TEXT, type MethodLabel } from "@/lib/ml/model-cards";

const DOT: Record<MethodLabel, string> = {
  "rule-based": "#8b7355",
  statistics: "#7d8f69",
  "ml-unsupervised": "#5f7052",
  "ml-trained": "#3f4a3a",
  optimization: "#b9a77f",
};

const TITLE: Record<MethodLabel, string> = {
  "rule-based": "Simple, open rules and prototype crop values (not agronomist-validated)",
  statistics: "Averages, trends and anomalies computed from the data",
  "ml-unsupervised": "A model that learned what is normal here from 30 years of NASA data, without labels",
  "ml-trained": "A model trained on labelled examples",
  optimization: "A search over every option, scored with the same rules",
};

/** Small, quiet label that says how a result was produced. */
export default function MethodBadge({ method }: { method: MethodLabel }) {
  return (
    <span
      title={TITLE[method]}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-muted"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[method] }} />
      {METHOD_TEXT[method]}
    </span>
  );
}
