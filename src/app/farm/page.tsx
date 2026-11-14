"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import {
  CROPS,
  IRRIGATION,
  PRIORITIES,
  SOIL_TYPES,
  farmProfileSchema,
  type FarmProfile,
} from "@/lib/schemas/farm";
import { saveFarm } from "@/lib/storage/farm-storage";
import { useFarm } from "@/lib/storage/use-farm";

const LocationPicker = dynamic(
  () => import("@/components/map/LocationPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 w-full animate-pulse rounded-2xl bg-sand" />
    ),
  },
);

const input =
  "w-full rounded-xl border border-line bg-oat px-4 py-2.5 text-sm text-espresso outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20";

const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s));
const label = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors duration-200 ${
        active
          ? "border-accent bg-sage text-espresso"
          : "border-line bg-paper text-muted hover:border-accent hover:text-espresso"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-espresso">{title}</div>
      {children}
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}

function FarmForm({ initial }: { initial: FarmProfile | null }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [lat, setLat] = useState(initial ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial ? String(initial.longitude) : "");
  const [area, setArea] = useState(initial ? String(initial.areaHa) : "");
  const [currentCrop, setCurrentCrop] = useState<string>(
    initial?.currentCrop ?? "wheat",
  );
  const [previousCrops, setPreviousCrops] = useState<string[]>(
    initial?.previousCrops ?? [],
  );
  const [irrigation, setIrrigation] = useState<string>(
    initial?.irrigation ?? "none",
  );
  const [soilType, setSoilType] = useState<string>(
    initial?.soilType ?? "unknown",
  );
  const [soilPh, setSoilPh] = useState(
    initial && initial.soilPh !== null ? String(initial.soilPh) : "",
  );
  const [priorities, setPriorities] = useState<string[]>(
    initial?.priorities ?? [],
  );
  const [marketCrops, setMarketCrops] = useState<string[]>(
    initial?.marketCrops ?? [],
  );
  const [hasRowPlanter, setHasRowPlanter] = useState(
    initial?.hasRowPlanter ?? true,
  );
  const [coverCropsOk, setCoverCropsOk] = useState(
    initial?.coverCropsOk ?? true,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const latN = toNum(lat);
  const lngN = toNum(lng);
  const position: [number, number] | null =
    Number.isFinite(latN) && Number.isFinite(lngN) ? [latN, lngN] : null;

  const toggle = (list: string[], v: string, set: (l: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaveFailed(false);
    const result = farmProfileSchema.safeParse({
      name,
      latitude: latN,
      longitude: lngN,
      areaHa: toNum(area),
      currentCrop,
      previousCrops,
      irrigation,
      soilType,
      soilPh: soilPh.trim() === "" ? null : Number(soilPh),
      priorities,
      marketCrops,
      hasRowPlanter,
      coverCropsOk,
    });
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    if (saveFarm(result.data)) setSaved(true);
    else setSaveFailed(true);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
      <section className="rise space-y-5 rounded-[28px] border border-line bg-paper p-6">
        <Field title="Farm name" error={errors.name}>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. North field"
          />
        </Field>
        <Field title="Area (hectares)" error={errors.areaHa}>
          <input
            className={input}
            inputMode="decimal"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. 25"
          />
        </Field>
        <Field title="Current crop">
          <div className="flex flex-wrap gap-2">
            {CROPS.map((c) => (
              <Chip
                key={c}
                active={currentCrop === c}
                onClick={() => setCurrentCrop(c)}
              >
                {label(c)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field
          title="Previous crops (optional, up to 5, oldest first)"
          error={errors.previousCrops}
        >
          <div className="flex flex-wrap gap-2">
            {CROPS.map((c) => (
              <Chip
                key={c}
                active={previousCrops.includes(c)}
                onClick={() => toggle(previousCrops, c, setPreviousCrops)}
              >
                {label(c)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field title="Irrigation">
          <div className="flex flex-wrap gap-2">
            {IRRIGATION.map((c) => (
              <Chip
                key={c}
                active={irrigation === c}
                onClick={() => setIrrigation(c)}
              >
                {label(c)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field title="Soil type (entered by you)">
          <div className="flex flex-wrap gap-2">
            {SOIL_TYPES.map((c) => (
              <Chip
                key={c}
                active={soilType === c}
                onClick={() => setSoilType(c)}
              >
                {label(c)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field title="Soil pH (optional)" error={errors.soilPh}>
          <input
            className={input}
            inputMode="decimal"
            value={soilPh}
            onChange={(e) => setSoilPh(e.target.value)}
            placeholder="e.g. 6.8"
          />
        </Field>
        <Field title="What matters most to you">
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((c) => (
              <Chip
                key={c}
                active={priorities.includes(c)}
                onClick={() => toggle(priorities, c, setPriorities)}
              >
                {label(c)}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="space-y-5 border-t border-line pt-5">
          <p className="text-sm text-muted">
            Your limits. Wagro only suggests crops you can actually grow and
            sell.
          </p>
          <Field title="Crops you can sell nearby (leave empty if any)">
            <div className="flex flex-wrap gap-2">
              {CROPS.map((c) => (
                <Chip
                  key={c}
                  active={marketCrops.includes(c)}
                  onClick={() => toggle(marketCrops, c, setMarketCrops)}
                >
                  {label(c)}
                </Chip>
              ))}
            </div>
          </Field>
          <Field title="Do you have a row-crop planter? (needed for corn, sunflower, sorghum)">
            <div className="flex flex-wrap gap-2">
              <Chip active={hasRowPlanter} onClick={() => setHasRowPlanter(true)}>
                Yes
              </Chip>
              <Chip active={!hasRowPlanter} onClick={() => setHasRowPlanter(false)}>
                No
              </Chip>
            </div>
          </Field>
          <Field title="Cover crops (sown in empty months, not harvested)">
            <div className="flex flex-wrap gap-2">
              <Chip active={coverCropsOk} onClick={() => setCoverCropsOk(true)}>
                Open to it
              </Chip>
              <Chip active={!coverCropsOk} onClick={() => setCoverCropsOk(false)}>
                Not for me
              </Chip>
            </div>
          </Field>
        </div>
      </section>

      <section
        style={{ animationDelay: "100ms" }}
        className="rise space-y-5 rounded-[28px] border border-line bg-sage/50 p-6 md:self-start"
      >
        <Field title="Location: click the map to place your pin">
          <LocationPicker
            position={position}
            onPick={(a, b) => {
              setLat(a.toFixed(4));
              setLng(b.toFixed(4));
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field title="Latitude" error={errors.latitude}>
            <input
              className={input}
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </Field>
          <Field title="Longitude" error={errors.longitude}>
            <input
              className={input}
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </Field>
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full"
        >
          Save farm profile
        </button>
        {saved && (
          <p className="rounded-2xl border border-olive/30 bg-paper px-4 py-2 text-sm text-olive">
            Saved in this browser.
          </p>
        )}
        {saveFailed && (
          <p className="rounded-2xl border border-clay/40 bg-paper px-4 py-2 text-sm text-clay">
            Your browser blocked saving. Turn off private mode or allow site
            data, then try again.
          </p>
        )}
      </section>
    </form>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();

  return (
    <>
      <PageHeader
        eyebrow="Step 1"
        title={
          <>
            Your <em className="text-accent">farm</em>
          </>
        }
        description="Tell us about your farm and drop a pin on the map. Everything is saved in your browser only."
      />
      {ready ? (
        <FarmForm initial={farm} />
      ) : (
        <div className="h-96 animate-pulse rounded-[28px] bg-sand" />
      )}
    </>
  );
}
