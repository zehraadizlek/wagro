import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";

const DATA = [
  ["NASA POWER", "Daily weather for 10 years: temperature, rain, humidity, wind, sun, soil wetness.", "about 50 km"],
  ["NASA MODIS", "Plant cover (NDVI) and ground temperature, monthly.", "about 1 km"],
  ["NASA SMAP", "Soil moisture in the root zone.", "about 9 km"],
  ["NASA GRACE / GRACE-FO", "Water stored underground and in soil, until 2022.", "about 300 km"],
  ["Elevation tiles", "Slope and low spots. NASA SRTM where available, other models elsewhere.", "about 30 m"],
  ["You", "Your field, crops, soil, irrigation, priorities and limits.", "your field"],
];

const STEPS = [
  "Turn 10 years of daily weather into a typical month: rain, water need (FAO-56 evapotranspiration), frost nights and hot days.",
  "Lay each rotation out month by month, using typical sowing and harvest dates.",
  "Score 8 things from 0 to 100 with simple rules: water, nitrogen, organic matter, pest break, erosion, climate fit, soil fit, income.",
  "Weigh the scores by what matters to you and add them up.",
  "Stress-test the result: warmer or drier scenarios, and dry, normal and wet years.",
];

const METHODS = [
  ["Rules and a water budget", "Used for the scores. Every number can be traced and explained."],
  ["Mann-Kendall test and Sen's slope", "Used for trends. Tells whether a rise or fall is real or could be chance."],
  ["k-means clustering", "Used to sort years into dry, normal and wet, and test each option in each."],
  ["Machine-learning yield models", "Not used. They need local yield records we do not have, and their answers are hard to explain."],
];

const UNCERTAIN = [
  "Weather and satellite data describe an area, not your exact field. Coarser data (GRACE, SMAP) speaks for the region.",
  "Crop values and calendars are first estimates. An agronomist should check them for your area.",
  "Ten years is short. Trends and year groups are a guide, not proof.",
  "Scores compare options with each other. They do not predict yield or profit. Treat options within 5 points as equal.",
];

const JUDGMENT = [
  "Sowing dates and varieties for your area",
  "Local pests, diseases and weeds",
  "Markets, prices and contracts",
  "Machinery, labour and time",
  "A soil test, and your field's own history",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6">
      <h2 className="font-display text-3xl">{title}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="How Wagro works"
        description="The data we use, how we turn it into advice, and where your judgment matters."
      />
      <div className="space-y-6">
        <Section title="The data">
          <ul className="divide-y divide-line">
            {DATA.map(([name, what, grid]) => (
              <li key={name} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <span>
                  <b className="font-medium">{name}</b>
                  <span className="text-muted"> · {what}</span>
                </span>
                <span className="text-muted">{grid}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-muted">
            Satellites and models see every place the same way and go back many
            years, but they average over an area. A weather station or soil
            probe is exact for one spot. Using both gives the best picture.
          </p>
        </Section>

        <Section title="Bringing the data together">
          <p className="text-muted">
            Each source has its own grid and time step. Wagro brings them to one
            place and one time step: values at your pin, daily weather summed
            into a typical month, and satellite maps read at your field. Coarse
            data describes your region; elevation describes your field.
          </p>
        </Section>

        <Section title="From data to advice">
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>

        <Section title="Methods we chose">
          <ul className="space-y-2">
            {METHODS.map(([name, why]) => (
              <li key={name}>
                <b className="font-medium">{name}.</b> <span className="text-muted">{why}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="How sure is it?">
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {UNCERTAIN.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>

        <Section title="Where your judgment matters">
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {JUDGMENT.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3">
            Wagro helps you think it through. You and a local adviser make the
            decision.
          </p>
        </Section>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/farm" className="btn btn-ghost w-full">
            My farm
          </Link>
          <Link href="/rotation" className="btn btn-primary w-full">
            See results
          </Link>
        </div>
      </div>
    </>
  );
}
