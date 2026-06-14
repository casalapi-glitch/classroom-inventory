"use client";

import { FormEvent, useEffect, useState } from "react";
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

export default function TeacherAddItemPage() {
  const router = useRouter();

  const [teacherUserId, setTeacherUserId] = useState("");
  const [teacherName, setTeacherName] = useState("");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const [addWindow, setAddWindow] = useState<InventoryAccessWindow | null>(null);

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [schoolReportCategory, setSchoolReportCategory] = useState("Other");
  const [serialNumber, setSerialNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("Good");
  const [itemSource, setItemSource] = useState("Personal");
  const [remarks, setRemarks] = useState("");

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
    loadTeacherRooms();
  }, []);

  async function loadTeacherRooms() {
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

    const { data: addWindowData, error: addWindowError } = await supabase
      .from("inventory_access_windows")
      .select("action_type, starts_at, ends_at, is_enabled")
      .eq("action_type", "add")
      .maybeSingle();

    if (addWindowError) {
      showMessage(addWindowError.message);
      setLoading(false);
      return;
    }

    setAddWindow(addWindowData as InventoryAccessWindow | null);

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

    const assignedRooms = assignments
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

    assignedRooms.sort((a, b) => {
      const roomA = `${a.building_number || a.building_name}-${a.floor_number}-${a.room_number}`;
      const roomB = `${b.building_number || b.building_name}-${b.floor_number}-${b.room_number}`;

      return roomA.localeCompare(roomB);
    });

    setRooms(assignedRooms);

    const firstAllowedRoom = assignedRooms.find((room) => room.teacher_can_add);

    if (firstAllowedRoom) {
      setSelectedRoomId(firstAllowedRoom.id);
    } else if (assignedRooms.length > 0) {
      setSelectedRoomId(assignedRooms[0].id);
    }

    setLoading(false);
  }

  function getSelectedRoom() {
    return rooms.find((room) => room.id === selectedRoomId) || null;
  }

  function resetForm() {
    setItemName("");
    setCategory("");
    setSchoolReportCategory("Other");
    setSerialNumber("");
    setQuantity("1");
    setCondition("Good");
    setItemSource("Personal");
    setRemarks("");
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const selectedRoom = getSelectedRoom();

    if (!isWindowOpen(addWindow)) {
      showMessage("Add Inventory is currently closed by the admin.");
      return;
    }

    if (!selectedRoom) {
      showMessage("Please select a room.");
      return;
    }

    if (!selectedRoom.teacher_can_add) {
      showMessage("You are not allowed to add inventory items to this room.");
      return;
    }

    if (!itemName.trim()) {
      showMessage("Please enter the item name.");
      return;
    }

    if (!category.trim()) {
      showMessage("Please enter the general category.");
      return;
    }

    if (!schoolReportCategory.trim()) {
      showMessage("Please choose the school report category.");
      return;
    }

    const quantityNumber = Number(quantity);

    if (!quantityNumber || quantityNumber <= 0) {
      showMessage("Quantity must be greater than 0.");
      return;
    }

    if (!condition.trim()) {
      showMessage("Please choose the condition.");
      return;
    }

    if (!itemSource.trim()) {
      showMessage("Please choose the item source.");
      return;
    }

    if (!remarks.trim()) {
      showMessage("Please enter remarks. If there are no remarks, type N/A.");
      return;
    }

    setSaving(true);

    const { data: newItem, error } = await supabase
      .from("inventory_items")
      .insert({
        room_id: selectedRoom.id,
        original_room_id: selectedRoom.id,
        item_name: itemName.trim(),
        category: category.trim(),
        school_report_category: schoolReportCategory,
        serial_number: serialNumber.trim() || null,
        quantity: quantityNumber,
        condition,
        item_source: itemSource,
        remarks: remarks.trim(),
        added_by: teacherUserId,
      })
      .select("id")
      .single();

    if (error) {
      showMessage(error.message);
      setSaving(false);
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: teacherUserId,
      action: "Teacher added inventory item",
      room_id: selectedRoom.id,
      item_id: newItem.id,
      details: `${teacherName} added ${itemName.trim()} to ${formatRoom(
        selectedRoom
      )}.`,
    });

    resetForm();
    showMessage("Inventory item added successfully.");

    setSaving(false);
  }

  const selectedRoom = getSelectedRoom();
  const allowedRooms = rooms.filter((room) => room.teacher_can_add);
  const canAddNow = isWindowOpen(addWindow);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading add inventory form...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              School Property Inventory System
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Add Inventory Record
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Declare classroom inventory items assigned to your account.
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

      <section className="mx-auto max-w-5xl px-6 py-6">
        {message && (
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Add Inventory Access
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                {canAddNow && addWindow
                  ? `Open until ${formatDateTime(addWindow.ends_at)}`
                  : "Currently closed by the admin."}
              </p>
            </div>

            <span
              className={
                canAddNow
                  ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                  : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
              }
            >
              {canAddNow ? "Open" : "Closed"}
            </span>
          </div>
        </div>

        {!canAddNow && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            Add Inventory is currently closed. You cannot submit new inventory
            records until the admin opens access.
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
            No rooms are assigned to your account yet.
          </div>
        ) : allowedRooms.length === 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            You have assigned rooms, but none of them allow adding inventory items.
          </div>
        ) : (
          <form
            onSubmit={handleAddItem}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Item Details
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Fields marked with an asterisk are required. Serial number is optional.
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Assigned Room *
                </label>

                <select
                  value={selectedRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Choose a room</option>

                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {formatRoom(room)} — Add:{" "}
                      {room.teacher_can_add ? "Allowed" : "Not Allowed"}
                    </option>
                  ))}
                </select>

                {selectedRoom && (
                  <p className="mt-2 text-xs text-slate-500">
                    Selected: {formatRoom(selectedRoom)} | Grade{" "}
                    {selectedRoom.grade_level || "N/A"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Item Name *
                </label>

                <input
                  type="text"
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: Armchair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  General Category *
                </label>

                <input
                  type="text"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: Furniture"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  School Report Category *
                </label>

                <select
                  value={schoolReportCategory}
                  onChange={(event) => setSchoolReportCategory(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                >
                  {schoolReportCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Serial Number
                </label>

                <input
                  type="text"
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Quantity *
                </label>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Condition *
                </label>

                <select
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                >
                  {conditionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Item Source *
                </label>

                <select
                  value={itemSource}
                  onChange={(event) => setItemSource(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                >
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Remarks *
                </label>

                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="If there are no remarks, type N/A."
                  rows={4}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving || !selectedRoom?.teacher_can_add || !canAddNow}
                className="rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Submit Inventory Record"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}