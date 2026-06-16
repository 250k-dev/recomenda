import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen flex-col bg-background"
      style={{
        backgroundImage:
          "radial-gradient(oklch(0.5 0.05 60 / 0.05) 0.5px, transparent 0.5px)",
        backgroundSize: "5px 5px",
      }}
    >
      {children}
    </div>
  );
}
