import { Crops } from "./crops";
import { Cta } from "./cta";
import { Faq } from "./faq";
import { Features } from "./features";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { LandingShell } from "./landing-shell";
import { Personas } from "./personas";
import { Problem } from "./problem";
import { Spotlight } from "./spotlight";

export { LandingShell } from "./landing-shell";

export function LandingView() {
  return (
    <LandingShell>
      <Hero />
      <Crops />
      <Problem />
      <Features />
      <Personas />
      <HowItWorks />
      <Spotlight />
      <Faq />
      <Cta />
    </LandingShell>
  );
}
