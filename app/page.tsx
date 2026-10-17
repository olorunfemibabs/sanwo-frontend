import { Calculator } from "@/components/marketing/Calculator";
import { Depositors } from "@/components/marketing/Depositors";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/Hero";
import { Platform } from "@/components/marketing/Platform";
import { ProductTour } from "@/components/marketing/ProductTour";
import { Proof } from "@/components/marketing/Proof";
import { Protection } from "@/components/marketing/Protection";
import { Roadmap } from "@/components/marketing/Roadmap";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteNav } from "@/components/marketing/SiteNav";
import { ThemedPage } from "@/components/marketing/ThemedPage";

/**
 * Section order and themes: dark hero and product tour, beige features,
 * neutral detail sections, then dark proof, protection and close.
 */
export default function Home() {
  return (
    <ThemedPage>
      <SiteNav />
      <main>
        <Hero />
        <ProductTour />
        <Platform />
        <Calculator />
        <Depositors />
        <Protection />
        <Proof />
        <Roadmap />
        <Faq />
        <SiteFooter />
      </main>
    </ThemedPage>
  );
}
