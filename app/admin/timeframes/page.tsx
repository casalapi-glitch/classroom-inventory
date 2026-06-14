"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InventoryAccessWindow = {
  action_type: "add" | "edit";
  starts_at: string;
  ends_at: string;
  is_enabled: boolean;
  updated_at: string;
};

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60000);

  return localDate.toISOString().slice(0, 16);
}

function isWindowOpen(windowData: InventoryAccessWindow | null) {
  if (!windowData || !windowData.is_enabled) {
    return false;
  }

  const now = new Date().getTime();
  const start = new Date(windowData.starts_at).getTime();
  const end = new Date(windowData.ends_at).getTime();

  return now >= start && now <= end;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminTimeframesPage() {
  const router = useRouter();

  const [windows, setWindows] = useState<InventoryAccessWindow[]>([]);

  const [selectedAction, setSelectedAction] = useState<"add" | "edit">("add");
  const [closesAt, setClosesAt] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function showMessage(text: string) {
    setMessage(text);

    setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    }, 100);
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    const selectedWindow = windows.find(
      (windowData) => windowData.action_type === selectedAction
    );

    if (selectedWindow) {
      setClosesAt(toDatetimeLocal(selectedWindow.ends_at));
      setIsEnabled(selectedWindow.is_enabled);
    }
  }, [selectedAction, windows]);

  async function loadPageData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("inventory_access_windows")
      .select("action_type, starts_at, ends_at, is_enabled, updated_at")
      .order("action_type", { ascending: true });

    if (error) {
      showMessage(error.message);
      setLoading(false);
      return;
    }

    setWindows((data || []) as InventoryAccessWindow[]);
    setLoading(false);
  }

  async function saveAccessWindow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    let closeDate = closesAt
      ? new Date(closesAt)
      : new Date(Date.now() + 60 * 60 * 1000);

    const openDate = new Date();

    if (isEnabled && closeDate <= openDate) {
      showMessage("Closing date/time must be later than the current time.");
      return;
    }

    if (!isEnabled && closeDate <= openDate) {
      closeDate = new Date(Date.now() + 60 * 60 * 1000);
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("inventory_access_windows")
      .upsert(
        {
          action_type: selectedAction,
          starts_at: openDate.toISOString(),
          ends_at: closeDate.toISOString(),
          is_enabled: isEnabled,
          updated_by: user?.id || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "action_type",
        }
      );

    if (error) {
      showMessage(error.message);
      setSaving(false);
      return;
    }

    await loadPageData();

    if (isEnabled) {
      showMessage(
        selectedAction === "add"
          ? "Add Inventory access is now open until the selected deadline."
          : "Edit Inventory access is now open until the selected deadline."
      );
    } else {
      showMessage(
        selectedAction === "add"
          ? "Add Inventory access is now closed."
          : "Edit Inventory access is now closed."
      );
    }

    setSaving(false);
  }

  const addWindow =
    windows.find((windowData) => windowData.action_type === "add") || null;

  const editWindow =
    windows.find((windowData) => windowData.action_type === "edit") || null;

  const selectedWindow =
    windows.find((windowData) => windowData.action_type === selectedAction) ||
    null;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading inventory access settings...
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
              Inventory Access Control
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Open or close teacher access for adding and editing inventory records.
            </p>
          </div>

          <a
            href="/admin"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Admin
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-6">
        {message && (
          <div className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {message}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Add Inventory
              </h2>

              <span
                className={
                  isWindowOpen(addWindow)
                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                    : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                }
              >
                {isWindowOpen(addWindow) ? "Open" : "Closed"}
              </span>
            </div>

            {addWindow && (
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Access:</span>{" "}
                  {addWindow.is_enabled ? "Enabled" : "Disabled"}
                </p>

                <p>
                  <span className="font-semibold">Closes:</span>{" "}
                  {formatDateTime(addWindow.ends_at)}
                </p>

                <p>
                  <span className="font-semibold">Last updated:</span>{" "}
                  {formatDateTime(addWindow.updated_at)}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Edit Inventory
              </h2>

              <span
                className={
                  isWindowOpen(editWindow)
                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                    : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                }
              >
                {isWindowOpen(editWindow) ? "Open" : "Closed"}
              </span>
            </div>

            {editWindow && (
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Access:</span>{" "}
                  {editWindow.is_enabled ? "Enabled" : "Disabled"}
                </p>

                <p>
                  <span className="font-semibold">Closes:</span>{" "}
                  {formatDateTime(editWindow.ends_at)}
                </p>

                <p>
                  <span className="font-semibold">Last updated:</span>{" "}
                  {formatDateTime(editWindow.updated_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={saveAccessWindow}
          className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Set Access Deadline
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Access is closed by default. Enable access only when teachers are allowed
            to add or edit records.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Action
              </label>

              <select
                value={selectedAction}
                onChange={(event) =>
                  setSelectedAction(event.target.value as "add" | "edit")
                }
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="add">Add Inventory</option>
                <option value="edit">Edit Inventory</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Access Status
              </label>

              <label className="mt-2 flex items-center gap-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(event) => setIsEnabled(event.target.checked)}
                  className="h-4 w-4"
                />
                Open access now
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Close Date and Time
              </label>

              <input
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />

              <p className="mt-2 text-xs text-slate-500">
                If access is opened, teachers can use this action immediately until
                this deadline.
              </p>
            </div>
          </div>

          {selectedWindow && (
            <div className="mt-5 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Current selected setting:{" "}
              <span className="font-semibold">
                {selectedAction === "add" ? "Add Inventory" : "Edit Inventory"}
              </span>{" "}
              is currently{" "}
              <span className="font-semibold">
                {isWindowOpen(selectedWindow) ? "open" : "closed"}
              </span>
              .
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save Access Setting"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}