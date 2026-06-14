"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Room = {
  id: string;
  building_name: string;
  building_number: string | null;
  floor_number: string | null;
  room_number: string;
  grade_level: string | null;
  teacher_can_add: boolean;
  teacher_can_edit: boolean;
};

type AssignmentRow = {
  teacher_can_add: boolean;
  teacher_can_edit: boolean;
  rooms: {
    id: string;
    building_name: string;
    building_number: string | null;
    floor_number: string | null;
    room_number: string;
    grade_level: string | null;
  } | null;
};

type InventoryItem = {
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
  updated_at: string;
};

type InventoryAccessWindow = {
  action_type: "add" | "edit";
  starts_at: string;
  ends_at: string;
  is_enabled: boolean;
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

function formatRoom(room: Room) {
  return `Building ${room.building_number || room.building_name}, Floor ${
    room.floor_number || "N/A"
  }, Room ${room.room_number}`;
}

export default function TeacherMyRoomPage() {
  const router = useRouter();

  const [teacherUserId, setTeacherUserId] = useState("");
  const [teacherName, setTeacherName] = useState("");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editWindow, setEditWindow] = useState<InventoryAccessWindow | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
    loadTeacherData();
  }, []);

  async function loadTeacherData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setTeacherUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "teacher") {
      router.push("/login");
      return;
    }

    setTeacherName(profile.full_name);

    const { data: editWindowData, error: editWindowError } = await supabase
      .from("inventory_access_windows")
      .select("action_type, starts_at, ends_at, is_enabled")
      .eq("action_type", "edit")
      .maybeSingle();

    if (editWindowError) {
      showMessage(editWindowError.message);
      setLoading(false);
      return;
    }

    setEditWindow(editWindowData as InventoryAccessWindow | null);

    const { data: assignmentData, error: assignmentError } = await supabase
      .from("room_teacher_assignments")
      .select(`
        teacher_can_add,
        teacher_can_edit,
        rooms (
          id,
          building_name,
          building_number,
          floor_number,
          room_number,
          grade_level
        )
      `)
      .eq("teacher_id", user.id);

    if (assignmentError) {
      showMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const assignments = (assignmentData || []) as unknown as AssignmentRow[];

    const teacherRooms = assignments
      .filter((assignment) => assignment.rooms)
      .map((assignment) => ({
        id: assignment.rooms!.id,
        building_name: assignment.rooms!.building_name,
        building_number: assignment.rooms!.building_number,
        floor_number: assignment.rooms!.floor_number,
        room_number: assignment.rooms!.room_number,
        grade_level: assignment.rooms!.grade_level,
        teacher_can_add: assignment.teacher_can_add,
        teacher_can_edit: assignment.teacher_can_edit,
      }));

    teacherRooms.sort((a, b) => {
      const roomA = `${a.building_number || a.building_name}-${a.floor_number}-${a.room_number}`;
      const roomB = `${b.building_number || b.building_name}-${b.floor_number}-${b.room_number}`;

      return roomA.localeCompare(roomB);
    });

    setRooms(teacherRooms);

    if (teacherRooms.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const roomIds = teacherRooms.map((room) => room.id);

    const { data: inventoryItems, error: itemsError } = await supabase
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
        updated_at
      `)
      .in("room_id", roomIds)
      .eq("added_by", user.id)
      .order("item_name", { ascending: true });

    if (itemsError) {
      showMessage(itemsError.message);
      setLoading(false);
      return;
    }

    setItems((inventoryItems || []) as InventoryItem[]);
    setLoading(false);
  }

  function getItemsForRoom(roomId: string) {
    return items.filter((item) => item.room_id === roomId);
  }

  function getRoomForItem(item: InventoryItem) {
    return rooms.find((room) => room.id === item.room_id) || null;
  }

  function startEdit(item: InventoryItem) {
    const room = getRoomForItem(item);

    if (!isWindowOpen(editWindow)) {
      showMessage("Change Inventory is currently closed by the admin.");
      return;
    }

    if (!room || !room.teacher_can_edit) {
      showMessage("Editing is not allowed for this room.");
      return;
    }

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

  async function saveEdit(item: InventoryItem) {
    const room = getRoomForItem(item);

    if (!isWindowOpen(editWindow)) {
      showMessage("Change Inventory is currently closed by the admin.");
      return;
    }

    if (!room || !room.teacher_can_edit) {
      showMessage("Editing is not allowed for this room.");
      return;
    }

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

    await supabase.from("activity_logs").insert({
      user_id: teacherUserId,
      action: "Teacher updated inventory item",
      room_id: item.room_id,
      item_id: item.id,
      details: `${teacherName} updated ${editItemName.trim()} in ${formatRoom(
        room
      )}.`,
    });

    cancelEdit();
    await loadTeacherData();

    showMessage("Inventory item updated successfully.");
  }

  const canEditNow = isWindowOpen(editWindow);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-sm">
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
              Change Inventory Records
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              View and update inventory items you personally declared.
            </p>
          </div>

          <a
            href="/teacher"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {message && (
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Change Inventory Access
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                {canEditNow && editWindow
                  ? `Open until ${formatDateTime(editWindow.ends_at)}`
                  : "Currently closed by the admin."}
              </p>
            </div>

            <span
              className={
                canEditNow
                  ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                  : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
              }
            >
              {canEditNow ? "Open" : "Closed"}
            </span>
          </div>
        </div>

        {!canEditNow && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            Change Inventory is currently closed. You can view your records, but
            editing is disabled until the admin opens access.
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
            No rooms are assigned to your account yet.
          </div>
        ) : (
          <div className="space-y-6">
            {rooms.map((room) => {
              const roomItems = getItemsForRoom(room.id);

              return (
                <div
                  key={room.id}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          {formatRoom(room)}
                        </h2>

                        <p className="mt-1 text-sm text-slate-600">
                          Grade Level: {room.grade_level || "N/A"}
                        </p>
                      </div>

                      {canEditNow && (
                        <span
                          className={
                            room.teacher_can_edit
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                              : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                          }
                        >
                          Change{" "}
                          {room.teacher_can_edit ? "Allowed" : "Not Allowed"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px] border-collapse text-sm">
                      <thead className="bg-slate-50">
                        <tr>
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
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {roomItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-4 py-6 text-center text-sm text-slate-500"
                            >
                              No declared items in this room yet.
                            </td>
                          </tr>
                        ) : (
                          roomItems.map((item) => {
                            const isEditing = editingItemId === item.id;

                            return (
                              <tr key={item.id} className="hover:bg-slate-50">
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
                                        setEditSchoolReportCategory(
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                                    >
                                      {schoolReportCategoryOptions.map(
                                        (option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        )
                                      )}
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
                                    item.condition
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
                                  ) : canEditNow && room.teacher_can_edit ? (
                                    <button
                                      type="button"
                                      onClick={() => startEdit(item)}
                                      className="rounded-md bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                                    >
                                      Edit
                                    </button>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-500">
                                      View only
                                    </span>
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
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}