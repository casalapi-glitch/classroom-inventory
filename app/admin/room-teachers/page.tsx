"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Room = {
  id: string;
  building_name: string;
  building_number: string | null;
  floor_number: string | null;
  room_number: string;
  grade_level: string | null;
  room_usage: string | null;
  actual_usage: string | null;
};

type TeacherProfile = {
  id: string;
  full_name: string;
  email: string;
};

type Assignment = {
  id: string | null;
  room_id: string;
  teacher_id: string;
  teacher_can_add: boolean;
  teacher_can_edit: boolean;
  teacher: TeacherProfile;
};

type AssignmentRow = {
  id: string;
  room_id: string;
  teacher_id: string;
  teacher_can_add: boolean;
  teacher_can_edit: boolean;
  profiles: TeacherProfile | null;
};

function formatRoom(room: Room | null) {
  if (!room) {
    return "No room selected";
  }

  return `Building ${room.building_number || room.building_name}, Floor ${
    room.floor_number || "N/A"
  }, Room ${room.room_number}`;
}

export default function AdminRoomTeachersPage() {
  const router = useRouter();

  const [adminUserId, setAdminUserId] = useState("");

  const [buildingNumber, setBuildingNumber] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [deletedAssignmentIds, setDeletedAssignmentIds] = useState<string[]>([]);

  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherResults, setTeacherResults] = useState<TeacherProfile[]>([]);

  const [loadingRoom, setLoadingRoom] = useState(false);
  const [searchingTeachers, setSearchingTeachers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [hasChanges, setHasChanges] = useState(false);
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

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return null;
    }

    setAdminUserId(user.id);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile || profile.role !== "admin") {
      router.push("/login");
      return null;
    }

    return user.id;
  }

  async function findRoom() {
    setMessage("");
    setSelectedRoom(null);
    setAssignments([]);
    setDeletedAssignmentIds([]);
    setTeacherResults([]);
    setHasChanges(false);

    if (!buildingNumber.trim()) {
      showMessage("Please enter the building number.");
      return;
    }

    if (!floorNumber.trim()) {
      showMessage("Please enter the floor number.");
      return;
    }

    if (!roomNumber.trim()) {
      showMessage("Please enter the room number.");
      return;
    }

    setLoadingRoom(true);

    const adminId = await checkAdmin();

    if (!adminId) {
      setLoadingRoom(false);
      return;
    }

    const roomColumns = `
      id,
      building_name,
      building_number,
      floor_number,
      room_number,
      grade_level,
      room_usage,
      actual_usage
    `;

    const firstSearch = await supabase
      .from("rooms")
      .select(roomColumns)
      .eq("building_number", buildingNumber.trim())
      .eq("floor_number", floorNumber.trim())
      .eq("room_number", roomNumber.trim())
      .maybeSingle();

    let foundRoom = firstSearch.data as Room | null;

    if (!foundRoom) {
      const secondSearch = await supabase
        .from("rooms")
        .select(roomColumns)
        .eq("building_name", buildingNumber.trim())
        .eq("floor_number", floorNumber.trim())
        .eq("room_number", roomNumber.trim())
        .maybeSingle();

      foundRoom = secondSearch.data as Room | null;
    }

    if (!foundRoom) {
      showMessage("Room not found. Please check the building, floor, and room number.");
      setLoadingRoom(false);
      return;
    }

    setSelectedRoom(foundRoom);
    await loadAssignments(foundRoom.id);

    showMessage("Room loaded successfully.");
    setLoadingRoom(false);
  }

  async function loadAssignments(roomId: string) {
    const { data, error } = await supabase
      .from("room_teacher_assignments")
      .select(`
        id,
        room_id,
        teacher_id,
        teacher_can_add,
        teacher_can_edit,
        profiles (
          id,
          full_name,
          email
        )
      `)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      showMessage(error.message);
      return;
    }

    const rows = (data || []) as unknown as AssignmentRow[];

    const cleanAssignments = rows
      .filter((row) => row.profiles)
      .map((row) => ({
        id: row.id,
        room_id: row.room_id,
        teacher_id: row.teacher_id,
        teacher_can_add: row.teacher_can_add,
        teacher_can_edit: row.teacher_can_edit,
        teacher: row.profiles!,
      }));

    setAssignments(cleanAssignments);
    setDeletedAssignmentIds([]);
    setHasChanges(false);
  }

  async function searchTeachers() {
    setMessage("");
    setTeacherResults([]);

    const searchValue = teacherSearch.trim();

    if (!selectedRoom) {
      showMessage("Please load a room first.");
      return;
    }

    if (searchValue.length < 2) {
      showMessage("Please type at least 2 characters to search for a teacher.");
      return;
    }

    setSearchingTeachers(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "teacher")
      .or(`full_name.ilike.%${searchValue}%,email.ilike.%${searchValue}%`)
      .order("full_name", { ascending: true })
      .limit(20);

    if (error) {
      showMessage(error.message);
      setSearchingTeachers(false);
      return;
    }

    const assignedTeacherIds = assignments.map(
      (assignment) => assignment.teacher_id
    );

    const availableTeachers = ((data || []) as TeacherProfile[]).filter(
      (teacher) => !assignedTeacherIds.includes(teacher.id)
    );

    setTeacherResults(availableTeachers);
    setSearchingTeachers(false);
  }

  function addTeacher(teacher: TeacherProfile) {
    if (!selectedRoom) {
      showMessage("Please load a room first.");
      return;
    }

    const alreadyAssigned = assignments.some(
      (assignment) => assignment.teacher_id === teacher.id
    );

    if (alreadyAssigned) {
      showMessage("This teacher is already assigned to the room.");
      return;
    }

    const newAssignment: Assignment = {
      id: null,
      room_id: selectedRoom.id,
      teacher_id: teacher.id,
      teacher_can_add: true,
      teacher_can_edit: true,
      teacher,
    };

    setAssignments((current) => [...current, newAssignment]);
    setTeacherResults((current) =>
      current.filter((result) => result.id !== teacher.id)
    );
    setHasChanges(true);
    setMessage("Teacher added locally. Click Save Changes to apply.");
  }

  function removeTeacher(assignment: Assignment) {
    if (assignment.id) {
      setDeletedAssignmentIds((current) => [...current, assignment.id!]);
    }

    setAssignments((current) =>
      current.filter((item) => item.teacher_id !== assignment.teacher_id)
    );
    setHasChanges(true);
    setMessage("Teacher removed locally. Click Save Changes to apply.");
  }

  function toggleCanAdd(teacherId: string) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.teacher_id === teacherId
          ? {
              ...assignment,
              teacher_can_add: !assignment.teacher_can_add,
            }
          : assignment
      )
    );

    setHasChanges(true);
  }

  function toggleCanEdit(teacherId: string) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.teacher_id === teacherId
          ? {
              ...assignment,
              teacher_can_edit: !assignment.teacher_can_edit,
            }
          : assignment
      )
    );

    setHasChanges(true);
  }

  async function saveChanges() {
    setMessage("");

    if (!selectedRoom) {
      showMessage("Please load a room first.");
      return;
    }

    setSaving(true);

    const adminId = await checkAdmin();

    if (!adminId) {
      setSaving(false);
      return;
    }

    if (deletedAssignmentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("room_teacher_assignments")
        .delete()
        .in("id", deletedAssignmentIds);

      if (deleteError) {
        showMessage(deleteError.message);
        setSaving(false);
        return;
      }
    }

    if (assignments.length > 0) {
      const assignmentPayload = assignments.map((assignment) => ({
        room_id: selectedRoom.id,
        teacher_id: assignment.teacher_id,
        teacher_can_add: assignment.teacher_can_add,
        teacher_can_edit: assignment.teacher_can_edit,
      }));

      const { error: upsertError } = await supabase
        .from("room_teacher_assignments")
        .upsert(assignmentPayload, {
          onConflict: "room_id,teacher_id",
        });

      if (upsertError) {
        showMessage(upsertError.message);
        setSaving(false);
        return;
      }
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId || adminId,
      action: "Admin updated room teacher assignments",
      room_id: selectedRoom.id,
      details: `Admin updated teacher assignments for ${formatRoom(selectedRoom)}.`,
    });

    await loadAssignments(selectedRoom.id);

    setTeacherSearch("");
    setTeacherResults([]);
    setHasChanges(false);
    setSaving(false);

    showMessage("Room teacher assignments saved successfully.");
  }

  const addAllowedCount = assignments.filter(
    (assignment) => assignment.teacher_can_add
  ).length;

  const editAllowedCount = assignments.filter(
    (assignment) => assignment.teacher_can_edit
  ).length;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              School Property Inventory System
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Manage Room Teachers
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Assign teachers to rooms and control add/change inventory access.
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

        {hasChanges && (
          <div className="mb-5 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
            You have unsaved changes. Click Save Changes before leaving this page.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assigned Teachers
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {assignments.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add Allowed
            </p>
            <p className="mt-2 text-2xl font-semibold text-green-700">
              {addAllowedCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Change Allowed
            </p>
            <p className="mt-2 text-2xl font-semibold text-blue-700">
              {editAllowedCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Room Status
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {selectedRoom ? "Room loaded" : "No room loaded"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Select Room
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Enter the exact building number, floor number, and room number.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Building Number
              </label>

              <input
                type="text"
                value={buildingNumber}
                onChange={(event) => setBuildingNumber(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Floor Number
              </label>

              <input
                type="text"
                value={floorNumber}
                onChange={(event) => setFloorNumber(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: 2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Room Number
              </label>

              <input
                type="text"
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: 201"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={findRoom}
                disabled={loadingRoom}
                className="w-full rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
              >
                {loadingRoom ? "Loading..." : "Load Room"}
              </button>
            </div>
          </div>
        </div>

        {selectedRoom && (
          <>
            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {formatRoom(selectedRoom)}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Intended Usage: {selectedRoom.room_usage || "N/A"} | Actual
                    Usage: {selectedRoom.actual_usage || "N/A"}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Grade Level: {selectedRoom.grade_level || "N/A"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving || !hasChanges}
                  className="rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Search Teacher
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Search by teacher name or email, then add them to this room.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={(event) => setTeacherSearch(event.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Type teacher name or email..."
                />

                <button
                  type="button"
                  onClick={searchTeachers}
                  disabled={searchingTeachers}
                  className="rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-slate-400"
                >
                  {searchingTeachers ? "Searching..." : "Search"}
                </button>
              </div>

              {teacherResults.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                  {teacherResults.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {teacher.full_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {teacher.email}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addTeacher(teacher)}
                        className="rounded-md bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800"
                      >
                        Add Teacher
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {teacherSearch.trim().length >= 2 &&
                !searchingTeachers &&
                teacherResults.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">
                    No available teacher results.
                  </p>
                )}
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Assigned Teachers
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Control whether each teacher can add or change inventory records
                  for this room.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                        Teacher
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                        Email
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                        Add Inventory
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                        Change Inventory
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-sm text-slate-500"
                        >
                          No teachers assigned to this room yet.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((assignment) => (
                        <tr
                          key={assignment.teacher_id}
                          className="hover:bg-slate-50"
                        >
                          <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">
                            {assignment.teacher.full_name}
                          </td>

                          <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                            {assignment.teacher.email}
                          </td>

                          <td className="border-b border-slate-100 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleCanAdd(assignment.teacher_id)}
                              className={
                                assignment.teacher_can_add
                                  ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                                  : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                              }
                            >
                              {assignment.teacher_can_add
                                ? "Allowed"
                                : "Not Allowed"}
                            </button>
                          </td>

                          <td className="border-b border-slate-100 px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleCanEdit(assignment.teacher_id)
                              }
                              className={
                                assignment.teacher_can_edit
                                  ? "rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                                  : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                              }
                            >
                              {assignment.teacher_can_edit
                                ? "Allowed"
                                : "Not Allowed"}
                            </button>
                          </td>

                          <td className="border-b border-slate-100 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeTeacher(assignment)}
                              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}