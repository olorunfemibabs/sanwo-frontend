import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { WalletProvider } from "@/context/WalletContext";

export const metadata: Metadata = {
  title: "App",
  description: "Sanwo testnet app: finance an invoice, deposit to the pool, and track every step on Stellar.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <AppShell>{children}</AppShell>
    </WalletProvider>
  );
}
