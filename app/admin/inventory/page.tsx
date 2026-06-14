"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InventoryRecord = {
  id: string;
  room_id: string;
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

const schoolReportCategoryOptions = [
  "Kinder Modular Table",
  "Kinder Chair",
  "Armchair",
  "School Desk",
  "Other Classroom Table",
  "Other Classroom Chair",
  "Other",
];

const conditionOptions = ["Good", "Needs Repair", "Broken", "Missing"];

const sourceOptions = [
  "Personal",
  "Donated by Parents",
  "Provided by School",
  "Provided by City",
];

function formatRoom(item: InventoryRecord) {
  if (!item.rooms) {
    return "No room";
  }

  return `Building ${item.rooms.building_number || item.rooms.building_name}, Floor ${
    item.rooms.floor_number || "N/A"
  }, Room ${item.rooms.room_number}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function isNeedsAttention(condition: string) {
  return (
    condition === "Needs Repair" ||
    condition === "Broken" ||
    condition === "Missing"
  );
}

export default function AdminInventoryPage() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [schoolCategoryFilter, setSchoolCategoryFilter] = useState("All");

  const [editingItemId, setEditingItemId] = useState("");

  const [editItemName, setEditItemName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSchoolReportCategory, setEditSchoolReportCategory] =
    useState("Other");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editCondition, setEditCondition] = useState("Good");
  const [editItemSource, setEditItemSource] = useState("Personal");
  const [editRemarks, setEditRemarks] = useState("");

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
    loadInventory();
  }, []);

  async function loadInventory() {
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
      .from("inventory_items")
      .select(`
        id,
        room_id,
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

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setItems((data || []) as unknown as InventoryRecord[]);
    setLoading(false);
  }

  function startEdit(item: InventoryRecord) {
    setEditingItemId(item.id);
    setEditItemName(item.item_name);
    setEditCategory(item.category || "");
    setEditSchoolReportCategory(item.school_report_category || "Other");
    setEditSerialNumber(item.serial_number || "");
    setEditQuantity(String(item.quantity));
    setEditCondition(item.condition);
    setEditItemSource(item.item_source);
    setEditRemarks(item.remarks || "");
  }

  function cancelEdit() {
    setEditingItemId("");
    setEditItemName("");
    setEditCategory("");
    setEditSchoolReportCategory("Other");
    setEditSerialNumber("");
    setEditQuantity("1");
    setEditCondition("Good");
    setEditItemSource("Personal");
    setEditRemarks("");
  }

  async function saveEdit(item: InventoryRecord) {
    setMessage("");

    if (!editItemName.trim()) {
      showMessage("Please enter the item name.");
      return;
    }

    if (!editCategory.trim()) {
      showMessage("Please enter the general category.");
      return;
    }

    if (!editRemarks.trim()) {
      showMessage("Please enter remarks. If there are no remarks, type N/A.");
      return;
    }

    const quantityNumber = Number(editQuantity);

    if (!quantityNumber || quantityNumber <= 0) {
      showMessage("Quantity must be greater than 0.");
      return;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({
        item_name: editItemName.trim(),
        category: editCategory.trim(),
        school_report_category: editSchoolReportCategory,
        serial_number: editSerialNumber.trim() || null,
        quantity: quantityNumber,
        condition: editCondition,
        item_source: editItemSource,
        remarks: editRemarks.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      showMessage(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("activity_logs").insert({
      user_id: user?.id || null,
      action: "Admin updated inventory item",
      room_id: item.room_id,
      item_id: item.id,
      details: `Admin updated ${editItemName.trim()} in ${formatRoom(item)}.`,
    });

    cancelEdit();
    await loadInventory();

    showMessage("Inventory item updated successfully.");
  }

  const buildingOptions = useMemo(() => {
    const values = items
      .map((item) => item.rooms?.building_number || item.rooms?.building_name || "")
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [items]);

  const conditionFilterOptions = useMemo(() => {
    const values = items.map((item) => item.condition).filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [items]);

  const sourceFilterOptions = useMemo(() => {
    const values = items.map((item) => item.item_source).filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [items]);

  const schoolCategoryOptions = useMemo(() => {
    const values = items
      .map((item) => item.school_report_category || "Other")
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const buildingValue =
        item.rooms?.building_number || item.rooms?.building_name || "";

      const schoolCategoryValue = item.school_report_category || "Other";

      const matchesSearch =
        !keyword ||
        `${item.item_name} ${item.category || ""} ${schoolCategoryValue} ${
          item.serial_number || ""
        } ${item.condition} ${item.item_source} ${item.remarks || ""} ${
          item.profiles?.full_name || ""
        } ${item.profiles?.email || ""} ${formatRoom(item)}`
          .toLowerCase()
          .includes(keyword);

      const matchesBuilding =
        buildingFilter === "All" || buildingValue === buildingFilter;

      const matchesCondition =
        conditionFilter === "All" || item.condition === conditionFilter;

      const matchesSource =
        sourceFilter === "All" || item.item_source === sourceFilter;

      const matchesSchoolCategory =
        schoolCategoryFilter === "All" ||
        schoolCategoryValue === schoolCategoryFilter;

      return (
        matchesSearch &&
        matchesBuilding &&
        matchesCondition &&
        matchesSource &&
        matchesSchoolCategory
      );
    });
  }, [
    items,
    searchTerm,
    buildingFilter,
    conditionFilter,
    sourceFilter,
    schoolCategoryFilter,
  ]);

  const totalQuantity = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [filteredItems]);

  const needsAttentionCount = useMemo(() => {
    return filteredItems.filter((item) => isNeedsAttention(item.condition)).length;
  }, [filteredItems]);

  const personalCount = useMemo(() => {
    return filteredItems.filter((item) => item.item_source === "Personal").length;
  }, [filteredItems]);

  const officialCount = useMemo(() => {
    return filteredItems.filter((item) => item.item_source !== "Personal").length;
  }, [filteredItems]);

  async function exportInventoryExcel() {
    setExporting(true);

    const ExcelJS = await import("exceljs");

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "School Property Inventory System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Inventory Records");

    worksheet.columns = [
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
      { header: "Condition", key: "condition", width: 18 },
      { header: "Source", key: "source", width: 22 },
      { header: "Remarks", key: "remarks", width: 32 },
      { header: "Declared By", key: "declaredBy", width: 24 },
      { header: "Teacher Email", key: "teacherEmail", width: 30 },
      { header: "Date Added", key: "dateAdded", width: 16 },
    ];

    worksheet.addRows(
      filteredItems.map((item) => ({
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
    link.download = "inventory-records.xlsx";
    link.click();

    URL.revokeObjectURL(url);

    setExporting(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-7xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading inventory records...
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
              Inventory Records
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              View, filter, edit, and export classroom inventory records.
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

      <section className="mx-auto max-w-7xl px-6 py-6">
        {message && (
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Records
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {filteredItems.length}
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
              Needs Attention
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-700">
              {needsAttentionCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Official / Personal
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {officialCount} / {personalCount}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Search
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Search item, teacher, room, remarks..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Building
              </label>

              <select
                value={buildingFilter}
                onChange={(event) => setBuildingFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {buildingOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Buildings" : option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Condition
              </label>

              <select
                value={conditionFilter}
                onChange={(event) => setConditionFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {conditionFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Conditions" : option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Source
              </label>

              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {sourceFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Sources" : option}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                School Report Category
              </label>

              <select
                value={schoolCategoryFilter}
                onChange={(event) => setSchoolCategoryFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {schoolCategoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Categories" : option}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 md:flex md:items-end md:justify-end">
              <button
                type="button"
                onClick={exportInventoryExcel}
                disabled={exporting}
                className="w-full rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400 md:w-auto"
              >
                {exporting ? "Exporting..." : "Download Excel"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1700px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Room
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Grade
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Item
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    General Category
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    School Category
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Serial No.
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Qty
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Condition
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Source
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Remarks
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Declared By
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isEditing = editingItemId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {formatRoom(item)}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {item.rooms?.grade_level || ""}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editItemName}
                              onChange={(event) =>
                                setEditItemName(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            item.item_name
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCategory}
                              onChange={(event) =>
                                setEditCategory(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            item.category || ""
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <select
                              value={editSchoolReportCategory}
                              onChange={(event) =>
                                setEditSchoolReportCategory(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {schoolReportCategoryOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.school_report_category || "Other"
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editSerialNumber}
                              onChange={(event) =>
                                setEditSerialNumber(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                              placeholder="Optional"
                            />
                          ) : (
                            item.serial_number || ""
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(event) =>
                                setEditQuantity(event.target.value)
                              }
                              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <select
                              value={editCondition}
                              onChange={(event) =>
                                setEditCondition(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {conditionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={
                                isNeedsAttention(item.condition)
                                  ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                                  : "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                              }
                            >
                              {item.condition}
                            </span>
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <select
                              value={editItemSource}
                              onChange={(event) =>
                                setEditItemSource(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {sourceOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.item_source
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRemarks}
                              onChange={(event) =>
                                setEditRemarks(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            item.remarks || ""
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          <p>{item.profiles?.full_name || ""}</p>
                          <p className="text-xs text-slate-500">
                            {item.profiles?.email || ""}
                          </p>
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {formatDate(item.created_at)}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(item)}
                                className="rounded-md bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-md bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}