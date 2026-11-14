import { CROP_LIST } from "@/lib/rotation/crops";

const names = (list: { label: string }[]) => list.map((c) => c.label).join(", ");

/** Short explanations of how different crop types help the soil. */
export default function CropRoles() {
  const roles = [
    {
      title: "Nitrogen-fixing",
      crops: names(CROP_LIST.filter((c) => c.family === "legume")),
      text: "Take nitrogen from the air, so the next crop needs less fertilizer.",
    },
    {
      title: "Cover crops",
      crops: "e.g. vetch + rye",
      text: "Grown in empty months, not harvested. Hold the soil and add organic matter.",
    },
    {
      title: "Deep-rooting",
      crops: names(CROP_LIST.filter((c) => c.rootDepth === "deep")),
      text: "Break hard layers, let water soak in and reach deeper water.",
    },
    {
      title: "Drought-tolerant",
      crops: names(CROP_LIST.filter((c) => c.droughtTolerant)),
      text: "Cope better with dry spells, so dry years hurt less.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {roles.map((r) => (
        <div key={r.title} className="rounded-2xl bg-sand/60 p-4">
          <h3 className="font-medium">{r.title}</h3>
          <p className="text-xs text-olive">{r.crops}</p>
          <p className="mt-1 text-sm text-muted">{r.text}</p>
        </div>
      ))}
    </div>
  );
}
