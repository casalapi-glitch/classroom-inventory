"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type IntendedUsage = "Instructional" | "Non-Instructional" | "Combined";

type Room = {
  id: string;
  building_name: string;
  building_number: string | null;
  floor_number: string | null;
  room_number: string;
  grade_level: string | null;
  room_condition: string | null;
  room_usage: string | null;
  actual_usage: string | null;
};

const intendedUsageOptions: IntendedUsage[] = [
  "Instructional",
  "Non-Instructional",
  "Combined",
];

const instructionalActualUsageOptions = [
  "Classroom SPED",
  "Classroom Elementary",
  "ALS Room",
  "Audio Visual",
  "Computer Room",
  "Industrial Arts Room",
  "Home Economics Room",
  "Science Laboratory",
  "Speech Laboratory",
  "Research Laboratory",
  "Not Currently Used",
  "Others",
];

const nonInstructionalActualUsageOptions = [
  "Library/Learning Resource Center",
  "Canteen",
  "Clinic",
  "Conference Room",
  "Offices",
  "Faculty Room",
  "Museum",
  "Supply Room",
  "Data File Room/Records Room",
  "Student Co-Curricular Center",
  "Youth Development Center",
  "Not Currently Used",
  "Others",
];

const actualUsageOptionsByIntended: Record<IntendedUsage, string[]> = {
  Instructional: instructionalActualUsageOptions,
  "Non-Instructional": nonInstructionalActualUsageOptions,
  Combined: instructionalActualUsageOptions,
};

const gradeLevelOptions = [
  "",
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
];

const roomConditionOptions = [
  "Good Condition",
  "Needs Minor Repair",
  "Needs Major Repair",
  "For Condemnation",
  "Condemned/For Demolition",
];

function normalizeIntendedUsage(value: string | null): IntendedUsage {
  if (
    value === "Instructional" ||
    value === "Non-Instructional" ||
    value === "Combined"
  ) {
    return value;
  }

  if (
    value === "Office" ||
    value === "Storage" ||
    value === "Clinic" ||
    value === "Canteen"
  ) {
    return "Non-Instructional";
  }

  return "Instructional";
}

function shouldShowGradeLevel(intendedUsage: IntendedUsage) {
  return intendedUsage !== "Non-Instructional";
}

function buildActualUsageValue(
  usageType: IntendedUsage,
  normalActualUsage: string,
  combinedText: string,
  combinedInstructional: string
) {
  if (usageType === "Combined") {
    return `${combinedText.trim()} / ${combinedInstructional}`;
  }

  return normalActualUsage;
}

function splitCombinedActualUsage(value: string | null) {
  if (!value || !value.includes("/")) {
    return {
      firstPart: "",
      instructionalPart: "Classroom Elementary",
    };
  }

  const parts = value.split("/");

  return {
    firstPart: parts[0].trim(),
    instructionalPart: parts.slice(1).join("/").trim() || "Classroom Elementary",
  };
}

function formatRoom(room: Room) {
  return `Building ${room.building_number || room.building_name}, Floor ${
    room.floor_number || "N/A"
  }, Room ${room.room_number}`;
}

