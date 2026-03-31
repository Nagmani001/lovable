import { HeroSection } from "@/components/hero-section";
import { BentoGrid } from "@/components/bento-grid";

import { ProductShowcase } from "@/components/product-showcase";
import { FAQSection } from "@/components/faq-section";
import { CTASection } from "@/components/cta-section";
import { Footer } from "@/components/footer";
import { cookies } from "next/headers";
import { authClient } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookie = await cookies();
  const { data: session, error } = await authClient.getSession({
    fetchOptions: {
      headers: {
        Cookie: cookie.toString(),
      },
    },
  });
  if (session != null) {
    redirect("/projects");
  }
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
