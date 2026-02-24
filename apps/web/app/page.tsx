import { HeroSection } from "@/components/hero-section";
import { BentoGrid } from "@/components/bento-grid";
import { ProductShowcase } from "@/components/product-showcase";
import { FAQSection } from "@/components/faq-section";
import { CTASection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative">
      <div className="noise-overlay" />
      <HeroSection />
      <BentoGrid />
      <ProductShowcase />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
}
