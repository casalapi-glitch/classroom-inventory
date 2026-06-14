"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ActivityLog = {
  id: string;
  user_id: string | null;
  action: string;
  room_id: string | null;
  item_id: string | null;
  details: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    role: string;
  } | null;
  rooms: {
    building_name: string;
    building_number: string | null;
    floor_number: string | null;
    room_number: string;
  } | null;
  inventory_items: {
    item_name: string;
  } | null;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatRoom(log: ActivityLog) {
  if (!log.rooms) {
    return "N/A";
  }

  return `Building ${log.rooms.building_number || log.rooms.building_name}, Floor ${
    log.rooms.floor_number || "N/A"
  }, Room ${log.rooms.room_number}`;
}

function getActionBadgeLabel(action: string) {
  const lowerAction = action.toLowerCase();

  if (lowerAction.includes("transfer")) {
    return "Transferred";
  }

  if (lowerAction.includes("add")) {
    return "Added";
  }

  if (lowerAction.includes("update") || lowerAction.includes("edit")) {
    return "Updated";
  }

  if (lowerAction.includes("delete") || lowerAction.includes("remove")) {
    return "Deleted";
  }

  return "Activity";
}

function getActionBadgeClass(action: string) {
  const lowerAction = action.toLowerCase();

  if (lowerAction.includes("transfer")) {
    return "border border-purple-200 bg-purple-50 text-purple-700";
  }

  if (lowerAction.includes("add")) {
    return "border border-green-200 bg-green-50 text-green-700";
  }

  if (lowerAction.includes("update") || lowerAction.includes("edit")) {
    return "border border-blue-200 bg-blue-50 text-blue-700";
  }

  if (lowerAction.includes("delete") || lowerAction.includes("remove")) {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminActivityPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  useEffect(() => {
    loadActivityLogs();
  }, []);

  async function loadActivityLogs() {
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
      .from("activity_logs")
      .select(`
        id,
        user_id,
        action,
        room_id,
        item_id,
        details,
        created_at,
        profiles (
          full_name,
          email,
          role
        ),
        rooms (
          building_name,
          building_number,
          floor_number,
          room_number
        ),
        inventory_items (
          item_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setLogs((data || []) as unknown as ActivityLog[]);
    setLoading(false);
  }

  const actionOptions = useMemo(() => {
    const values = logs.map((log) => log.action).filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [logs]);

  const roleOptions = useMemo(() => {
    const values = logs
      .map((log) => log.profiles?.role || "Unknown")
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const roleValue = log.profiles?.role || "Unknown";

      const matchesSearch =
        !keyword ||
        `${log.action} ${log.details || ""} ${log.profiles?.full_name || ""} ${
          log.profiles?.email || ""
        } ${roleValue} ${formatRoom(log)} ${log.inventory_items?.item_name || ""}`
          .toLowerCase()
          .includes(keyword);

      const matchesAction =
        actionFilter === "All" || log.action === actionFilter;

      const matchesRole = roleFilter === "All" || roleValue === roleFilter;

      return matchesSearch && matchesAction && matchesRole;
    });
  }, [logs, searchTerm, actionFilter, roleFilter]);

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString();

    return logs.filter((log) => formatDate(log.created_at) === today).length;
  }, [logs]);

  const transferCount = useMemo(() => {
    return logs.filter((log) => log.action.toLowerCase().includes("transfer"))
      .length;
  }, [logs]);

  const updateCount = useMemo(() => {
    return logs.filter(
      (log) =>
        log.action.toLowerCase().includes("update") ||
        log.action.toLowerCase().includes("edit")
    ).length;
  }, [logs]);

  async function exportActivityExcel() {
    setExporting(true);

    const ExcelJS = await import("exceljs");

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "School Property Inventory System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Activity Logs");

    worksheet.columns = [
      { header: "Date and Time", key: "dateTime", width: 24 },
      { header: "User", key: "user", width: 28 },
      { header: "Email", key: "email", width: 32 },
      { header: "Role", key: "role", width: 14 },
      { header: "Action", key: "action", width: 32 },
      { header: "Room", key: "room", width: 36 },
      { header: "Item", key: "item", width: 28 },
      { header: "Details", key: "details", width: 60 },
    ];

    worksheet.addRows(
      filteredLogs.map((log) => ({
        dateTime: formatDateTime(log.created_at),
        user: log.profiles?.full_name || "Unknown user",
        email: log.profiles?.email || "",
        role: log.profiles?.role || "Unknown",
        action: log.action,
        room: formatRoom(log),
        item: log.inventory_items?.item_name || "",
        details: log.details || "",
      }))
    );

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    worksheet.getRow(1).font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };

    worksheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    worksheet.eachRow((row: any) => {
      row.eachCell((cell: any) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD9E2EC" } },
          left: { style: "thin", color: { argb: "FFD9E2EC" } },
          bottom: { style: "thin", color: { argb: "FFD9E2EC" } },
          right: { style: "thin", color: { argb: "FFD9E2EC" } },
        };

        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "activity-logs.xlsx";
    link.click();

    URL.revokeObjectURL(url);

    setExporting(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-7xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading activity logs...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              School Property Inventory System
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Activity Logs
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Monitor system activity, inventory updates, and item transfers.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportActivityExcel}
              disabled={exporting}
              className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
            >
              {exporting ? "Exporting..." : "Download Excel"}
            </button>

            <button
              type="button"
              onClick={loadActivityLogs}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>

            <a
              href="/admin"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Admin
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {message && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Logs
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {logs.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {todayCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Transfers
            </p>
            <p className="mt-2 text-2xl font-semibold text-purple-700">
              {transferCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Updates
            </p>
            <p className="mt-2 text-2xl font-semibold text-blue-700">
              {updateCount}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Search
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Search user, action, room, item, details..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Action
              </label>

              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {actionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Actions" : option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Role
              </label>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Roles" : option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Date and Time
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    User
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Action
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Room
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Item
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {formatDateTime(log.created_at)}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        <p className="font-medium text-slate-900">
                          {log.profiles?.full_name || "Unknown user"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {log.profiles?.email || ""}
                        </p>
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {log.profiles?.role || "Unknown"}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
  <div className="space-y-1">
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${getActionBadgeClass(
        log.action
      )}`}
    >
      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current opacity-70" />
      {getActionBadgeLabel(log.action)}
    </span>

    <p className="text-xs text-slate-500">
      {log.action}
    </p>
  </div>
</td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {formatRoom(log)}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {log.inventory_items?.item_name || ""}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {log.details || ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}