"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InventoryRecord = {
  id: string;
  item_name: string;
  category: string | null;
  school_report_category: string | null;
  serial_number: string | null;
  quantity: number;
  condition: string;
  item_source: string;
  remarks: string | null;
  created_at: string;
  rooms: {
    building_name: string;
    building_number: string | null;
    floor_number: string | null;
    room_number: string;
    grade_level: string | null;
  } | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
};

type SummaryRow = {
  name: string;
  records: number;
  quantity: number;
};

type ReportRecordRow = {
  building: string;
  floor: string;
  room: string;
  gradeLevel: string;
  itemName: string;
  category: string;
  schoolReportCategory: string;
  serialNumber: string;
  quantity: number;
  condition: string;
  source: string;
  remarks: string;
  declaredBy: string;
  teacherEmail: string;
  dateAdded: string;
};

type ReportSnapshot = {
  schoolYear: string;
  reportName: string;
  generatedAt: string;
  totals: {
    totalRecords: number;
    totalQuantity: number;
    roomCount: number;
    needsAttentionCount: number;
  };
  inventoryRecords: ReportRecordRow[];
  summaries: {
    categorySummary: SummaryRow[];
    conditionSummary: SummaryRow[];
    sourceSummary: SummaryRow[];
    roomSummary: SummaryRow[];
    teacherSummary: SummaryRow[];
  };
};

type SavedReport = {
  id: string;
  school_year: string;
  report_name: string;
  report_data: ReportSnapshot;
  created_by: string | null;
  created_at: string;
};

function getDefaultSchoolYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;

  return `${startYear}-${endYear}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatRoom(item: InventoryRecord) {
  if (!item.rooms) {
    return "No room";
  }

  return `Building ${item.rooms.building_number || item.rooms.building_name}, Floor ${
    item.rooms.floor_number || "N/A"
  }, Room ${item.rooms.room_number}`;
}

function getTeacherName(item: InventoryRecord) {
  return item.profiles?.full_name || "Unassigned teacher";
}

function isNeedsAttention(condition: string) {
  return (
    condition === "Needs Minor Repair" ||
    condition === "Needs Major Repair" ||
    condition === "For Condemnation" ||
    condition === "Condemned/For Demolition" ||
    condition === "Needs Repair" ||
    condition === "Broken" ||
    condition === "Missing"
  );
}

function buildSummary(
  items: InventoryRecord[],
  getName: (item: InventoryRecord) => string
) {
  const summary = new Map<string, SummaryRow>();

  items.forEach((item) => {
    const name = getName(item) || "Unspecified";

    const existing = summary.get(name) || {
      name,
      records: 0,
      quantity: 0,
    };

    existing.records += 1;
    existing.quantity += item.quantity;

    summary.set(name, existing);
  });

  return Array.from(summary.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function buildReportRecords(items: InventoryRecord[]) {
  return items.map((item) => ({
    building: item.rooms?.building_number || item.rooms?.building_name || "",
    floor: item.rooms?.floor_number || "",
    room: item.rooms?.room_number || "",
    gradeLevel: item.rooms?.grade_level || "",
    itemName: item.item_name,
    category: item.category || "",
    schoolReportCategory: item.school_report_category || "Other",
    serialNumber: item.serial_number || "",
    quantity: item.quantity,
    condition: item.condition,
    source: item.item_source,
    remarks: item.remarks || "",
    declaredBy: item.profiles?.full_name || "",
    teacherEmail: item.profiles?.email || "",
    dateAdded: formatDate(item.created_at),
  }));
}

function buildReportSnapshot(
  items: InventoryRecord[],
  schoolYear: string,
  reportName: string
): ReportSnapshot {
  const categorySummary = buildSummary(
    items,
    (item) => item.school_report_category || "Other"
  );

  const conditionSummary = buildSummary(
    items,
    (item) => item.condition || "Unspecified"
  );

  const sourceSummary = buildSummary(
    items,
    (item) => item.item_source || "Unspecified"
  );

  const roomSummary = buildSummary(items, (item) => formatRoom(item));

  const teacherSummary = buildSummary(items, (item) => getTeacherName(item));

  const roomSet = new Set(items.map((item) => formatRoom(item)));

  return {
    schoolYear,
    reportName,
    generatedAt: new Date().toISOString(),
    totals: {
      totalRecords: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      roomCount: roomSet.size,
      needsAttentionCount: items.filter((item) =>
        isNeedsAttention(item.condition)
      ).length,
    },
    inventoryRecords: buildReportRecords(items),
    summaries: {
      categorySummary,
      conditionSummary,
      sourceSummary,
      roomSummary,
      teacherSummary,
    },
  };
}

function SummaryTable({
  title,
  description,
  firstColumnLabel,
  rows,
}: {
  title: string;
  description: string;
  firstColumnLabel: string;
  rows: SummaryRow[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                {firstColumnLabel}
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                Records
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                Total Quantity
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  No data available.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">
                    {row.name}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                    {row.records}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                    {row.quantity}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [adminUserId, setAdminUserId] = useState("");

  const [items, setItems] = useState<InventoryRecord[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  const [schoolYear, setSchoolYear] = useState(getDefaultSchoolYear());
  const [reportName, setReportName] = useState(
    `Inventory Report SY ${getDefaultSchoolYear()}`
  );

  const [loading, setLoading] = useState(true);
  const [savingReport, setSavingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

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

  async function loadReports() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setAdminUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      router.push("/login");
      return;
    }

    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory_items")
      .select(`
        id,
        item_name,
        category,
        school_report_category,
        serial_number,
        quantity,
        condition,
        item_source,
        remarks,
        created_at,
        rooms!inventory_items_room_id_fkey (
          building_name,
          building_number,
          floor_number,
          room_number,
          grade_level
        ),
        profiles (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (inventoryError) {
      setMessage(inventoryError.message);
      setLoading(false);
      return;
    }

    setItems((inventoryData || []) as unknown as InventoryRecord[]);

    await loadSavedReports();

    setLoading(false);
  }

  async function loadSavedReports() {
    const { data, error } = await supabase
      .from("saved_reports")
      .select(`
        id,
        school_year,
        report_name,
        report_data,
        created_by,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSavedReports((data || []) as unknown as SavedReport[]);
  }

  const totalRecords = items.length;

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const roomCount = useMemo(() => {
    const roomSet = new Set(items.map((item) => formatRoom(item)));
    return roomSet.size;
  }, [items]);

  const needsAttentionCount = useMemo(() => {
    return items.filter((item) => isNeedsAttention(item.condition)).length;
  }, [items]);

  const categorySummary = useMemo(() => {
    return buildSummary(
      items,
      (item) => item.school_report_category || "Other"
    );
  }, [items]);

  const conditionSummary = useMemo(() => {
    return buildSummary(items, (item) => item.condition || "Unspecified");
  }, [items]);

  const sourceSummary = useMemo(() => {
    return buildSummary(items, (item) => item.item_source || "Unspecified");
  }, [items]);

  const roomSummary = useMemo(() => {
    return buildSummary(items, (item) => formatRoom(item));
  }, [items]);

  const teacherSummary = useMemo(() => {
    return buildSummary(items, (item) => getTeacherName(item));
  }, [items]);

  function updateSchoolYear(value: string) {
    setSchoolYear(value);
    setReportName(`Inventory Report SY ${value}`);
  }

  function styleWorksheet(worksheet: any) {
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
  }

  function addSummarySheet(
    workbook: any,
    sheetName: string,
    firstColumnHeader: string,
    rows: SummaryRow[]
  ) {
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = [
      { header: firstColumnHeader, key: "name", width: 42 },
      { header: "Records", key: "records", width: 16 },
      { header: "Total Quantity", key: "quantity", width: 18 },
    ];

    worksheet.addRows(rows);

    styleWorksheet(worksheet);
  }

  async function exportSnapshotToExcel(snapshot: ReportSnapshot) {
    setExporting(true);

    const ExcelJS = await import("exceljs");

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "School Property Inventory System";
    workbook.created = new Date();

    const overviewSheet = workbook.addWorksheet("Overview");

    overviewSheet.columns = [
      { header: "Field", key: "field", width: 32 },
      { header: "Value", key: "value", width: 40 },
    ];

    overviewSheet.addRows([
      { field: "Report Name", value: snapshot.reportName },
      { field: "School Year", value: snapshot.schoolYear },
      {
        field: "Generated At",
        value: formatDateTime(snapshot.generatedAt),
      },
      { field: "Total Records", value: snapshot.totals.totalRecords },
      { field: "Total Quantity", value: snapshot.totals.totalQuantity },
      { field: "Rooms Covered", value: snapshot.totals.roomCount },
      {
        field: "Needs Attention",
        value: snapshot.totals.needsAttentionCount,
      },
    ]);

    styleWorksheet(overviewSheet);

    const recordsSheet = workbook.addWorksheet("Inventory Records");

    recordsSheet.columns = [
      { header: "Building", key: "building", width: 18 },
      { header: "Floor", key: "floor", width: 12 },
      { header: "Room", key: "room", width: 14 },
      { header: "Grade Level", key: "gradeLevel", width: 16 },
      { header: "Item Name", key: "itemName", width: 28 },
      { header: "General Category", key: "category", width: 22 },
      {
        header: "School Report Category",
        key: "schoolReportCategory",
        width: 28,
      },
      { header: "Serial Number", key: "serialNumber", width: 20 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Condition", key: "condition", width: 24 },
      { header: "Source", key: "source", width: 22 },
      { header: "Remarks", key: "remarks", width: 36 },
      { header: "Declared By", key: "declaredBy", width: 24 },
      { header: "Teacher Email", key: "teacherEmail", width: 30 },
      { header: "Date Added", key: "dateAdded", width: 16 },
    ];

    recordsSheet.addRows(snapshot.inventoryRecords);

    styleWorksheet(recordsSheet);

    addSummarySheet(
      workbook,
      "By School Category",
      "School Report Category",
      snapshot.summaries.categorySummary
    );

    addSummarySheet(
      workbook,
      "By Condition",
      "Condition",
      snapshot.summaries.conditionSummary
    );

    addSummarySheet(
      workbook,
      "By Source",
      "Source",
      snapshot.summaries.sourceSummary
    );

    addSummarySheet(
      workbook,
      "By Room",
      "Room",
      snapshot.summaries.roomSummary
    );

    addSummarySheet(
      workbook,
      "By Teacher",
      "Teacher",
      snapshot.summaries.teacherSummary
    );

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const safeName = snapshot.reportName
      .replace(/[^a-z0-9- ]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${safeName || "inventory-report"}.xlsx`;
    link.click();

    URL.revokeObjectURL(url);

    setExporting(false);
  }

  async function downloadCurrentExcelReport() {
    const cleanSchoolYear = schoolYear.trim() || getDefaultSchoolYear();
    const cleanReportName =
      reportName.trim() || `Inventory Report SY ${cleanSchoolYear}`;

    const snapshot = buildReportSnapshot(items, cleanSchoolYear, cleanReportName);

    await exportSnapshotToExcel(snapshot);
  }

  async function saveSchoolYearReport() {
    setMessage("");

    const cleanSchoolYear = schoolYear.trim();
    const cleanReportName = reportName.trim();

    if (!cleanSchoolYear) {
      showMessage("Please enter the school year.");
      return;
    }

    if (!cleanReportName) {
      showMessage("Please enter the report name.");
      return;
    }

    setSavingReport(true);

    const snapshot = buildReportSnapshot(items, cleanSchoolYear, cleanReportName);

    const { error } = await supabase.from("saved_reports").insert({
      school_year: cleanSchoolYear,
      report_name: cleanReportName,
      report_data: snapshot,
      created_by: adminUserId,
    });

    if (error) {
      showMessage(error.message);
      setSavingReport(false);
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId,
      action: "Admin saved school-year report",
      room_id: null,
      item_id: null,
      details: `Admin saved ${cleanReportName}.`,
    });

    await loadSavedReports();

    showMessage("School-year report saved successfully.");
    setSavingReport(false);
  }

  async function downloadSavedReport(report: SavedReport) {
    await exportSnapshotToExcel(report.report_data);
  }

  async function deleteSavedReport(report: SavedReport) {
    const confirmed = window.confirm(
      `Delete saved report "${report.report_name}"?`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("saved_reports")
      .delete()
      .eq("id", report.id);

    if (error) {
      showMessage(error.message);
      return;
    }

    await loadSavedReports();

    showMessage("Saved report deleted successfully.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-7xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading reports...
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
              Inventory Reports
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Generate, save, and download school-year inventory reports as Excel files.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCurrentExcelReport}
              disabled={exporting}
              className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
            >
              {exporting ? "Exporting..." : "Download Current Excel"}
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
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Inventory Records
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalRecords}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Quantity
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalQuantity}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rooms Covered
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {roomCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Needs Attention
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-700">
              {needsAttentionCount}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Save School-Year Report
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              This saves a snapshot of the current inventory report. Future inventory changes will not change this saved report.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                School Year
              </label>

              <input
                type="text"
                value={schoolYear}
                onChange={(event) => updateSchoolYear(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: 2025-2026"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Report Name
              </label>

              <input
                type="text"
                value={reportName}
                onChange={(event) => setReportName(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: Inventory Report SY 2025-2026"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={saveSchoolYearReport}
                disabled={savingReport}
                className="w-full rounded-md bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:bg-slate-400"
              >
                {savingReport ? "Saving..." : "Save School-Year Report"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Saved School-Year Reports
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Download previously saved reports in Excel format.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    School Year
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Report Name
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Saved Date
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {savedReports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No saved reports yet.
                    </td>
                  </tr>
                ) : (
                  savedReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">
                        {report.school_year}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {report.report_name}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                        {formatDateTime(report.created_at)}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => downloadSavedReport(report)}
                            disabled={exporting}
                            className="rounded-md bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
                          >
                            Download Excel
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteSavedReport(report)}
                            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SummaryTable
            title="School Report Category Summary"
            description="Inventory grouped according to official reporting categories."
            firstColumnLabel="School Report Category"
            rows={categorySummary}
          />

          <SummaryTable
            title="Condition Summary"
            description="Inventory grouped by current condition."
            firstColumnLabel="Condition"
            rows={conditionSummary}
          />

          <SummaryTable
            title="Item Source Summary"
            description="Inventory grouped by source of item."
            firstColumnLabel="Source"
            rows={sourceSummary}
          />

          <SummaryTable
            title="Teacher Declaration Summary"
            description="Inventory records grouped by declaring teacher."
            firstColumnLabel="Teacher"
            rows={teacherSummary}
          />
        </div>

        <div className="mt-6">
          <SummaryTable
            title="Room Summary"
            description="Inventory records grouped by assigned room."
            firstColumnLabel="Room"
            rows={roomSummary}
          />
        </div>
      </section>
    </main>
  );
}