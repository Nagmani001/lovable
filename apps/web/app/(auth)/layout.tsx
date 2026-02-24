export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <div className="noise-overlay" />
      <div className="absolute inset-0 hero-glow opacity-30" />
      {children}
    </div>
  );
}
