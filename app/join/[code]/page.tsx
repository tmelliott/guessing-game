"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase() || "";

  useEffect(() => {
    if (code) {
      // Redirect to game page - it will handle joining
      router.replace(`/game/${code}`);
    } else {
      router.push("/");
    }
  }, [code, router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white text-3xl font-bold">Redirecting...</p>
    </div>
  );
}
