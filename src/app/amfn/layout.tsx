import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "American Fusion Inc. — Document Portal",
  description: "Secure document portal for American Fusion Inc. deliverables.",
  robots: { index: false, follow: false },
};

export default function AmfnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0e1a] amfn-grid-bg">
      {/* Radial green glow from top */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(3,255,0,0.04) 0%, transparent 70%), " +
            "radial-gradient(ellipse 50% 30% at 50% 100%, rgba(3,52,87,0.3) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
