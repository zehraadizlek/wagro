const TERMS: { term: string; text: string }[] = [
  {
    term: "Evapotranspiration (ET0)",
    text: "The water that leaves the field as vapour, from the soil and through plant leaves. ET0 is the reference value for a well-watered grass cover, calculated from temperature, humidity, wind and sunshine with the FAO-56 Penman-Monteith method. Real crops use more or less than ET0 depending on their stage.",
  },
  {
    term: "Water balance and aridity",
    text: "Rain minus ET0. A negative month means the air can take more water than falls, so crops draw on stored soil water or irrigation. The aridity index is yearly rain divided by yearly ET0: below 0.2 is arid, 0.2 to 0.5 semi-arid, 0.5 to 0.65 dry sub-humid, above that humid.",
  },
  {
    term: "Soil wetness and anomalies",
    text: "NASA POWER reports soil wetness from 0 (dry) to 1 (saturated) for the surface and the root zone. It comes from the MERRA-2 model, which blends satellite and ground observations; it is not a measurement in your field. An anomaly compares the latest 30 days with the same days in earlier years.",
  },
  {
    term: "Frost risk and frost dates",
    text: "A frost day here is a day whose minimum air temperature is below 0 °C. Ground frost can come on nights when the air at 2 m stays slightly above zero. The last spring frost and first autumn frost bracket the safe season for frost-sensitive crops.",
  },
  {
    term: "Heat stress",
    text: "Very hot days during flowering and grain fill can reduce pollination and grain weight. Wagro counts days whose maximum reaches a crop-specific threshold in the months before harvest.",
  },
  {
    term: "Heavy rain and bare soil",
    text: "Days with 20 mm of rain or more can wash away uncovered topsoil and nutrients. Months when the field has no crop and rain is high are when cover crops or residues help most.",
  },
  {
    term: "Satellite versus ground data",
    text: "Satellites and models cover every place in the same way and have long records, but they describe a grid cell tens of kilometres wide. A weather station or soil probe is exact for one point. Combining both, and checking against what farmers see, gives the most reliable picture.",
  },
];

export default function Glossary() {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">Words used on this page</h2>
      <div className="mt-3 divide-y divide-line">
        {TERMS.map((t) => (
          <details key={t.term} className="group py-3">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="mr-2 inline-block text-terracotta transition-transform group-open:rotate-90">
                ›
              </span>
              {t.term}
            </summary>
            <p className="mt-2 pl-5 text-sm text-muted">{t.text}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
