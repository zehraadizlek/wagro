"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import {
  CROPS,
  IRRIGATION,
  PRIORITIES,
  SOIL_TYPES,
  farmProfileSchema,
} from "@/lib/schemas/farm";
import { loadFarm, saveFarm } from "@/lib/storage/farm-storage";

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
  "w-full rounded-xl border border-line bg-oat px-4 py-2.5 text-sm text-espresso outline-none transition placeholder:text-muted/60 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20";

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
          ? "border-espresso bg-espresso text-paper"
          : "border-line bg-paper text-muted hover:border-espresso hover:text-espresso"
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
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
    </div>
  );
}

export default function Page() {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [area, setArea] = useState("");
  const [currentCrop, setCurrentCrop] = useState<string>("wheat");
  const [previousCrops, setPreviousCrops] = useState<string[]>([]);
  const [irrigation, setIrrigation] = useState<string>("none");
  const [soilType, setSoilType] = useState<string>("unknown");
  const [soilPh, setSoilPh] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const f = loadFarm();
    if (!f) return;
    setName(f.name);
    setLat(String(f.latitude));
    setLng(String(f.longitude));
    setArea(String(f.areaHa));
    setCurrentCrop(f.currentCrop);
    setPreviousCrops(f.previousCrops);
    setIrrigation(f.irrigation);
    setSoilType(f.soilType);
    setSoilPh(f.soilPh === null ? "" : String(f.soilPh));
    setPriorities(f.priorities);
  }, []);

  const latN = toNum(lat);
  const lngN = toNum(lng);
  const position: [number, number] | null =
    Number.isFinite(latN) && Number.isFinite(lngN) ? [latN, lngN] : null;

  const toggle = (list: string[], v: string, set: (l: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
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
    saveFarm(result.data);
    setSaved(true);
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 1"
        title={
          <>
            Your <em className="text-terracotta">farm</em>
          </>
        }
        description="Tell us about your farm and drop a pin on the map. Everything is saved in your browser only."
      />
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
            title="Previous crops (optional, up to 5)"
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
          <Field title="Priorities">
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
            className="w-full rounded-full bg-terracotta px-6 py-3 text-base font-semibold text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-[0_10px_24px_rgba(184,72,31,0.3)] active:translate-y-0"
          >
            Save farm profile
          </button>
          {saved && (
            <p className="rounded-2xl border border-olive/30 bg-paper px-4 py-2 text-sm text-olive">
              Saved in this browser.
            </p>
          )}
        </section>
      </form>
    </>
  );
}