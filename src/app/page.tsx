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
    tagStyle: "bg-terracotta text-paper",
    tall: false,
  },
  {
    href: "/environment",
    n: "02",
    title: "Climate",
    text: "Temperature and rainfall history from NASA POWER.",
    tag: "NASA POWER",
    card: "bg-sage text-espresso",
    tagStyle: "bg-espresso text-paper",
    tall: false,
  },
  {
    href: "/rotation",
    n: "03",
    title: "Rotation engine",
    text: "Compare your current rotation with legume-supported and diversified strategies, with every score explained.",
    tag: "The main thing",
    card: "bg-espresso text-paper",
    tagStyle: "bg-terracotta text-paper",
    tall: true,
  },
  {
    href: "/soil",
    n: "04",
    title: "Soil",
    text: "Soil type, pH and irrigation, kept separate from satellite data.",
    tag: "You provide",
    card: "bg-sand text-espresso",
    tagStyle: "bg-espresso text-paper",
    tall: false,
  },
  {
    href: "/report",
    n: "05",
    title: "Decision report",
    text: "One printable summary with sources and limitations.",
    tag: "Print to PDF",
    card: "bg-terracotta text-paper",
    tagStyle: "bg-paper text-terracotta",
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
            <em className="text-terracotta">next?</em>
          </>
        }
        description="Compare crop rotation strategies using NASA climate data, your soil, and transparent scoring."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {MODULES.map((m, i) => (
          <Link
            key={m.href}
            href={m.href}
            style={{ animationDelay: `${i * 80}ms` }}
            className={`rise group flex flex-col justify-between rounded-[28px] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(43,29,20,0.18)] ${m.card} ${
              m.tall ? "min-h-80 md:row-span-2" : "min-h-52"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${m.tagStyle}`}
              >
                {m.tag}
              </span>
              <span className="text-2xl transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                ↗
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium opacity-60">{m.n}</div>
              <h2 className="font-display text-5xl leading-none tracking-tight">
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