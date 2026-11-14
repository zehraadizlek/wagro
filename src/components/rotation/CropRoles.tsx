import { CROP_LIST } from "@/lib/rotation/crops";

const names = (list: { label: string }[]) => list.map((c) => c.label).join(", ");

/** Short explanations of how different crop types help the soil. */
export default function CropRoles() {
  const roles = [
    {
      title: "Nitrogen-fixing crops",
      crops: names(CROP_LIST.filter((c) => c.family === "legume")),
      text: "Legumes host bacteria in their roots that take nitrogen from the air. The next crop needs less fertilizer.",
    },
    {
      title: "Cover crops",
      crops: "For example a vetch and rye mix",
      text: "Sown in months when the field would be empty, and not harvested. Their roots hold the soil against rain and wind and add organic matter.",
    },
    {
      title: "Deep-rooting crops",
      crops: names(CROP_LIST.filter((c) => c.rootDepth === "deep")),
      text: "Long roots break up hard layers below the plough depth, let water soak in, and reach water stored deeper in the soil.",
    },
    {
      title: "Drought-tolerant crops",
      crops: names(CROP_LIST.filter((c) => c.droughtTolerant)),
      text: "They cope better with dry spells, so they lower the risk in dry years and leave more water in the soil for the next crop.",
    },
  ];

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">How crops help your soil</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <div key={r.title} className="rounded-2xl bg-sand/60 p-4">
            <h3 className="font-medium">{r.title}</h3>
            <p className="text-xs text-olive">{r.crops}</p>
            <p className="mt-2 text-sm text-muted">{r.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Which crops belong to which group is a general guide. Varieties and
        local conditions change this.
      </p>
    </section>
  );
}
