import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";

const MODULES = [
  {
    href: "/farm",
    n: "01",
    title: "Farm profile",
    text: "Name your farm, drop a pin on the map, add crops and priorities.",
    tag: "Start here",
    card: "bg-paper border border-line text-espresso",
    tagStyle: "bg-sage text-espresso",
    tall: false,
  },
  {
    href: "/environment",
    n: "02",
    title: "Climate",
    text: "Rain, frost, heat and soil moisture for your farm, from NASA data.",
    tag: "Satellite data",
    card: "bg-paper border border-line text-espresso",
    tagStyle: "bg-sand text-muted",
    tall: false,
  },
  {
    href: "/rotation",
    n: "03",
    title: "Rotation engine",
    text: "See which crop order fits your farm best, and why.",
    tag: "The main thing",
    card: "bg-sage text-espresso",
    tagStyle: "bg-accent text-paper",
    tall: true,
  },
  {
    href: "/soil",
    n: "04",
    title: "Soil",
    text: "Soil type, pH and irrigation, kept separate from satellite data.",
    tag: "You provide",
    card: "bg-paper border border-line text-espresso",
    tagStyle: "bg-sand text-muted",
    tall: false,
  },
  {
    href: "/report",
    n: "05",
    title: "Decision report",
    text: "One printable summary with sources and limitations.",
    tag: "Print to PDF",
    card: "bg-paper border border-line text-espresso",
    tagStyle: "bg-sand text-muted",
    tall: false,
  },
];

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Grow smarter. Rotate wiser."
        title={
          <>
            What should go in the ground{" "}
            <em className="text-accent">next?</em>
          </>
        }
        description="Find a crop order that protects your soil and saves water, using NASA climate data and what you know about your field."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {MODULES.map((m, i) => (
          <Link
            key={m.href}
            href={m.href}
            style={{ animationDelay: `${i * 80}ms` }}
            className={`rise group flex flex-col justify-between rounded-[28px] p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(46,50,41,0.08)] ${m.card} ${
              m.tall ? "min-h-80 md:row-span-2" : "min-h-52"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${m.tagStyle}`}
              >
                {m.tag}
              </span>
              <span className="text-2xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1">
                ↗
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium opacity-60">{m.n}</div>
              <h2 className="font-display text-3xl leading-tight">
                {m.title}
              </h2>
              <p className="mt-3 max-w-sm text-sm opacity-80">{m.text}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
