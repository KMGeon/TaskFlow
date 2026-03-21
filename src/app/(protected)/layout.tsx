import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return <AppLayout>{children}</AppLayout>;
}
