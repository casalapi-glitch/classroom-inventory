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
};

type InventoryItem = {
  id: string;
  room_id: string;
  original_room_id: string | null;
  item_name: string;
  category: string | null;
  school_report_category: string | null;
  serial_number: string | null;
  quantity: number;
  condition: string;
  item_source: string;
  remarks: string | null;
};

function formatRoom(room: Room | null) {
  if (!room) {
    return "No room selected";
  }

  return `Building ${room.building_number || room.building_name}, Floor ${
    room.floor_number || "N/A"
  }, Room ${room.room_number}`;
}

function roomFieldsComplete(
  buildingNumber: string,
  floorNumber: string,
  roomNumber: string
) {
  return (
    buildingNumber.trim() !== "" &&
    floorNumber.trim() !== "" &&
    roomNumber.trim() !== ""
  );
}

export default function AdminTransferPage() {
  const router = useRouter();

  const [adminUserId, setAdminUserId] = useState("");

  const [sourceBuildingNumber, setSourceBuildingNumber] = useState("");
  const [sourceFloorNumber, setSourceFloorNumber] = useState("");
  const [sourceRoomNumber, setSourceRoomNumber] = useState("");

  const [destinationBuildingNumber, setDestinationBuildingNumber] = useState("");
  const [destinationFloorNumber, setDestinationFloorNumber] = useState("");
  const [destinationRoomNumber, setDestinationRoomNumber] = useState("");

  const [sourceRoom, setSourceRoom] = useState<Room | null>(null);
  const [destinationRoom, setDestinationRoom] = useState<Room | null>(null);

  const [sourceItems, setSourceItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [transferRemarks, setTransferRemarks] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadingDestination, setLoadingDestination] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [sourceStatus, setSourceStatus] = useState("");
  const [destinationStatus, setDestinationStatus] = useState("");

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
    checkAdmin();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSourceRoomAndItems();
    }, 300);

    return () => clearTimeout(timer);
  }, [sourceBuildingNumber, sourceFloorNumber, sourceRoomNumber]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDestinationRoom();
    }, 300);

    return () => clearTimeout(timer);
  }, [destinationBuildingNumber, destinationFloorNumber, destinationRoomNumber]);

  async function checkAdmin() {
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile || profile.role !== "admin") {
      router.push("/login");
      return;
    }

    setLoading(false);
  }

  async function findRoom(
    buildingNumber: string,
    floorNumber: string,
    roomNumber: string
  ) {
    const cleanBuilding = buildingNumber.trim();
    const cleanFloor = floorNumber.trim();
    const cleanRoom = roomNumber.trim();

    const roomColumns = `
      id,
      building_name,
      building_number,
      floor_number,
      room_number,
      grade_level
    `;

    const firstSearch = await supabase
      .from("rooms")
      .select(roomColumns)
      .eq("building_number", cleanBuilding)
      .eq("floor_number", cleanFloor)
      .eq("room_number", cleanRoom)
      .maybeSingle();

    if (firstSearch.data) {
      return firstSearch.data as Room;
    }

    const secondSearch = await supabase
      .from("rooms")
      .select(roomColumns)
      .eq("building_name", cleanBuilding)
      .eq("floor_number", cleanFloor)
      .eq("room_number", cleanRoom)
      .maybeSingle();

    if (secondSearch.data) {
      return secondSearch.data as Room;
    }

    return null;
  }

  async function loadSourceRoomAndItems() {
    setSourceStatus("");
    setSourceRoom(null);
    setSourceItems([]);
    setSelectedItemId("");
    setTransferQuantity("1");

    if (
      !roomFieldsComplete(
        sourceBuildingNumber,
        sourceFloorNumber,
        sourceRoomNumber
      )
    ) {
      return;
    }

    setLoadingSource(true);

    const foundRoom = await findRoom(
      sourceBuildingNumber,
      sourceFloorNumber,
      sourceRoomNumber
    );

    if (!foundRoom) {
      setSourceStatus("Source room not found.");
      setLoadingSource(false);
      return;
    }

    setSourceRoom(foundRoom);
    setSourceStatus("Source room found.");

    const { data, error } = await supabase
      .from("inventory_items")
      .select(`
        id,
        room_id,
        original_room_id,
        item_name,
        category,
        school_report_category,
        serial_number,
        quantity,
        condition,
        item_source,
        remarks
      `)
      .eq("room_id", foundRoom.id)
      .gt("quantity", 0)
      .order("item_name", { ascending: true });

    if (error) {
      setSourceStatus(error.message);
      setLoadingSource(false);
      return;
    }

    const loadedItems = (data || []) as InventoryItem[];

    setSourceItems(loadedItems);

    if (loadedItems.length > 0) {
      setSelectedItemId(loadedItems[0].id);
      setTransferQuantity("1");
    }

    setLoadingSource(false);
  }

  async function loadDestinationRoom() {
    setDestinationStatus("");
    setDestinationRoom(null);

    if (
      !roomFieldsComplete(
        destinationBuildingNumber,
        destinationFloorNumber,
        destinationRoomNumber
      )
    ) {
      return;
    }

    setLoadingDestination(true);

    const foundRoom = await findRoom(
      destinationBuildingNumber,
      destinationFloorNumber,
      destinationRoomNumber
    );

    if (!foundRoom) {
      setDestinationStatus("Destination room not found.");
      setLoadingDestination(false);
      return;
    }

    setDestinationRoom(foundRoom);
    setDestinationStatus("Destination room found.");
    setLoadingDestination(false);
  }

  function getSelectedItem() {
    return sourceItems.find((item) => item.id === selectedItemId) || null;
  }

  async function callTransferFunction(
    item: InventoryItem,
    destination: Room,
    quantityNumber: number
  ) {
    const remarksValue = transferRemarks.trim() || "N/A";

    const attempts = [
      {
        p_item_id: item.id,
        p_destination_room_id: destination.id,
        p_transfer_quantity: quantityNumber,
        p_transferred_by: adminUserId,
        p_remarks: remarksValue,
      },
      {
        p_item_id: item.id,
        p_to_room_id: destination.id,
        p_quantity: quantityNumber,
        p_transferred_by: adminUserId,
        p_remarks: remarksValue,
      },
      {
        item_id_input: item.id,
        destination_room_id_input: destination.id,
        transfer_quantity_input: quantityNumber,
        transferred_by_input: adminUserId,
        remarks_input: remarksValue,
      },
    ];

    let lastError = "";

    for (const args of attempts) {
      const { error } = await supabase.rpc("transfer_inventory_item", args);

      if (!error) {
        return { success: true, error: "" };
      }

      lastError = error.message;
    }

    return {
      success: false,
      error:
        lastError ||
        "Transfer failed. Please check the transfer_inventory_item function.",
    };
  }

  async function handleTransfer() {
    setMessage("");

    const selectedItem = getSelectedItem();

    if (!sourceRoom) {
      showMessage("Please enter a valid source room.");
      return;
    }

    if (!destinationRoom) {
      showMessage("Please enter a valid destination room.");
      return;
    }

    if (sourceRoom.id === destinationRoom.id) {
      showMessage("Source room and destination room cannot be the same.");
      return;
    }

    if (!selectedItem) {
      showMessage("Please choose an item to transfer.");
      return;
    }

    const quantityNumber = Number(transferQuantity);

    if (!quantityNumber || quantityNumber <= 0) {
      showMessage("Transfer quantity must be greater than 0.");
      return;
    }

    if (quantityNumber > selectedItem.quantity) {
      showMessage(
        `You can only transfer up to ${selectedItem.quantity} available item(s).`
      );
      return;
    }

    setSaving(true);

    const result = await callTransferFunction(
      selectedItem,
      destinationRoom,
      quantityNumber
    );

    if (!result.success) {
      showMessage(result.error);
      setSaving(false);
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId,
      action: "Admin transferred inventory item",
      room_id: destinationRoom.id,
      item_id: selectedItem.id,
      details: `Transferred ${quantityNumber} ${selectedItem.item_name} from ${formatRoom(
        sourceRoom
      )} to ${formatRoom(destinationRoom)}.`,
    });

    setTransferRemarks("");
    setTransferQuantity("1");

    await loadSourceRoomAndItems();

    showMessage("Item transferred successfully.");
    setSaving(false);
  }

  const selectedItem = getSelectedItem();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Loading transfer page...
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
              Transfer Inventory Item
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Move inventory items from one room to another.
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
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Source Room
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Enter the room where the item is currently located.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Building
                </label>

                <input
                  type="text"
                  value={sourceBuildingNumber}
                  onChange={(event) =>
                    setSourceBuildingNumber(event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Floor
                </label>

                <input
                  type="text"
                  value={sourceFloorNumber}
                  onChange={(event) => setSourceFloorNumber(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Room
                </label>

                <input
                  type="text"
                  value={sourceRoomNumber}
                  onChange={(event) => setSourceRoomNumber(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: 201"
                />
              </div>
            </div>

            <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm">
              {loadingSource ? (
                <p className="font-medium text-slate-700">Searching room...</p>
              ) : sourceRoom ? (
                <div>
                  <p className="font-semibold text-green-800">{sourceStatus}</p>
                  <p className="mt-1 text-slate-700">{formatRoom(sourceRoom)}</p>
                  <p className="mt-1 text-slate-500">
                    Grade Level: {sourceRoom.grade_level || "N/A"}
                  </p>
                </div>
              ) : sourceStatus ? (
                <p className="font-semibold text-red-800">{sourceStatus}</p>
              ) : (
                <p className="text-slate-500">
                  Complete the source room fields to search.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Destination Room
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Enter the room where the item will be transferred.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Building
                </label>

                <input
                  type="text"
                  value={destinationBuildingNumber}
                  onChange={(event) =>
                    setDestinationBuildingNumber(event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Floor
                </label>

                <input
                  type="text"
                  value={destinationFloorNumber}
                  onChange={(event) =>
                    setDestinationFloorNumber(event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Room
                </label>

                <input
                  type="text"
                  value={destinationRoomNumber}
                  onChange={(event) =>
                    setDestinationRoomNumber(event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: 202"
                />
              </div>
            </div>

            <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm">
              {loadingDestination ? (
                <p className="font-medium text-slate-700">Searching room...</p>
              ) : destinationRoom ? (
                <div>
                  <p className="font-semibold text-green-800">
                    {destinationStatus}
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatRoom(destinationRoom)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Grade Level: {destinationRoom.grade_level || "N/A"}
                  </p>
                </div>
              ) : destinationStatus ? (
                <p className="font-semibold text-red-800">
                  {destinationStatus}
                </p>
              ) : (
                <p className="text-slate-500">
                  Complete the destination room fields to search.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Transfer Details
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Choose an available item from the source room and enter the quantity
              to transfer.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Item to Transfer
              </label>

              <select
                value={selectedItemId}
                onChange={(event) => {
                  setSelectedItemId(event.target.value);
                  setTransferQuantity("1");
                }}
                disabled={!sourceRoom || sourceItems.length === 0}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                {sourceItems.length === 0 ? (
                  <option value="">No items available</option>
                ) : (
                  sourceItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_name} — Qty: {item.quantity}
                      {item.serial_number ? ` — SN: ${item.serial_number}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Transfer Quantity
              </label>

              <input
                type="number"
                min="1"
                max={selectedItem?.quantity || 1}
                value={transferQuantity}
                onChange={(event) => setTransferQuantity(event.target.value)}
                disabled={!selectedItem}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />

              {selectedItem && (
                <p className="mt-2 text-xs text-slate-500">
                  Available quantity: {selectedItem.quantity}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Transfer Remarks
              </label>

              <input
                type="text"
                value={transferRemarks}
                onChange={(event) => setTransferRemarks(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: Moved to new classroom"
              />
            </div>
          </div>

          {selectedItem && (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <h3 className="font-semibold text-slate-900">Selected Item</h3>

              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <p className="text-slate-700">
                  <span className="font-medium">Name:</span>{" "}
                  {selectedItem.item_name}
                </p>

                <p className="text-slate-700">
                  <span className="font-medium">Category:</span>{" "}
                  {selectedItem.school_report_category || "Other"}
                </p>

                <p className="text-slate-700">
                  <span className="font-medium">Condition:</span>{" "}
                  {selectedItem.condition}
                </p>

                <p className="text-slate-700">
                  <span className="font-medium">Source:</span>{" "}
                  {selectedItem.item_source}
                </p>

                <p className="text-slate-700">
                  <span className="font-medium">Serial No.:</span>{" "}
                  {selectedItem.serial_number || "N/A"}
                </p>

                <p className="text-slate-700">
                  <span className="font-medium">Quantity:</span>{" "}
                  {selectedItem.quantity}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleTransfer}
              disabled={
                saving ||
                !sourceRoom ||
                !destinationRoom ||
                !selectedItem ||
                sourceRoom.id === destinationRoom.id
              }
              className="rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 disabled:bg-slate-400"
            >
              {saving ? "Transferring..." : "Transfer Item"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}