"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "./_landing/LandingPage";

export default function Home() {
  const router = useRouter();
  const [mostrarLanding, setMostrarLanding] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
    if (token) router.replace("/inicio");
    else setMostrarLanding(true);
  }, [router]);

  if (!mostrarLanding) return null;
  return <LandingPage />;
}
