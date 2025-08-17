"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const search = useSearchParams();
  const next = search.get("next") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) location.href = next;
    else alert("Invalid credentials");
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded-lg border px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full rounded-lg border px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full rounded-lg bg-black px-4 py-2 text-white">Sign in</button>
      </form>
      <p className="mt-3 text-sm text-gray-600">No account? <a className="underline" href={`/auth/signup?next=${encodeURIComponent(next)}`}>Sign up</a></p>
    </div>
  );
}
