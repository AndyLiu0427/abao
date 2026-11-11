import type { Metadata } from "next";
import FamilyClient from "./FamilyClient";

// The member's identity rides in the manifest start URL, so "Add to Home Screen" from this page
// installs an app that opens on their own alerts.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ f?: string; m?: string }> }): Promise<Metadata> {
  const { f, m } = await searchParams;
  return f && m ? { manifest: `/api/manifest?f=${encodeURIComponent(f)}&m=${encodeURIComponent(m)}` } : {};
}

export default function Page() {
  return <FamilyClient />;
}
