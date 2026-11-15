"use client";

import Link from "next/link";
import { useFarm } from "@/lib/storage/use-farm";

const GRAINS = [0, 1, 2, 3, 4];

/** One wheat stalk that sways gently. Decorative only. */
function WheatStalk() {
  return (
    <svg
      viewBox="0 0 60 130"
      className="sway mx-auto h-28 w-auto md:h-32"
      aria-hidden="true"
      focusable="false"
    >
      {/* stem and leaf */}
      <path d="M30 128 C30 100 31 70 30 44" stroke="var(--color-olive)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M30 96 C22 90 15 82 12 72 C20 76 27 84 30 92" fill="var(--color-olive)" opacity="0.85" />
      {/* ear */}
      <ellipse cx="30" cy="14" rx="3.6" ry="6" fill="var(--color-mocha)" />
      <path d="M30 8 L30 0" stroke="var(--color-mocha)" strokeWidth="1" strokeLinecap="round" />
      {GRAINS.map((i) => {
        const y = 22 + i * 6.5;
        return (
          <g key={i}>
            <ellipse cx="25.5" cy={y} rx="3.6" ry="6" fill="var(--color-mocha)" transform={`rotate(-28 25.5 ${y})`} />
            <ellipse cx="34.5" cy={y} rx="3.6" ry="6" fill="var(--color-mocha)" transform={`rotate(28 34.5 ${y})`} />
            <path d={`M23 ${y - 5} L15 ${y - 15}`} stroke="var(--color-mocha)" strokeWidth="0.9" strokeLinecap="round" />
            <path d={`M37 ${y - 5} L45 ${y - 15}`} stroke="var(--color-mocha)" strokeWidth="0.9" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

export default function Page() {
  const { farm, ready } = useFarm();

  return (
    <section className="rise mx-auto flex min-h-[calc(100vh-15rem)] max-w-2xl flex-col items-center justify-center text-center">
      <WheatStalk />
      <h1 className="mt-6 font-display text-4xl leading-tight text-espresso md:text-6xl">
        What should go in the ground <em className="text-accent">next?</em>
      </h1>
      <p className="mt-4 max-w-lg text-lg text-muted">
        Find a crop order that protects your soil and saves water, using NASA
        climate and satellite data.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/farm" className="btn btn-primary">
          {farm ? "Change my answers" : "Start"}
        </Link>
        {ready && farm && (
          <Link href="/rotation" className="btn btn-ghost">
            See my results
          </Link>
        )}
      </div>

      <p className="mt-6 max-w-md text-xs text-muted">
        Weather data covers the area around your field (a grid of about 50 km),
        not measurements in the field.
      </p>
    </section>
  );
}
