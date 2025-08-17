"use client";

import { useEffect } from "react";

export default function SignOutPage() {
  useEffect(() => {
    (async () => {
      try { await fetch("/api/auth/signout", { method: "POST" }); } catch {}
      window.location.href = "/auth/signin";
    })();
  }, []);

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-bold">Signing you out…</h1>
      <p className="text-sm text-gray-600">Please wait.</p>
    </div>
  );
}
