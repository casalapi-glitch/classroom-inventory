"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  rooms: {
    building_name: string;
    building_number: string | null;
    room_number: string;
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

export default function AdminEditInventoryItemPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const itemId = params.id;

  const [adminUserId, setAdminUserId] = useState("");
  const [item, setItem] = useState<InventoryItem | null>(null);

const [itemName, setItemName] = useState("");
const [category, setCategory] = useState("");
const [schoolReportCategory, setSchoolReportCategory] = useState("Other");
const [serialNumber, setSerialNumber] = useState("");
const [quantity, setQuantity] = useState("1");
const [condition, setCondition] = useState("Good");
const [itemSource, setItemSource] = useState("Provided by School");
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
    checkAdminAndLoadItem();
  }, []);

  async function checkAdminAndLoadItem() {
    setLoading(true);

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

    await fetchItem();
    setLoading(false);
  }

  async function fetchItem() {
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
rooms!inventory_items_room_id_fkey (
  building_name,
  building_number,
  room_number
)
      `)
      .eq("id", itemId)
      .single();

    if (error) {
      showMessage(error.message);
      return;
    }

const selectedItem = data as unknown as InventoryItem;
    setItem(selectedItem);
setItemName(selectedItem.item_name);
setCategory(selectedItem.category || "");
setSchoolReportCategory(selectedItem.school_report_category || "Other");
setSerialNumber(selectedItem.serial_number || "");
setQuantity(String(selectedItem.quantity));
setCondition(selectedItem.condition);
setItemSource(selectedItem.item_source);
setRemarks(selectedItem.remarks || "");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!item) {
      showMessage("Item not found.");
      return;
    }

    if (!itemName.trim()) {
      showMessage("Item name cannot be empty.");
      return;
    }

    const quantityNumber = Number(quantity);

    if (!quantityNumber || quantityNumber <= 0) {
      showMessage("Quantity must be greater than 0.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("inventory_items")
      .update({
  item_name: itemName.trim(),
  category: category.trim() || null,
  school_report_category: schoolReportCategory,
  serial_number: serialNumber.trim() || null,
  quantity: quantityNumber,
  condition,
  item_source: itemSource,
  remarks: remarks.trim() || null,
})
      .eq("id", item.id);

    if (error) {
      showMessage(error.message);
      setSaving(false);
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: adminUserId,
      action: "Admin edited inventory item",
      room_id: item.room_id,
      item_id: item.id,
      details: `${itemName.trim()} was edited by admin.`,
    });

    showMessage("Inventory item updated successfully.");
    setSaving(false);

    await fetchItem();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <section className="mx-auto max-w-4xl bg-white rounded-2xl shadow-lg p-8">
          <p className="text-2xl font-semibold text-gray-800">
            Loading inventory item...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <section className="mx-auto max-w-4xl bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Edit Inventory Item
            </h1>

            <p className="mt-3 text-xl text-gray-700">
              Admin can update any inventory item.
            </p>
          </div>

          <a
            href="/admin/inventory"
            className="rounded-xl bg-gray-700 px-6 py-4 text-center text-xl font-semibold text-white hover:bg-gray-800"
          >
            Back to Inventory
          </a>
        </div>

        {item && (
          <div className="mt-6 rounded-2xl bg-blue-100 p-5">
            <p className="text-2xl font-bold text-blue-950">
              Room
            </p>

            <p className="mt-2 text-2xl text-blue-950">
              Building {item.rooms?.building_number || item.rooms?.building_name || "No building"} - Room{" "}
{item.rooms?.room_number || "No room"}
            </p>
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl bg-green-100 p-4 text-xl font-semibold text-green-900">
            {message}
          </div>
        )}

        {!item ? (
          <p className="mt-8 text-2xl font-semibold text-gray-800">
            Item not found.
          </p>
        ) : (
          <form onSubmit={handleSave} className="mt-8 space-y-7">
            <div>
              <label className="block text-xl font-semibold text-gray-800">
                Item Name
              </label>

              <input
                type="text"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-400 p-4 text-xl text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xl font-semibold text-gray-800">
                Category
              </label>

              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-400 p-4 text-xl text-gray-900"
                placeholder="Example: Furniture, Appliance, Electronics"
              />
            </div>

            <div>
  <label className="block text-xl font-semibold text-gray-800">
    School Report Category
  </label>

  <select
    value={schoolReportCategory}
    onChange={(event) => setSchoolReportCategory(event.target.value)}
    className="mt-2 w-full rounded-xl border border-gray-400 p-4 text-xl text-gray-900"
  >
    {schoolReportCategoryOptions.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
</div>

<div>
  <label className="block text-xl font-semibold text-gray-800">
    Serial Number
  </label>

  <input
    type="text"
    value={serialNumber}
    onChange={(event) => setSerialNumber(event.target.value)}
    className="mt-2 w-full rounded-xl border border-gray-400 p-4 text-xl text-gray-900"
    placeholder="Optional. Leave blank if none."
  />

  <p className="mt-2 text-lg text-gray-600">
    Optional. Leave this blank if the item has no serial number.
  </p>
</div>

            <div>
              <label className="block text-xl font-semibold text-gray-800">
                Quantity
              </label>

              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-400 p-4 text-xl text-gray-900"
              />
            </div>

            <fieldset className="rounded-2xl border border-gray-300 p-5">
              <legend className="px-2 text-xl font-bold text-gray-900">
                Condition
              </legend>

              <div className="mt-3 grid gap-4">
                {["Good", "Needs Repair", "Broken", "Missing"].map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-4 rounded-xl bg-gray-100 p-4 text-xl font-semibold text-gray-800"
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={option}
                      checked={condition === option}
                      onChange={(event) => setCondition(event.target.value)}
                      className="h-7 w-7"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-gray-300 p-5">
              <legend className="px-2 text-xl font-bold text-gray-900">
                Where did this item come from?
              </legend>

              <div className="mt-3 grid gap-4">
                {[
                  "Personal",
                  "Donated by Parents",
                  "Provided by School",
                  "Provided by City",
                ].map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-4 rounded-xl bg-gray-100 p-4 text-xl font-semibold text-gray-800"
                  >
                    <input
                      type="radio"
                      name="item_source"
                      value={option}
                      checked={itemSource === option}
                      onChange={(event) => setItemSource(event.target.value)}
                      className="h-7 w-7"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="block text-xl font-semibold text-gray-800">
                Remarks
              </label>

              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-400 p-4 text-xl text-gray-900"
                rows={4}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-green-700 px-6 py-5 text-2xl font-semibold text-white hover:bg-green-800 disabled:bg-gray-500"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}