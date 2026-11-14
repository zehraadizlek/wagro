"use client";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { useFarm } from "@/lib/storage/use-farm";

const STEPS = [
  { n: "1", title: "Answer 4 short questions", text: "Where your field is, what you grow, your soil and what matters to you." },
  { n: "2", title: "We read NASA data", text: "10 years of rain, frost, heat and soil moisture for your field." },
  { n: "3", title: "See your best options", text: "Which crop order fits, why, and what to check locally." },
];

export default function Page() {
  const { farm, ready } = useFarm();

  return (
    <>
      <PageHeader
        eyebrow="Grow smarter. Rotate wiser."
        title={
          <>
            What should go in the ground <em className="text-accent">next?</em>
          </>
        }
        description="Find a crop order that protects your soil and saves water."
      />

      <div className="rise flex flex-wrap gap-3">
        <Link href="/farm" className="btn btn-primary">
          {farm ? "Change my answers" : "Start"}
        </Link>
        {ready && farm && (
          <Link href="/rotation" className="btn btn-ghost">
            See my results
          </Link>
        )}
      </div>

      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-[24px] border border-line bg-paper p-5">
            <div className="text-xs font-medium text-olive">Step {s.n}</div>
            <h2 className="mt-1 font-display text-2xl leading-tight">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
