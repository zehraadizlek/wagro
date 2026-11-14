"use client";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { useFarm } from "@/lib/storage/use-farm";

const label = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

function phClass(ph: number): string {
  if (ph < 5.5) return "Strongly to moderately acidic";
  if (ph < 6.5) return "Slightly acidic";
  if (ph <= 7.5) return "Near neutral";
  if (ph <= 8.5) return "Slightly to moderately alkaline";
  return "Strongly alkaline";
}

const SOIL_NOTES: Record<string, string> = {
  sandy:
    "Drains quickly and holds less water and nutrients. Water supply timing usually matters more.",
  loamy: "A balanced mix that generally holds water and nutrients well.",
  clay: "Holds water and nutrients well but can drain slowly and compact.",
  silty: "Holds moisture well and is easy to work, but can crust or erode.",
  unknown:
    "Soil type not set. Scores that depend on soil will be less certain.",
};

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${tone}`}
    >
      {children}
    </span>
  );
}

function Row({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-sm text-muted">{title}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();

  return (
    <>
      <PageHeader
        eyebrow="Soil profile"
        title={
          <>
            Your <em className="text-terracotta">soil</em>
          </>
        }
        description="What you told us about your soil, kept clearly apart from anything measured from space."
      />

      {ready && !farm && (
        <div className="rounded-[28px] border border-line bg-paper p-8">
          <p className="text-lg">
            Save your farm profile first so we have soil details to show.
          </p>
          <Link
            href="/farm"
            className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-paper hover:bg-terracotta-dark"
          >
            Go to Farm profile
          </Link>
        </div>
      )}

      {farm && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rise rounded-[28px] border border-line bg-paper p-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-4xl">Entered by you</h2>
              <Badge tone="bg-espresso text-paper">User input</Badge>
            </div>
            <Row title="Soil type" value={label(farm.soilType)} />
            <Row
              title="Soil pH"
              value={farm.soilPh === null ? "Not provided" : String(farm.soilPh)}
            />
            <Row title="Irrigation" value={label(farm.irrigation)} />
            <Row title="Farm" value={`${farm.name}, ${farm.areaHa} ha`} />

            <div className="mt-5 rounded-2xl bg-sand/60 p-4 text-sm text-muted">
              <div className="mb-1 font-medium text-espresso">
                What this means in general
              </div>
              <p>{SOIL_NOTES[farm.soilType]}</p>
              {farm.soilPh !== null && (
                <p className="mt-2">
                  pH {farm.soilPh}: {phClass(farm.soilPh)}. This is a general
                  classification, not a fertilizer or lime recommendation.
                </p>
              )}
            </div>

            <Link
              href="/farm"
              className="mt-5 inline-block rounded-full border border-espresso px-5 py-2 text-sm font-medium hover:bg-espresso hover:text-paper"
            >
              Edit in Farm profile
            </Link>
          </section>

          <section
            style={{ animationDelay: "100ms" }}
            className="rise rounded-[28px] border border-line bg-sage/50 p-7"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-4xl">From satellites</h2>
              <Badge tone="bg-terracotta text-paper">Not connected yet</Badge>
            </div>
            <p className="mb-5 text-sm text-muted">
              No soil measurements are shown here yet, and none are invented.
              These sources may be added later:
            </p>

            <div className="space-y-4 text-sm">
              <div className="rounded-2xl bg-paper p-4">
                <div className="font-medium">SMAP soil moisture</div>
                <p className="mt-1 text-muted">
                  Satellite soil moisture on a coarse grid (tens of kilometres
                  per cell). It describes a wide region and cannot be read as a
                  measurement of your own field.
                </p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <div className="font-medium">SoilGrids (ISRIC)</div>
                <p className="mt-1 text-muted">
                  A global soil property map made by ISRIC, a separate
                  organisation. It is modelled data, not a field measurement,
                  and would be labelled as such.
                </p>
              </div>
            </div>
          </section>

          <section className="rise rounded-[28px] border border-line bg-sand/60 p-6 text-sm text-muted md:col-span-2">
            <h3 className="mb-2 font-medium text-espresso">Limitations</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Soil values on this page are only as accurate as what you
                entered. A lab soil test is more reliable.
              </li>
              <li>
                Wagro does not give fertilizer or liming prescriptions and does
                not replace advice from an agronomist.
              </li>
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
