"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";

type AdminCard = {
  title: string;
  description: string;
  href: string;
  badge: string;
};

const adminCards: AdminCard[] = [
  {
    title: "Manage Rooms",
    description: "Create rooms and update room details.",
    href: "/admin/rooms",
    badge: "Rooms",
  },
  {
    title: "Manage Room Teachers",
    description: "Assign multiple teachers to rooms and set permissions.",
    href: "/admin/room-teachers",
    badge: "Teachers",
  },
  {
    title: "Inventory Timeframes",
    description: "Open or close teacher access for adding and editing records.",
    href: "/admin/timeframes",
    badge: "Access",
  },
  {
    title: "Inventory Records",
    description: "View, search, edit, and export all inventory records.",
    href: "/admin/inventory",
    badge: "Records",
  },
  {
    title: "Transfer Item",
    description: "Move inventory items from one room to another.",
    href: "/admin/transfer",
    badge: "Transfer",
  },
  {
    title: "Reports",
    description: "Generate inventory summaries and downloadable reports.",
    href: "/admin/reports",
    badge: "Reports",
  },
  {
    title: "Activity Logs",
    description: "Review recent system actions and inventory updates.",
    href: "/admin/activity",
    badge: "Logs",
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();

  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (error || !profile || profile.role !== "admin") {
      router.push("/login");
      return;
    }

    setAdminName(profile.full_name);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading admin dashboard...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              School Property Inventory System
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Admin Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Welcome, {adminName}. Manage rooms, teachers, access windows, and inventory records.
            </p>
          </div>

          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-base font-semibold text-blue-950">
            Administrative Controls
          </h2>

          <p className="mt-1 text-sm text-blue-900">
            Select a module below to manage the inventory system.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adminCards.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {card.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                  {card.badge}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}