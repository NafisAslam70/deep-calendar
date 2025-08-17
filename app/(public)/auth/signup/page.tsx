"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const search = useSearchParams();
  const next = search.get("next") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (r.ok) location.href = next;
    else alert("Signup failed");
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-bold">Sign up</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full rounded-lg bg-black px-4 py-2 text-white">
          Create account
        </button>
      </form>
    </div>
  );
}

export default function SignUpPage() {
  // Required in Next 15 when using useSearchParams in a client component
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm p-6">Loading…</div>}>
      <SignUpForm />
    </Suspense>
  );
}
