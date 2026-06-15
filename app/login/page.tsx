"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage(error?.message || "Login failed.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Account profile was not found.");
      setLoading(false);
      return;
    }

    if (profile.role === "admin") {
      router.push("/admin");
      return;
    }

    if (profile.role === "teacher") {
      router.push("/teacher");
      return;
    }

    setMessage("Unknown user role.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="grid w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
          <section className="bg-blue-900 p-8 text-white md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
              Marigondon Elementary School Property Inventory System
            </p>

            <h1 className="mt-6 text-3xl font-semibold leading-tight">
              Classroom Inventory Monitoring Portal
            </h1>

            <p className="mt-4 text-sm leading-6 text-blue-100">
              A secure inventory system for managing classroom rooms, assigned
              teachers, declared items, transfer records, and inventory reports.
            </p>

            <div className="mt-8 rounded-lg border border-blue-700 bg-blue-800/60 p-4">
              <p className="text-sm font-medium text-blue-50">
                Authorized access only
              </p>

              <p className="mt-2 text-xs leading-5 text-blue-100">
                Please sign in using the account provided by the school
                administrator.
              </p>
            </div>
          </section>

          <section className="p-8 md:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">
                Sign in
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Access your account
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Enter your registered email address and password.
              </p>
            </div>

            {message && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="name@school.edu.ph"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 disabled:bg-slate-400"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-xs leading-5 text-slate-500">
              For account concerns, contact the school administrator assigned to
              manage inventory accounts.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}