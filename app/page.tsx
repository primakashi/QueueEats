import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { LandingInteractions } from "./landing-interactions";
import "./landing.css";

export const metadata: Metadata = {
  title: "Solusi Saji — Jalankan Restoran Lebih Rapi",
  description: "Sistem operasional, analitik, dan Saji AI untuk bisnis F&B.",
};

const landingMarkup = fs.readFileSync(
  path.join(process.cwd(), "app", "landing-content.html"),
  "utf8",
);

export default function LandingPage() {
  return (
    <>
      <div
        id="solusisaji-landing"
        dangerouslySetInnerHTML={{ __html: landingMarkup }}
      />
      <LandingInteractions />
    </>
  );
}
