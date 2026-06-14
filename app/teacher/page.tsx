"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";

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

type AccessModal = {
  title: string;
  message: string;
  href?: string;
};

function formatRoom(room: Room) {
  return `Building ${room.building_number || room.building_name}, Floor ${
    room.floor_number || "N/A"
  }, Room ${room.room_number}`;
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

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [teacherName, setTeacherName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);

  const [addWindow, setAddWindow] = useState<InventoryAccessWindow | null>(null);
  const [editWindow, setEditWindow] = useState<InventoryAccessWindow | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [accessModal, setAccessModal] = useState<AccessModal | null>(null);

  useEffect(() => {
    loadTeacherDashboard();
  }, []);

  async function loadTeacherDashboard() {
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
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "teacher") {
      router.push("/login");
      return;
    }

    setTeacherName(profile.full_name);

    const { data: windowData, error: windowError } = await supabase
      .from("inventory_access_windows")
      .select("action_type, starts_at, ends_at, is_enabled")
      .in("action_type", ["add", "edit"]);

    if (windowError) {
      setMessage(windowError.message);
      setLoading(false);
      return;
    }

    const accessWindows = (windowData || []) as InventoryAccessWindow[];

    setAddWindow(
      accessWindows.find((windowItem) => windowItem.action_type === "add") ||
        null
    );

    setEditWindow(
      accessWindows.find((windowItem) => windowItem.action_type === "edit") ||
        null
    );

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
      setMessage(assignmentError.message);
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
    setLoading(false);
  }

  function openAddInventory() {
    if (!isWindowOpen(addWindow)) {
      setAccessModal({
        title: "Add Inventory Closed",
        message:
          "Add Inventory is currently closed by the admin. You cannot add new inventory records at this time.",
      });

      return;
    }

    setAccessModal({
      title: "Add Inventory Reminder",
      message: `Add Inventory is open until ${formatDateTime(
        addWindow!.ends_at
      )}. Please submit your records before the deadline.`,
      href: "/teacher/add-item",
    });
  }

  function openEditInventory() {
    if (!isWindowOpen(editWindow)) {
      setAccessModal({
        title: "Change Inventory Closed",
        message:
          "Change/Edit Inventory is currently closed by the admin. You cannot change inventory records at this time.",
      });

      return;
    }

    setAccessModal({
      title: "Change Inventory Reminder",
      message: `Change/Edit Inventory is open until ${formatDateTime(
        editWindow!.ends_at
      )}. Please finish your changes before the deadline.`,
      href: "/teacher/my-room",
    });
  }

  function continueFromModal() {
    if (accessModal?.href) {
      router.push(accessModal.href);
      return;
    }

    setAccessModal(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading teacher dashboard...
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
              Teacher Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Welcome, {teacherName}.
            </p>
          </div>

          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-6">
        {message && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {message}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Assigned Rooms
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              You are assigned to {rooms.length} room/s.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Access Status
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={
                  isWindowOpen(addWindow)
                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                    : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                }
              >
                Add: {isWindowOpen(addWindow) ? "Open" : "Closed"}
              </span>

              <span
                className={
                  isWindowOpen(editWindow)
                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                    : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                }
              >
                Change: {isWindowOpen(editWindow) ? "Open" : "Closed"}
              </span>
            </div>
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
            No room has been assigned to your account yet.
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Room Assignments
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Your assigned rooms and permissions are listed below.
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatRoom(room)}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Grade Level: {room.grade_level || "N/A"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
  {isWindowOpen(addWindow) && (
    <span
      className={
        room.teacher_can_add
          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
          : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
      }
    >
      Add {room.teacher_can_add ? "Allowed" : "Not Allowed"}
    </span>
  )}

  {isWindowOpen(editWindow) && (
    <span
      className={
        room.teacher_can_edit
          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
          : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
      }
    >
      Change {room.teacher_can_edit ? "Allowed" : "Not Allowed"}
    </span>
  )}

  {!isWindowOpen(addWindow) && !isWindowOpen(editWindow) && (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      Inventory access is currently closed
    </span>
  )}
</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={openAddInventory}
            className="rounded-lg border border-blue-800 bg-blue-800 px-5 py-4 text-left text-sm font-semibold text-white shadow-sm hover:bg-blue-900"
          >
            Add Inventory Record
            <span className="mt-1 block text-xs font-normal text-blue-100">
              Add newly declared classroom inventory.
            </span>
          </button>

          <button
            type="button"
            onClick={openEditInventory}
            className="rounded-lg border border-slate-300 bg-white px-5 py-4 text-left text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Change Inventory Record
            <span className="mt-1 block text-xs font-normal text-slate-500">
              View assigned rooms and update declared records.
            </span>
          </button>
        </div>
      </section>

      {accessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {accessModal.title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-700">
              {accessModal.message}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAccessModal(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={continueFromModal}
                className={
                  accessModal.href
                    ? "rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                    : "rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                }
              >
                {accessModal.href ? "Continue" : "Okay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}