function getConditionBadgeClass(condition: string | null) {
  if (condition === "Good Condition") {
    return "border border-green-200 bg-green-50 text-green-700";
  }

  if (condition === "Needs Minor Repair") {
    return "border border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  if (condition === "Needs Major Repair") {
    return "border border-orange-200 bg-orange-50 text-orange-700";
  }

  if (
    condition === "For Condemnation" ||
    condition === "Condemned/For Demolition"
  ) {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminRoomsPage() {
  const router = useRouter();

  const [adminUserId, setAdminUserId] = useState("");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("All");
  const [intendedUsageFilter, setIntendedUsageFilter] = useState("All");
  const [actualUsageFilter, setActualUsageFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");

  const [buildingNumber, setBuildingNumber] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [intendedUsage, setIntendedUsage] =
    useState<IntendedUsage>("Instructional");
  const [actualUsage, setActualUsage] = useState("Classroom Elementary");
  const [combinedUsageText, setCombinedUsageText] = useState("");
  const [combinedInstructionalUsage, setCombinedInstructionalUsage] =
    useState("Classroom Elementary");
  const [gradeLevel, setGradeLevel] = useState("");
  const [roomCondition, setRoomCondition] = useState("Good Condition");

  const [editingRoomId, setEditingRoomId] = useState("");

  const [editBuildingNumber, setEditBuildingNumber] = useState("");
  const [editFloorNumber, setEditFloorNumber] = useState("");
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editIntendedUsage, setEditIntendedUsage] =
    useState<IntendedUsage>("Instructional");
  const [editActualUsage, setEditActualUsage] =
    useState("Classroom Elementary");
  const [editCombinedUsageText, setEditCombinedUsageText] = useState("");
  const [editCombinedInstructionalUsage, setEditCombinedInstructionalUsage] =
    useState("Classroom Elementary");
  const [editGradeLevel, setEditGradeLevel] = useState("");
  const [editRoomCondition, setEditRoomCondition] =
    useState("Good Condition");

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
    loadRooms();
  }, []);

  async function loadRooms() {
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

    const { data, error } = await supabase
      .from("rooms")
      .select(`
        id,
        building_name,
        building_number,
        floor_number,
        room_number,
        grade_level,
        room_condition,
        room_usage,
        actual_usage
      `)
      .order("building_number", { ascending: true })
      .order("floor_number", { ascending: true })
      .order("room_number", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setRooms((data || []) as Room[]);
    setLoading(false);
  }

  function handleIntendedUsageChange(value: IntendedUsage) {
    setIntendedUsage(value);

    if (value === "Instructional") {
      setActualUsage(instructionalActualUsageOptions[0]);
      setCombinedUsageText("");
      setCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }

    if (value === "Non-Instructional") {
      setActualUsage(nonInstructionalActualUsageOptions[0]);
      setGradeLevel("");
      setCombinedUsageText("");
      setCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }

    if (value === "Combined") {
      setActualUsage("");
      setCombinedUsageText("");
      setCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }
  }

  function handleEditIntendedUsageChange(value: IntendedUsage) {
    setEditIntendedUsage(value);

    if (value === "Instructional") {
      setEditActualUsage(instructionalActualUsageOptions[0]);
      setEditCombinedUsageText("");
      setEditCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }

    if (value === "Non-Instructional") {
      setEditActualUsage(nonInstructionalActualUsageOptions[0]);
      setEditGradeLevel("");
      setEditCombinedUsageText("");
      setEditCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }

    if (value === "Combined") {
      setEditActualUsage("");
      setEditCombinedUsageText("");
      setEditCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }
  }

  function resetAddForm() {
    setBuildingNumber("");
    setFloorNumber("");
    setRoomNumber("");
    setIntendedUsage("Instructional");
    setActualUsage("Classroom Elementary");
    setCombinedUsageText("");
    setCombinedInstructionalUsage("Classroom Elementary");
    setGradeLevel("");
    setRoomCondition("Good Condition");
  }

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

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

    if (intendedUsage === "Combined" && !combinedUsageText.trim()) {
      showMessage("Please enter the first part of the combined actual usage.");
      return;
    }

    const duplicateRoom = rooms.find(
      (room) =>
        (room.building_number || room.building_name) ===
          buildingNumber.trim() &&
        room.floor_number === floorNumber.trim() &&
        room.room_number === roomNumber.trim()
    );

    if (duplicateRoom) {
      showMessage("This room already exists.");
      return;
    }

    setSaving(true);

    const cleanGradeLevel = shouldShowGradeLevel(intendedUsage)
      ? gradeLevel.trim() || null
      : null;

    const finalActualUsage = buildActualUsageValue(
      intendedUsage,
      actualUsage,
      combinedUsageText,
      combinedInstructionalUsage
    );

    const { data: newRoom, error } = await supabase
      .from("rooms")
      .insert({
        building_name: buildingNumber.trim(),
        building_number: buildingNumber.trim(),
        floor_number: floorNumber.trim(),
        room_number: roomNumber.trim(),
        grade_level: cleanGradeLevel,
        room_condition: roomCondition,
        room_usage: intendedUsage,
        actual_usage: finalActualUsage,
      })
      .select("id")
      .single();

    if (error) {
      showMessage(error.message);
      setSaving(false);
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId,
      action: "Admin added room",
      room_id: newRoom.id,
      details: `Admin added Building ${buildingNumber.trim()}, Floor ${floorNumber.trim()}, Room ${roomNumber.trim()}.`,
    });

    resetAddForm();
    await loadRooms();

    showMessage("Room added successfully.");
    setSaving(false);
  }

  function startEdit(room: Room) {
    const normalizedUsage = normalizeIntendedUsage(room.room_usage);
    const actualOptions = actualUsageOptionsByIntended[normalizedUsage];

    setEditingRoomId(room.id);
    setEditBuildingNumber(room.building_number || room.building_name);
    setEditFloorNumber(room.floor_number || "");
    setEditRoomNumber(room.room_number);
    setEditIntendedUsage(normalizedUsage);

    if (normalizedUsage === "Combined") {
      const combinedParts = splitCombinedActualUsage(room.actual_usage);

      setEditActualUsage("");
      setEditCombinedUsageText(combinedParts.firstPart);
      setEditCombinedInstructionalUsage(
        instructionalActualUsageOptions.includes(combinedParts.instructionalPart)
          ? combinedParts.instructionalPart
          : instructionalActualUsageOptions[0]
      );
    } else {
      setEditActualUsage(
        actualOptions.includes(room.actual_usage || "")
          ? room.actual_usage || actualOptions[0]
          : actualOptions[0]
      );

      setEditCombinedUsageText("");
      setEditCombinedInstructionalUsage(instructionalActualUsageOptions[0]);
    }

    setEditGradeLevel(
      normalizedUsage === "Non-Instructional" ? "" : room.grade_level || ""
    );
    setEditRoomCondition(room.room_condition || "Good Condition");
  }

  function cancelEdit() {
    setEditingRoomId("");
    setEditBuildingNumber("");
    setEditFloorNumber("");
    setEditRoomNumber("");
    setEditIntendedUsage("Instructional");
    setEditActualUsage("Classroom Elementary");
    setEditCombinedUsageText("");
    setEditCombinedInstructionalUsage("Classroom Elementary");
    setEditGradeLevel("");
    setEditRoomCondition("Good Condition");
  }

  async function saveEdit(room: Room) {
    setMessage("");

    if (!editBuildingNumber.trim()) {
      showMessage("Please enter the building number.");
      return;
    }

    if (!editFloorNumber.trim()) {
      showMessage("Please enter the floor number.");
      return;
    }

    if (!editRoomNumber.trim()) {
      showMessage("Please enter the room number.");
      return;
    }

    if (editIntendedUsage === "Combined" && !editCombinedUsageText.trim()) {
      showMessage("Please enter the first part of the combined actual usage.");
      return;
    }

    const duplicateRoom = rooms.find(
      (existingRoom) =>
        existingRoom.id !== room.id &&
        (existingRoom.building_number || existingRoom.building_name) ===
          editBuildingNumber.trim() &&
        existingRoom.floor_number === editFloorNumber.trim() &&
        existingRoom.room_number === editRoomNumber.trim()
    );

    if (duplicateRoom) {
      showMessage(
        "Another room already uses this building, floor, and room number."
      );
      return;
    }

    const cleanGradeLevel = shouldShowGradeLevel(editIntendedUsage)
      ? editGradeLevel.trim() || null
      : null;

    const finalEditActualUsage = buildActualUsageValue(
      editIntendedUsage,
      editActualUsage,
      editCombinedUsageText,
      editCombinedInstructionalUsage
    );

    const { error } = await supabase
      .from("rooms")
      .update({
        building_name: editBuildingNumber.trim(),
        building_number: editBuildingNumber.trim(),
        floor_number: editFloorNumber.trim(),
        room_number: editRoomNumber.trim(),
        grade_level: cleanGradeLevel,
        room_condition: editRoomCondition,
        room_usage: editIntendedUsage,
        actual_usage: finalEditActualUsage,
      })
      .eq("id", room.id);

    if (error) {
      showMessage(error.message);
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId,
      action: "Admin updated room",
      room_id: room.id,
      details: `Admin updated ${formatRoom(room)}.`,
    });

    cancelEdit();
    await loadRooms();

    showMessage("Room updated successfully.");
  }

  async function deleteRoom(room: Room) {
    const confirmed = window.confirm(
      `Delete ${formatRoom(room)}? This will only work if the room has no assigned records.`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");

    const { error } = await supabase.from("rooms").delete().eq("id", room.id);

    if (error) {
      showMessage(
        "Room could not be deleted. It may still have inventory records or teacher assignments."
      );
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId,
      action: "Admin deleted room",
      room_id: null,
      details: `Admin deleted ${formatRoom(room)}.`,
    });

    await loadRooms();

    showMessage("Room deleted successfully.");
  }

  const buildingOptions = useMemo(() => {
    const values = rooms
      .map((room) => room.building_number || room.building_name)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [rooms]);

  const actualUsageOptions = useMemo(() => {
    const values = rooms
      .map((room) => room.actual_usage || "Unspecified")
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [rooms]);

  const conditionOptions = useMemo(() => {
    const values = rooms
      .map((room) => room.room_condition || "Unspecified")
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return rooms.filter((room) => {
      const buildingValue = room.building_number || room.building_name;
      const normalizedUsage = normalizeIntendedUsage(room.room_usage);
      const actualUsageValue = room.actual_usage || "Unspecified";
      const conditionValue = room.room_condition || "Unspecified";

      const matchesSearch =
        !keyword ||
        `${formatRoom(room)} ${room.grade_level || ""} ${normalizedUsage} ${
          room.actual_usage || ""
        } ${conditionValue}`
          .toLowerCase()
          .includes(keyword);

      const matchesBuilding =
        buildingFilter === "All" || buildingValue === buildingFilter;

      const matchesIntendedUsage =
        intendedUsageFilter === "All" || normalizedUsage === intendedUsageFilter;

      const matchesActualUsage =
        actualUsageFilter === "All" || actualUsageValue === actualUsageFilter;

      const matchesCondition =
        conditionFilter === "All" || conditionValue === conditionFilter;

      return (
        matchesSearch &&
        matchesBuilding &&
        matchesIntendedUsage &&
        matchesActualUsage &&
        matchesCondition
      );
    });
  }, [
    rooms,
    searchTerm,
    buildingFilter,
    intendedUsageFilter,
    actualUsageFilter,
    conditionFilter,
  ]);

  const needsAttentionCount = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.room_condition === "Needs Minor Repair" ||
        room.room_condition === "Needs Major Repair" ||
        room.room_condition === "For Condemnation" ||
        room.room_condition === "Condemned/For Demolition"
    ).length;
  }, [rooms]);

  const instructionalCount = useMemo(() => {
    return rooms.filter(
      (room) => normalizeIntendedUsage(room.room_usage) === "Instructional"
    ).length;
  }, [rooms]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-7xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading rooms...
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
              Manage Rooms
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Add, update, and organize school room records.
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
              Total Rooms
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {rooms.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Displayed
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {filteredRooms.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Instructional
            </p>
            <p className="mt-2 text-2xl font-semibold text-blue-700">
              {instructionalCount}
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

        <form
          onSubmit={addRoom}
          className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Add New Room
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Create a room record before assigning teachers or inventory.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Building Number *
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
                Floor Number *
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
                Room Number *
              </label>

              <input
                type="text"
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: 201"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Room Condition
              </label>

              <select
                value={roomCondition}
                onChange={(event) => setRoomCondition(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {roomConditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Intended Usage *
              </label>

              <select
                value={intendedUsage}
                onChange={(event) =>
                  handleIntendedUsageChange(event.target.value as IntendedUsage)
                }
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {intendedUsageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {intendedUsage === "Combined" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Combined Usage — First Part *
                  </label>

                  <input
                    type="text"
                    value={combinedUsageText}
                    onChange={(event) =>
                      setCombinedUsageText(event.target.value)
                    }
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                    placeholder="Example: Faculty Room"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Combined Usage — Instructional Part *
                  </label>

                  <select
                    value={combinedInstructionalUsage}
                    onChange={(event) =>
                      setCombinedInstructionalUsage(event.target.value)
                    }
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    {instructionalActualUsageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Actual Usage *
                </label>

                <select
                  value={actualUsage}
                  onChange={(event) => setActualUsage(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  {actualUsageOptionsByIntended[intendedUsage].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {shouldShowGradeLevel(intendedUsage) && (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Grade Level
                </label>

                <select
                  value={gradeLevel}
                  onChange={(event) => setGradeLevel(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  {gradeLevelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "" ? "Select grade level" : option}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Add Room"}
            </button>
          </div>
        </form>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Search
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Search room..."
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
                Intended Usage
              </label>

              <select
                value={intendedUsageFilter}
                onChange={(event) => setIntendedUsageFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="All">All Intended Usage</option>
                {intendedUsageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Actual Usage
              </label>

              <select
                value={actualUsageFilter}
                onChange={(event) => setActualUsageFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {actualUsageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Actual Usage" : option}
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
                {conditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Conditions" : option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Building Number
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Floor
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Room
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Intended Usage
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Actual Usage
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Grade Level
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Condition
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No rooms found.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => {
                    const isEditing = editingRoomId === room.id;
                    const normalizedUsage = normalizeIntendedUsage(
                      room.room_usage
                    );

                    return (
                      <tr key={room.id} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editBuildingNumber}
                              onChange={(event) =>
                                setEditBuildingNumber(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            room.building_number || room.building_name
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFloorNumber}
                              onChange={(event) =>
                                setEditFloorNumber(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            room.floor_number || ""
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRoomNumber}
                              onChange={(event) =>
                                setEditRoomNumber(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            room.room_number
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <select
                              value={editIntendedUsage}
                              onChange={(event) =>
                                handleEditIntendedUsageChange(
                                  event.target.value as IntendedUsage
                                )
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {intendedUsageOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            normalizedUsage
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            editIntendedUsage === "Combined" ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editCombinedUsageText}
                                  onChange={(event) =>
                                    setEditCombinedUsageText(event.target.value)
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                                  placeholder="Example: Faculty Room"
                                />

                                <select
                                  value={editCombinedInstructionalUsage}
                                  onChange={(event) =>
                                    setEditCombinedInstructionalUsage(
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                                >
                                  {instructionalActualUsageOptions.map(
                                    (option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            ) : (
                              <select
                                value={editActualUsage}
                                onChange={(event) =>
                                  setEditActualUsage(event.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                              >
                                {actualUsageOptionsByIntended[
                                  editIntendedUsage
                                ].map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            )
                          ) : (
                            room.actual_usage || ""
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            shouldShowGradeLevel(editIntendedUsage) ? (
                              <select
                                value={editGradeLevel}
                                onChange={(event) =>
                                  setEditGradeLevel(event.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                              >
                                {gradeLevelOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option === ""
                                      ? "Select grade level"
                                      : option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Not applicable
                              </span>
                            )
                          ) : normalizedUsage === "Non-Instructional" ? (
                            <span className="text-xs text-slate-500">
                              Not applicable
                            </span>
                          ) : (
                            room.grade_level || ""
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {isEditing ? (
                            <select
                              value={editRoomCondition}
                              onChange={(event) =>
                                setEditRoomCondition(event.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            >
                              {roomConditionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${getConditionBadgeClass(
                                room.room_condition
                              )}`}
                            >
                              {room.room_condition || "Unspecified"}
                            </span>
                          )}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(room)}
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
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(room)}
                                className="rounded-md bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteRoom(room)}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
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