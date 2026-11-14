"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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

const STEPS = [
  { title: "Where is your field?", fields: ["name", "areaHa", "latitude", "longitude"] },
  { title: "What do you grow?", fields: ["currentCrop", "previousCrops"] },
  { title: "Your soil and water", fields: ["soilType", "soilPh", "irrigation"] },
  { title: "What matters to you", fields: ["priorities", "marketCrops"] },
] as const;

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
  hint,
  error,
  children,
}: {
  title: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-espresso">{title}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(o)}>
          {label(o)}
        </Chip>
      ))}
    </div>
  );
}

function Multi<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o}
          active={value.includes(o)}
          onClick={() =>
            onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
          }
        >
          {label(o)}
        </Chip>
      ))}
    </div>
  );
}

type Crop = FarmProfile["currentCrop"];

function Wizard({ initial }: { initial: FarmProfile | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [lat, setLat] = useState(initial ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial ? String(initial.longitude) : "");
  const [area, setArea] = useState(initial ? String(initial.areaHa) : "");
  const [currentCrop, setCurrentCrop] = useState<Crop>(initial?.currentCrop ?? "wheat");
  const [previousCrops, setPreviousCrops] = useState<Crop[]>(initial?.previousCrops ?? []);
  const [soilType, setSoilType] = useState<FarmProfile["soilType"]>(initial?.soilType ?? "unknown");
  const [soilPh, setSoilPh] = useState(
    initial && initial.soilPh !== null ? String(initial.soilPh) : "",
  );
  const [irrigation, setIrrigation] = useState<FarmProfile["irrigation"]>(
    initial?.irrigation ?? "none",
  );
  const [priorities, setPriorities] = useState<FarmProfile["priorities"]>(
    initial?.priorities ?? [],
  );
  const [marketCrops, setMarketCrops] = useState<Crop[]>(initial?.marketCrops ?? []);
  const [hasRowPlanter, setHasRowPlanter] = useState(initial?.hasRowPlanter ?? true);
  const [coverCropsOk, setCoverCropsOk] = useState(initial?.coverCropsOk ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveFailed, setSaveFailed] = useState(false);

  const latN = toNum(lat);
  const lngN = toNum(lng);
  const position: [number, number] | null =
    Number.isFinite(latN) && Number.isFinite(lngN) ? [latN, lngN] : null;

  function validate() {
    return farmProfileSchema.safeParse({
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
  }

  /** Errors for the fields on the given step only. */
  function stepErrors(i: number): Record<string, string> {
    const result = validate();
    if (result.success) return {};
    const fields: readonly string[] = STEPS[i].fields;
    const out: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (fields.includes(key) && !out[key]) out[key] = issue.message;
    }
    return out;
  }

  function next() {
    const errs = stepErrors(step);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const result = validate();
    if (!result.success) return;
    if (saveFarm(result.data)) router.push("/rotation");
    else setSaveFailed(true);
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="rise mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step].title}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-sand"}`}
            />
          ))}
        </div>
      </div>

      <section className="space-y-6 rounded-[28px] border border-line bg-paper p-6">
        <h2 className="font-display text-3xl">{STEPS[step].title}</h2>

        {step === 0 && (
          <>
            <Field title="Click the map to place your field" error={errors.latitude ?? errors.longitude}>
              <LocationPicker
                position={position}
                onPick={(a, b) => {
                  setLat(a.toFixed(4));
                  setLng(b.toFixed(4));
                }}
              />
              {position && (
                <p className="mt-2 text-xs text-muted">
                  {position[0].toFixed(3)}, {position[1].toFixed(3)}
                </p>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Field name" error={errors.name}>
                <input
                  className={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. North field"
                />
              </Field>
              <Field title="Size (hectares)" error={errors.areaHa}>
                <input
                  className={input}
                  inputMode="decimal"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. 25"
                />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field title="This season">
              <Choice options={CROPS} value={currentCrop} onChange={setCurrentCrop} />
            </Field>
            <Field
              title="The last seasons (optional)"
              hint="Pick up to 5, oldest first."
              error={errors.previousCrops}
            >
              <Multi options={CROPS} value={previousCrops} onChange={setPreviousCrops} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field title="Soil type">
              <Choice options={SOIL_TYPES} value={soilType} onChange={setSoilType} />
            </Field>
            <Field title="Soil pH (optional)" hint="From a soil test, if you have one." error={errors.soilPh}>
              <input
                className={`${input} max-w-40`}
                inputMode="decimal"
                value={soilPh}
                onChange={(e) => setSoilPh(e.target.value)}
                placeholder="e.g. 6.8"
              />
            </Field>
            <Field title="Irrigation">
              <Choice options={IRRIGATION} value={irrigation} onChange={setIrrigation} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field title="What matters most?" hint="Pick any. Leave empty to weigh all equally.">
              <Multi options={PRIORITIES} value={priorities} onChange={setPriorities} />
            </Field>
            <Field title="Crops you can sell" hint="Leave empty if you can sell any.">
              <Multi options={CROPS} value={marketCrops} onChange={setMarketCrops} />
            </Field>
            <Field title="Do you have a row-crop planter?" hint="Needed for corn, sunflower and sorghum.">
              <div className="flex gap-2">
                <Chip active={hasRowPlanter} onClick={() => setHasRowPlanter(true)}>Yes</Chip>
                <Chip active={!hasRowPlanter} onClick={() => setHasRowPlanter(false)}>No</Chip>
              </div>
            </Field>
            <Field title="Would you try cover crops?" hint="Sown in empty months to protect the soil, not harvested.">
              <div className="flex gap-2">
                <Chip active={coverCropsOk} onClick={() => setCoverCropsOk(true)}>Yes</Chip>
                <Chip active={!coverCropsOk} onClick={() => setCoverCropsOk(false)}>No</Chip>
              </div>
            </Field>
          </>
        )}

        {saveFailed && (
          <p className="rounded-2xl border border-clay/40 bg-paper px-4 py-2 text-sm text-clay">
            Your browser blocked saving. Turn off private mode, then try again.
          </p>
        )}
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setErrors({});
            setStep(step - 1);
          }}
          disabled={step === 0}
          className="btn btn-ghost w-full disabled:invisible"
        >
          Back
        </button>
        <button type="button" onClick={next} className="btn btn-primary w-full">
          {last ? "See results" : "Next"}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Your answers stay in this browser.
      </p>
    </div>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();

  return (
    <>
      <PageHeader
        eyebrow="Your farm"
        title="Tell us about your field"
        description="Four short steps. Then we show which crop order fits your field best."
      />
      {ready ? (
        <Wizard initial={farm} />
      ) : (
        <div className="mx-auto h-96 max-w-2xl animate-pulse rounded-[28px] bg-sand" />
      )}
    </>
  );
}
