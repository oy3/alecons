<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import Swal from "sweetalert2";
import { apiService } from "../../services/api";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const activeTab = ref("applications");
const loading = ref(false);
const applications = ref([]);
const total = ref(0);
const sessions = ref([]);
const inventory = reactive({ hostels: [], blocks: [], rooms: [] });
const inventoryLoading = ref(false);
const expandedBlocks = ref(new Set());
const inventoryPage = ref(1);
const inventoryFilters = reactive({
  search: "",
  gender: "",
  residentType: "",
  status: "",
  limit: 6,
});
const filters = reactive({
  sessionId: "",
  status: "",
  applicantType: "",
  page: 1,
  limit: 25,
});
const canConfigure = computed(() =>
  auth.hasPermission("accommodation", "configure"),
);
const canAllocate = computed(() =>
  auth.hasPermission("accommodation", "allocate"),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / filters.limit)),
);
const inventoryTotals = computed(() => {
  const totalSlots = inventory.rooms.reduce(
    (sum, room) => sum + Number(room.capacity || 0),
    0,
  );
  const occupiedSlots = inventory.rooms.reduce(
    (sum, room) => sum + Number(room.occupiedCount || 0),
    0,
  );
  return {
    hostels: inventory.hostels.length,
    blocks: inventory.blocks.length,
    rooms: inventory.rooms.length,
    totalSlots,
    occupiedSlots,
    occupancy: totalSlots ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
  };
});
const filteredHostels = computed(() => {
  const query = inventoryFilters.search.trim().toLowerCase();
  return inventory.hostels.filter((hostel) => {
    const blocks = blocksForHostel(hostel);
    const rooms = blocks.flatMap((block) => roomsForBlock(block));
    const matchesSearch =
      !query ||
      [
        hostel.name,
        hostel.description,
        ...blocks.map((item) => item.name),
        ...rooms.map((item) => item.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    return (
      matchesSearch &&
      (!inventoryFilters.gender || hostel.gender === inventoryFilters.gender) &&
      (!inventoryFilters.residentType ||
        blocks.some(
          (block) => block.residentType === inventoryFilters.residentType,
        )) &&
      (!inventoryFilters.status ||
        String(hostel.active) === inventoryFilters.status)
    );
  });
});
const inventoryPages = computed(() =>
  Math.max(1, Math.ceil(filteredHostels.value.length / inventoryFilters.limit)),
);
const visibleHostels = computed(() => {
  const start = (inventoryPage.value - 1) * inventoryFilters.limit;
  return filteredHostels.value.slice(start, start + inventoryFilters.limit);
});

function message(error) {
  return error?.message || "The request could not be completed";
}
function recordId(record) {
  return String(record?._id || record || "");
}
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
async function loadApplications() {
  loading.value = true;
  try {
    const result = await apiService.getAccommodationApplications(filters);
    applications.value = result.items || result.data?.items || [];
    total.value = result.total || result.data?.total || 0;
  } catch (error) {
    await Swal.fire("Could not load applications", message(error), "error");
  } finally {
    loading.value = false;
  }
}
async function loadInventory() {
  inventoryLoading.value = true;
  try {
    const result = await apiService.getAccommodationInventory(
      filters.sessionId,
    );
    const data = result.data || result;
    Object.assign(inventory, data);
  } catch (error) {
    await Swal.fire("Could not load inventory", message(error), "error");
  } finally {
    inventoryLoading.value = false;
  }
}
async function loadSessions() {
  const response = await apiService.getAcademicSessions({
    limit: 100,
    sortBy: "startDate",
    sortOrder: "desc",
  });
  sessions.value = response.data?.sessions || response.sessions || [];
  if (!filters.sessionId)
    filters.sessionId =
      sessions.value.find((session) => session.active)?.id ||
      sessions.value.find((session) => session.active)?._id ||
      "";
}
async function changeSession() {
  filters.page = 1;
  await Promise.all([loadApplications(), loadInventory()]);
}
async function changePage(page) {
  filters.page = Math.min(totalPages.value, Math.max(1, page));
  await loadApplications();
}
async function toggleInventory(type, record) {
  const activating = !record.active;
  if (!activating) {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: `Deactivate ${type}?`,
      text: `Existing allocations will remain unchanged, but this ${type} will not receive new allocations.`,
      showCancelButton: true,
      confirmButtonText: "Deactivate",
      confirmButtonColor: "#dc3545",
    });
    if (!confirmation.isConfirmed) return;
  }
  try {
    await apiService.updateAccommodationInventoryStatus(
      type,
      record._id,
      !record.active,
    );
    await loadInventory();
    Swal.fire({
      icon: "success",
      title: `${title(type)} ${activating ? "activated" : "deactivated"}`,
      timer: 1300,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire("Could not update inventory", message(error), "error");
  }
}

function blocksForHostel(hostel) {
  return inventory.blocks
    .filter((block) => recordId(block.hostelId) === recordId(hostel))
    .sort(
      (a, b) =>
        Number(a.allocationOrder) - Number(b.allocationOrder) ||
        a.name.localeCompare(b.name),
    );
}
function roomsForBlock(block) {
  return inventory.rooms
    .filter((room) => recordId(room.blockId) === recordId(block))
    .sort(
      (a, b) =>
        Number(a.allocationOrder) - Number(b.allocationOrder) ||
        a.name.localeCompare(b.name),
    );
}
function visibleBlocks(hostel) {
  const query = inventoryFilters.search.trim().toLowerCase();
  const hostelMatches =
    query &&
    [hostel.name, hostel.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  return blocksForHostel(hostel).filter((block) => {
    const matchesType =
      !inventoryFilters.residentType ||
      block.residentType === inventoryFilters.residentType;
    const matchesSearch =
      !query ||
      hostelMatches ||
      block.name.toLowerCase().includes(query) ||
      roomsForBlock(block).some((room) =>
        room.name.toLowerCase().includes(query),
      );
    return matchesType && matchesSearch;
  });
}
function hostelMetrics(hostel) {
  const blocks = blocksForHostel(hostel);
  const rooms = blocks.flatMap((block) => roomsForBlock(block));
  const slots = rooms.reduce(
    (sum, room) => sum + Number(room.capacity || 0),
    0,
  );
  const occupied = rooms.reduce(
    (sum, room) => sum + Number(room.occupiedCount || 0),
    0,
  );
  return {
    blocks: blocks.length,
    rooms: rooms.length,
    slots,
    occupied,
    occupancy: slots ? Math.round((occupied / slots) * 100) : 0,
  };
}
function blockMetrics(block) {
  const rooms = roomsForBlock(block);
  return {
    slots: rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0),
    occupied: rooms.reduce(
      (sum, room) => sum + Number(room.occupiedCount || 0),
      0,
    ),
  };
}
function roomState(room, block, hostel) {
  if (!hostel.active || !block.active || !room.active) return "Inactive";
  return Number(room.availableCount) > 0 ? "Available" : "Full";
}
function toggleBlock(block) {
  const next = new Set(expandedBlocks.value);
  const id = recordId(block);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedBlocks.value = next;
}

async function hostelDialog(record = null) {
  const editing = Boolean(record);
  const result = await Swal.fire({
    title: editing ? "Edit hostel" : "Add hostel",
    width: 600,
    html: `<div class="text-start">
      <div class="mb-3"><label for="inventory-name" class="form-label fw-semibold">Hostel name</label><input id="inventory-name" class="form-control" maxlength="120" value="${escapeHtml(record?.name)}" placeholder="e.g. Daniel Hostel"></div>
      <div class="mb-3"><label for="inventory-gender" class="form-label fw-semibold">Gender</label><select id="inventory-gender" class="form-select"><option value="female" ${record?.gender !== "male" ? "selected" : ""}>Female</option><option value="male" ${record?.gender === "male" ? "selected" : ""}>Male</option></select></div>
      <div><label for="inventory-description" class="form-label fw-semibold">Description <span class="text-muted fw-normal">(optional)</span></label><textarea id="inventory-description" class="form-control" rows="3" maxlength="500">${escapeHtml(record?.description)}</textarea>${editing ? '<div class="form-text">Gender cannot be changed while this hostel has active allocations.</div>' : ""}</div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: editing ? "Save changes" : "Add hostel",
    confirmButtonColor: "#176867",
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById("inventory-name").value.trim();
      if (!name) return Swal.showValidationMessage("Enter the hostel name");
      return {
        name,
        gender: document.getElementById("inventory-gender").value,
        description: document
          .getElementById("inventory-description")
          .value.trim(),
      };
    },
  });
  if (!result.isConfirmed) return;
  try {
    if (editing) await apiService.updateHostel(recordId(record), result.value);
    else await apiService.createHostel(result.value);
    await loadInventory();
    Swal.fire({
      icon: "success",
      title: editing ? "Hostel updated" : "Hostel added",
      timer: 1400,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire(
      editing ? "Could not update hostel" : "Could not add hostel",
      message(error),
      "error",
    );
  }
}

async function blockDialog(hostel, record = null) {
  const editing = Boolean(record);
  const siblingBlocks = blocksForHostel(hostel);
  const nextOrder =
    Math.max(0, ...siblingBlocks.map((item) => Number(item.allocationOrder))) +
    1;
  const result = await Swal.fire({
    title: editing ? "Edit block" : `Add block to ${hostel.name}`,
    width: 600,
    html: `<div class="text-start">
      <div class="mb-3"><label for="inventory-name" class="form-label fw-semibold">Block name</label><input id="inventory-name" class="form-control" maxlength="80" value="${escapeHtml(record?.name || "")}" placeholder="e.g. Block A"></div>
      <div class="mb-3"><label for="inventory-type" class="form-label fw-semibold">Resident type</label><select id="inventory-type" class="form-select"><option value="internal" ${record?.residentType !== "external" ? "selected" : ""}>Internal students</option><option value="external" ${record?.residentType === "external" ? "selected" : ""}>External residents</option></select>${editing ? '<div class="form-text">Resident type cannot be changed while this block has active allocations.</div>' : ""}</div>
      <div><label for="inventory-order" class="form-label fw-semibold">Allocation order</label><input id="inventory-order" type="number" min="1" class="form-control" value="${record?.allocationOrder || nextOrder}"><div class="form-text">Lower numbers are considered first during automatic allocation.</div></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: editing ? "Save changes" : "Add block",
    confirmButtonColor: "#176867",
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById("inventory-name").value.trim();
      const allocationOrder = Number(
        document.getElementById("inventory-order").value,
      );
      if (!name) return Swal.showValidationMessage("Enter the block name");
      if (!Number.isInteger(allocationOrder) || allocationOrder < 1)
        return Swal.showValidationMessage("Enter a valid allocation order");
      return {
        name,
        residentType: document.getElementById("inventory-type").value,
        allocationOrder,
      };
    },
  });
  if (!result.isConfirmed) return;
  try {
    if (editing)
      await apiService.updateHostelBlock(recordId(record), result.value);
    else
      await apiService.createHostelBlock({
        ...result.value,
        hostelId: recordId(hostel),
      });
    await loadInventory();
    Swal.fire({
      icon: "success",
      title: editing ? "Block updated" : "Block added",
      timer: 1400,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire(
      editing ? "Could not update block" : "Could not add block",
      message(error),
      "error",
    );
  }
}

async function roomDialog(block, record = null) {
  const editing = Boolean(record);
  const siblingRooms = roomsForBlock(block);
  const nextOrder =
    Math.max(0, ...siblingRooms.map((item) => Number(item.allocationOrder))) +
    1;
  const result = await Swal.fire({
    title: editing ? "Edit room" : `Add room to ${block.name}`,
    width: 600,
    html: `<div class="text-start">
      <div class="mb-3"><label for="inventory-name" class="form-label fw-semibold">Room name</label><input id="inventory-name" class="form-control" maxlength="80" value="${escapeHtml(record?.name || "")}" placeholder="e.g. A1"></div>
      <div class="row g-3"><div class="col-sm-6"><label for="inventory-capacity" class="form-label fw-semibold">Bed capacity</label><input id="inventory-capacity" type="number" min="1" max="100" class="form-control" value="${record?.capacity || 8}"></div><div class="col-sm-6"><label for="inventory-order" class="form-label fw-semibold">Allocation order</label><input id="inventory-order" type="number" min="1" class="form-control" value="${record?.allocationOrder || nextOrder}"></div></div>
      ${editing ? '<div class="form-text mt-2">Capacity cannot be reduced below the highest currently occupied bed slot.</div>' : ""}
    </div>`,
    showCancelButton: true,
    confirmButtonText: editing ? "Save changes" : "Add room",
    confirmButtonColor: "#176867",
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById("inventory-name").value.trim();
      const capacity = Number(
        document.getElementById("inventory-capacity").value,
      );
      const allocationOrder = Number(
        document.getElementById("inventory-order").value,
      );
      if (!name) return Swal.showValidationMessage("Enter the room name");
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)
        return Swal.showValidationMessage("Capacity must be between 1 and 100");
      if (!Number.isInteger(allocationOrder) || allocationOrder < 1)
        return Swal.showValidationMessage("Enter a valid allocation order");
      return { name, capacity, allocationOrder };
    },
  });
  if (!result.isConfirmed) return;
  try {
    if (editing)
      await apiService.updateHostelRoom(recordId(record), result.value);
    else
      await apiService.createHostelRoom({
        ...result.value,
        blockId: recordId(block),
      });
    expandedBlocks.value = new Set([...expandedBlocks.value, recordId(block)]);
    await loadInventory();
    Swal.fire({
      icon: "success",
      title: editing ? "Room updated" : "Room added",
      timer: 1400,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire(
      editing ? "Could not update room" : "Could not add room",
      message(error),
      "error",
    );
  }
}
async function allocate(item) {
  let allocationInventory = inventory;
  const applicationSessionId = recordId(item.academicSessionId);
  if (
    applicationSessionId &&
    recordId(inventory.academicSessionId) !== applicationSessionId
  ) {
    try {
      const response =
        await apiService.getAccommodationInventory(applicationSessionId);
      allocationInventory = response.data || response;
    } catch (error) {
      return Swal.fire("Could not load availability", message(error), "error");
    }
  }
  const isTransfer = Boolean(item.assignment);
  const currentRoomId = recordId(item.assignment?.roomId);
  const compatibleRooms = allocationInventory.rooms.filter((room) => {
    if (!room.active || room.availableCount <= 0) return false;
    if (isTransfer && recordId(room) === currentRoomId) return false;
    const block = allocationInventory.blocks.find(
      (candidate) => recordId(candidate) === recordId(room.blockId),
    );
    const hostel = allocationInventory.hostels.find(
      (candidate) => recordId(candidate) === recordId(block?.hostelId),
    );
    return (
      block?.active &&
      hostel?.active &&
      block.residentType === item.applicantType &&
      hostel.gender === item.gender
    );
  });
  const compatibleBlockIds = new Set(
    compatibleRooms.map((room) => recordId(room.blockId)),
  );
  const compatibleBlocks = allocationInventory.blocks.filter((block) =>
    compatibleBlockIds.has(recordId(block)),
  );
  const compatibleHostelIds = new Set(
    compatibleBlocks.map((block) => recordId(block.hostelId)),
  );
  const compatibleHostels = allocationInventory.hostels.filter((hostel) =>
    compatibleHostelIds.has(recordId(hostel)),
  );

  if (!compatibleRooms.length)
    return Swal.fire(
      "No matching space",
      "There is no other active room with free capacity for this resident type and gender.",
      "info",
    );

  const current = item.assignment;
  const currentAllocation = isTransfer
    ? `<div class="text-start border rounded bg-light p-3 mb-4">
        <div class="small text-uppercase text-muted fw-semibold mb-2">Current allocation</div>
        <div class="row g-2">
          <div class="col-6"><span class="small text-muted d-block">Hostel</span><strong>${escapeHtml(current.hostelId?.name)}</strong></div>
          <div class="col-6"><span class="small text-muted d-block">Block</span><strong>${escapeHtml(current.blockId?.name)}</strong></div>
          <div class="col-6"><span class="small text-muted d-block">Room</span><strong>${escapeHtml(current.roomId?.name)}</strong></div>
          <div class="col-6"><span class="small text-muted d-block">Bed slot</span><strong>Slot ${escapeHtml(current.slotNumber)}</strong></div>
        </div>
      </div>`
    : "";

  const result = await Swal.fire({
    title: isTransfer ? "Transfer allocation" : "Allocate accommodation",
    width: 620,
    html: `${currentAllocation}
      <div class="text-start">
        <div class="mb-3"><label for="allocation-hostel" class="form-label fw-semibold">${isTransfer ? "New hostel" : "Hostel"}</label><select id="allocation-hostel" class="form-select"><option value="">Select hostel</option></select></div>
        <div class="mb-3"><label for="allocation-block" class="form-label fw-semibold">${isTransfer ? "New block" : "Block"}</label><select id="allocation-block" class="form-select" disabled><option value="">Select block</option></select></div>
        <div class="mb-3"><label for="allocation-room" class="form-label fw-semibold">${isTransfer ? "New room" : "Room"}</label><select id="allocation-room" class="form-select" disabled><option value="">Select room</option></select><div id="allocation-availability" class="form-text"></div></div>
        <div><label for="allocation-note" class="form-label fw-semibold">${isTransfer ? "Transfer reason" : "Allocation note (optional)"}</label><textarea id="allocation-note" class="form-control" rows="3" maxlength="500" placeholder="${isTransfer ? "Enter the reason for this transfer" : "Add an optional note"}"></textarea></div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: isTransfer ? "Transfer allocation" : "Allocate",
    focusConfirm: false,
    didOpen: () => {
      const hostelSelect = document.getElementById("allocation-hostel");
      const blockSelect = document.getElementById("allocation-block");
      const roomSelect = document.getElementById("allocation-room");
      const availability = document.getElementById("allocation-availability");

      compatibleHostels.forEach((hostel) =>
        hostelSelect.add(new Option(hostel.name, recordId(hostel))),
      );

      const resetSelect = (select, placeholder) => {
        select.replaceChildren(new Option(placeholder, ""));
        select.disabled = true;
      };
      hostelSelect.addEventListener("change", () => {
        resetSelect(blockSelect, "Select block");
        resetSelect(roomSelect, "Select room");
        availability.textContent = "";
        compatibleBlocks
          .filter((block) => recordId(block.hostelId) === hostelSelect.value)
          .forEach((block) =>
            blockSelect.add(new Option(block.name, recordId(block))),
          );
        blockSelect.disabled = blockSelect.options.length <= 1;
      });
      blockSelect.addEventListener("change", () => {
        resetSelect(roomSelect, "Select room");
        availability.textContent = "";
        compatibleRooms
          .filter((room) => recordId(room.blockId) === blockSelect.value)
          .forEach((room) =>
            roomSelect.add(
              new Option(
                `${room.name} · ${room.availableCount} of ${room.capacity} available`,
                recordId(room),
              ),
            ),
          );
        roomSelect.disabled = roomSelect.options.length <= 1;
      });
      roomSelect.addEventListener("change", () => {
        const room = compatibleRooms.find(
          (candidate) => recordId(candidate) === roomSelect.value,
        );
        availability.textContent = room
          ? `The first available bed slot will be assigned automatically.`
          : "";
      });
    },
    preConfirm: () => {
      const roomId = document.getElementById("allocation-room").value;
      const note = document.getElementById("allocation-note").value.trim();
      if (!roomId)
        return Swal.showValidationMessage("Select a destination room");
      if (isTransfer && !note)
        return Swal.showValidationMessage("Enter a reason for this transfer");
      return {
        roomId,
        note,
      };
    },
  });
  if (!result.isConfirmed) return;
  try {
    await apiService.allocateAccommodation(item._id, result.value);
    await loadApplications();
    Swal.fire(
      isTransfer ? "Allocation transferred" : "Accommodation allocated",
      isTransfer
        ? "The new room has been assigned and the previous bed space is now available."
        : "The accommodation assignment has been saved.",
      "success",
    );
  } catch (error) {
    Swal.fire(
      isTransfer ? "Could not transfer allocation" : "Could not allocate",
      message(error),
      "error",
    );
  }
}
async function viewAudit(item) {
  try {
    const response = await apiService.getAccommodationAudit(item._id);
    const events = response.data || response || [];
    const allocationLabel = (allocation) => {
      if (!allocation) return "Not allocated";
      return [
        allocation.hostelName,
        allocation.blockName,
        allocation.roomName,
        allocation.slotNumber ? `Slot ${allocation.slotNumber}` : "",
      ]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" / ");
    };
    const eventDetails = (event) => {
      if (event.action === "bed_transferred") {
        return `<div class="small mt-2"><div><span class="text-muted">From:</span> ${allocationLabel(event.metadata?.from)}</div><div><span class="text-muted">To:</span> ${allocationLabel(event.metadata?.to)}</div><div><span class="text-muted">Reason:</span> ${escapeHtml(event.metadata?.reason)}</div></div>`;
      }
      if (event.action === "bed_allocated" && event.metadata?.to) {
        return `<div class="small mt-2"><span class="text-muted">Assigned:</span> ${allocationLabel(event.metadata.to)}</div>`;
      }
      return "";
    };
    const html = events.length
      ? events
          .map(
            (event) =>
              `<div class="text-start border-bottom py-2"><strong>${escapeHtml(title(event.action))}</strong><div class="small text-muted">${new Date(event.createdAt).toLocaleString()} · ${escapeHtml(event.actorId ? person({ userId: event.actorId }) : title(event.actorType))}</div>${eventDetails(event)}</div>`,
          )
          .join("")
      : '<p class="text-muted">No audit events recorded.</p>';
    await Swal.fire({
      title: `Audit · ${item.applicationNumber}`,
      html,
      width: 700,
      confirmButtonText: "Close",
    });
  } catch (error) {
    Swal.fire("Could not load audit history", message(error), "error");
  }
}
async function retry() {
  try {
    const result = await apiService.retryAccommodationAllocations();
    const data = result.data || result;
    await loadApplications();
    Swal.fire(
      "Allocation run complete",
      `${data.allocated} of ${data.scanned} waiting applications were allocated.`,
      "success",
    );
  } catch (error) {
    Swal.fire("Could not retry allocations", message(error), "error");
  }
}
function person(item) {
  const user = item.userId || {};
  return (
    [user.firstName, user.otherName, user.lastName].filter(Boolean).join(" ") ||
    "Unknown resident"
  );
}
function title(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
watch(
  () => [
    inventoryFilters.search,
    inventoryFilters.gender,
    inventoryFilters.residentType,
    inventoryFilters.status,
    inventoryFilters.limit,
  ],
  () => {
    inventoryPage.value = 1;
  },
);
watch(inventoryPages, (pages) => {
  inventoryPage.value = Math.min(inventoryPage.value, pages);
});
onMounted(async () => {
  await loadSessions();
  await Promise.all([loadApplications(), loadInventory()]);
});
</script>

<template>
  <div class="container-fluid accommodation-management p-3 p-lg-4">
    <header
      class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4"
    >
      <div>
        <h1>Accommodation Management</h1>
        <p class="text-muted mb-0">
          Manage applications, hostel capacity and session-based bed allocation.
        </p>
      </div>
      <button v-if="canAllocate" class="btn btn-outline-primary" @click="retry">
        <i class="bi bi-arrow-repeat me-2"></i>Retry waiting allocations
      </button>
    </header>

    <nav class="nav nav-tabs mb-4" aria-label="Accommodation views">
      <button
        class="nav-link rounded-bottom-0"
        :class="{ active: activeTab === 'applications' }"
        @click="activeTab = 'applications'"
      >
        Applications
      </button>
      <button
        class="nav-link rounded-bottom-0"
        :class="{ active: activeTab === 'inventory' }"
        @click="activeTab = 'inventory'"
      >
        Hostel inventory
      </button>
    </nav>

    <template v-if="activeTab === 'applications'">
      <section class="filter-band mb-3">
        <select
          v-model="filters.sessionId"
          class="form-select"
          @change="changeSession"
        >
          <option value="">All sessions</option>
          <option
            v-for="session in sessions"
            :key="session.id || session._id"
            :value="session.id || session._id"
          >
            {{ session.title || session.sessionYear }}
          </option>
        </select>
        <select
          v-model="filters.applicantType"
          class="form-select"
          @change="loadApplications"
        >
          <option value="">All resident types</option>
          <option value="internal">Internal students</option>
          <option value="external">External residents</option>
        </select>
        <select
          v-model="filters.status"
          class="form-select"
          @change="loadApplications"
        >
          <option value="">All statuses</option>
          <option
            v-for="status in [
              'draft',
              'awaiting_email_verification',
              'awaiting_agreement',
              'awaiting_payment',
              'payment_pending_review',
              'paid_awaiting_allocation',
              'allocated',
              'cancelled',
              'expired',
            ]"
            :key="status"
            :value="status"
          >
            {{ title(status) }}
          </option>
        </select>
        <button
          class="btn btn-outline-secondary"
          :disabled="loading"
          @click="loadApplications"
        >
          <i class="bi bi-arrow-clockwise"></i
          ><span class="visually-hidden">Refresh</span>
        </button>
      </section>
      <div
        class="table-responsive applications-table-wrap bg-white border rounded"
      >
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Resident</th>
              <th>Type</th>
              <th>Session</th>
              <th>Status</th>
              <th>Bed space</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="text-center py-5">
                <span class="spinner-border text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!applications.length">
              <td colspan="6" class="text-center text-muted py-5">
                No accommodation applications match these filters.
              </td>
            </tr>
            <tr v-for="item in applications" v-else :key="item._id">
              <td>
                <strong>{{ person(item) }}</strong
                ><small class="d-block text-muted"
                  >{{ item.applicationNumber }} ·
                  {{ item.userId?.email }}</small
                >
              </td>
              <td>
                {{ title(item.applicantType)
                }}<small class="d-block text-muted"
                  >{{ title(item.category) }} · {{ title(item.gender) }}</small
                >
              </td>
              <td>
                {{
                  item.academicSessionId?.sessionYear ||
                  item.academicSessionId?.title ||
                  "—"
                }}
              </td>
              <td>
                <span class="badge text-bg-light border">{{
                  title(item.status)
                }}</span>
              </td>
              <td>
                <span v-if="item.assignment"
                  >{{ item.assignment.hostelId?.name }} /
                  {{ item.assignment.blockId?.name }} /
                  {{ item.assignment.roomId?.name }} · Slot
                  {{ item.assignment.slotNumber }}</span
                ><span v-else class="text-muted">Not allocated</span>
              </td>
              <td class="text-end">
                <div class="dropdown d-inline-block">
                  <button
                    :id="`accommodation-actions-${item._id}`"
                    type="button"
                    class="btn btn-sm action-menu-trigger dropdown-toggle"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    aria-haspopup="true"
                    :aria-label="`Actions for ${person(item)}`"
                    title="More actions"
                  >
                    <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                  </button>
                  <ul
                    class="dropdown-menu dropdown-menu-end shadow-sm"
                    :aria-labelledby="`accommodation-actions-${item._id}`"
                  >
                    <li
                      v-if="
                        canAllocate &&
                        ['paid_awaiting_allocation', 'allocated'].includes(
                          item.status,
                        )
                      "
                    >
                      <button
                        type="button"
                        class="dropdown-item"
                        @click="allocate(item)"
                      >
                        <i
                          class="bi me-2"
                          :class="
                            item.assignment
                              ? 'bi-arrow-left-right'
                              : 'bi-building-add'
                          "
                          aria-hidden="true"
                        ></i>
                        {{ item.assignment ? "Transfer" : "Allocate" }}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        class="dropdown-item"
                        @click="viewAudit(item)"
                      >
                        <i
                          class="bi bi-clock-history me-2"
                          aria-hidden="true"
                        ></i>
                        Audit history
                      </button>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center mt-2">
        <p class="small text-muted mb-0">
          {{ total }} application{{ total === 1 ? "" : "s" }}
        </p>
        <div v-if="totalPages > 1" class="btn-group">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="filters.page <= 1"
            @click="changePage(filters.page - 1)"
          >
            <i class="bi bi-chevron-left"></i></button
          ><span class="btn btn-sm btn-light disabled"
            >{{ filters.page }} / {{ totalPages }}</span
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="filters.page >= totalPages"
            @click="changePage(filters.page + 1)"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <section class="inventory-toolbar mb-3" aria-label="Inventory filters">
        <div class="input-group inventory-search">
          <span class="input-group-text bg-white" aria-hidden="true"
            ><i class="bi bi-search"></i
          ></span>
          <input
            v-model="inventoryFilters.search"
            type="search"
            class="form-control border-start-0"
            placeholder="Search hostels, blocks or rooms"
            aria-label="Search hostel inventory"
          />
        </div>
        <div class="inventory-filter">
          <label for="inventory-session">Academic session</label>
          <select
            id="inventory-session"
            v-model="filters.sessionId"
            class="form-select"
            @change="loadInventory"
          >
            <option
              v-for="session in sessions"
              :key="session.id || session._id"
              :value="session.id || session._id"
            >
              {{ session.title || session.sessionYear }}
            </option>
          </select>
        </div>
        <div class="inventory-filter">
          <label for="inventory-gender">Gender</label>
          <select
            id="inventory-gender"
            v-model="inventoryFilters.gender"
            class="form-select"
          >
            <option value="">All genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div class="inventory-filter">
          <label for="inventory-resident-type">Resident type</label>
          <select
            id="inventory-resident-type"
            v-model="inventoryFilters.residentType"
            class="form-select"
          >
            <option value="">All resident types</option>
            <option value="internal">Internal students</option>
            <option value="external">External residents</option>
          </select>
        </div>
        <div class="inventory-filter">
          <label for="inventory-status">Hostel status</label>
          <select
            id="inventory-status"
            v-model="inventoryFilters.status"
            class="form-select"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </section>

      <section class="inventory-summary mb-3" aria-label="Inventory summary">
        <article class="summary-item summary-hostels">
          <span class="summary-icon"><i class="bi bi-buildings"></i></span>
          <div>
            <small>Total hostels</small
            ><strong>{{ inventoryTotals.hostels }}</strong>
          </div>
        </article>
        <article class="summary-item summary-blocks">
          <span class="summary-icon"><i class="bi bi-layers"></i></span>
          <div>
            <small>Total blocks</small
            ><strong>{{ inventoryTotals.blocks }}</strong>
          </div>
        </article>
        <article class="summary-item summary-rooms">
          <span class="summary-icon"><i class="bi bi-door-open"></i></span>
          <div>
            <small>Total rooms</small
            ><strong>{{ inventoryTotals.rooms }}</strong>
          </div>
        </article>
        <article class="summary-item summary-occupancy">
          <span class="summary-icon"><i class="bi bi-people"></i></span>
          <div class="flex-grow-1">
            <small>Occupied / total slots</small
            ><strong
              >{{ inventoryTotals.occupiedSlots }} /
              {{ inventoryTotals.totalSlots }}</strong
            >
            <div class="d-flex align-items-center gap-2 mt-1">
              <div
                class="progress flex-grow-1"
                role="progressbar"
                aria-label="Overall hostel occupancy"
                :aria-valuenow="inventoryTotals.occupancy"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="progress-bar"
                  :style="{ width: `${inventoryTotals.occupancy}%` }"
                ></div>
              </div>
              <small>{{ inventoryTotals.occupancy }}%</small>
            </div>
          </div>
        </article>
      </section>

      <div v-if="inventoryLoading" class="inventory-loading" role="status">
        <span class="spinner-border text-primary"></span
        ><span>Loading hostel inventory...</span>
      </div>
      <div v-else class="inventory-grid">
        <button
          v-if="canConfigure && inventoryPage === 1"
          type="button"
          class="add-hostel-tile"
          @click="hostelDialog()"
        >
          <span class="add-hostel-icon"><i class="bi bi-plus-lg"></i></span
          ><strong>Add new hostel</strong
          ><small>Create a hostel, then configure its blocks and rooms.</small
          ><span class="btn btn-outline-primary"
            ><i class="bi bi-plus-lg me-2"></i>Add hostel</span
          >
        </button>

        <article
          v-for="hostel in visibleHostels"
          :key="hostel._id"
          class="hostel-card"
          :class="{ 'is-inactive': !hostel.active }"
        >
          <header class="hostel-card-header">
            <span
              class="hostel-icon"
              :class="hostel.gender === 'female' ? 'female' : 'male'"
              aria-hidden="true"
              ><i class="bi bi-building"></i
            ></span>
            <div class="hostel-title">
              <h2>{{ hostel.name }}</h2>
              <p>{{ title(hostel.gender) }} hostel</p>
            </div>
            <span
              class="status-pill"
              :class="hostel.active ? 'active' : 'inactive'"
              ><i
                class="bi"
                :class="hostel.active ? 'bi-toggle-on' : 'bi-toggle-off'"
              ></i
              >{{ hostel.active ? "Active" : "Inactive" }}</span
            >
            <div v-if="canConfigure" class="dropdown">
              <button
                :id="`hostel-actions-${hostel._id}`"
                type="button"
                class="btn action-menu-trigger dropdown-toggle"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                :aria-label="`Actions for ${hostel.name}`"
              >
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul
                class="dropdown-menu dropdown-menu-end shadow-sm"
                :aria-labelledby="`hostel-actions-${hostel._id}`"
              >
                <li>
                  <button class="dropdown-item" @click="hostelDialog(hostel)">
                    <i class="bi bi-pencil me-2"></i>Edit hostel
                  </button>
                </li>
                <li>
                  <button
                    class="dropdown-item"
                    :class="{ 'text-danger': hostel.active }"
                    @click="toggleInventory('hostel', hostel)"
                  >
                    <i
                      class="bi me-2"
                      :class="hostel.active ? 'bi-toggle-off' : 'bi-toggle-on'"
                    ></i
                    >{{ hostel.active ? "Deactivate" : "Activate" }}
                  </button>
                </li>
              </ul>
            </div>
          </header>
          <div class="hostel-metrics">
            <div>
              <strong>{{ hostelMetrics(hostel).blocks }}</strong
              ><small>Blocks</small>
            </div>
            <div>
              <strong>{{ hostelMetrics(hostel).rooms }}</strong
              ><small>Rooms</small>
            </div>
            <div>
              <strong>{{ hostelMetrics(hostel).slots }}</strong
              ><small>Total slots</small>
            </div>
            <div>
              <strong
                >{{ hostelMetrics(hostel).occupied }} /
                {{ hostelMetrics(hostel).slots }}</strong
              ><small>Occupied</small>
            </div>
          </div>
          <div class="hostel-progress">
            <div
              class="progress"
              role="progressbar"
              :aria-label="`${hostel.name} occupancy`"
              :aria-valuenow="hostelMetrics(hostel).occupancy"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="progress-bar"
                :style="{ width: `${hostelMetrics(hostel).occupancy}%` }"
              ></div>
            </div>
            <small>{{ hostelMetrics(hostel).occupancy }}%</small>
          </div>
          <div class="blocks-heading">
            <strong>Blocks ({{ visibleBlocks(hostel).length }})</strong
            ><button
              v-if="canConfigure"
              type="button"
              class="btn btn-sm btn-outline-primary"
              @click="blockDialog(hostel)"
            >
              <i class="bi bi-plus-lg me-1"></i>Add block
            </button>
          </div>
          <div v-if="!visibleBlocks(hostel).length" class="empty-blocks">
            No blocks match the current filters.
          </div>
          <div v-else class="block-list">
            <section
              v-for="block in visibleBlocks(hostel)"
              :key="block._id"
              class="block-item"
              :class="{ 'is-inactive': !block.active }"
            >
              <div class="block-header">
                <button
                  type="button"
                  class="block-toggle"
                  :aria-expanded="expandedBlocks.has(recordId(block))"
                  :aria-controls="`block-rooms-${block._id}`"
                  @click="toggleBlock(block)"
                >
                  <i
                    class="bi"
                    :class="
                      expandedBlocks.has(recordId(block))
                        ? 'bi-chevron-down'
                        : 'bi-chevron-right'
                    "
                  ></i
                  ><strong>{{ block.name }}</strong>
                </button>
                <span class="resident-badge">{{
                  title(block.residentType)
                }}</span
                ><span class="block-capacity"
                  >{{ blockMetrics(block).occupied }}/{{
                    blockMetrics(block).slots
                  }}</span
                >
                <div v-if="canConfigure" class="dropdown">
                  <button
                    :id="`block-actions-${block._id}`"
                    type="button"
                    class="btn action-menu-trigger dropdown-toggle"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    :aria-label="`Actions for ${block.name}`"
                  >
                    <i class="bi bi-three-dots-vertical"></i>
                  </button>
                  <ul
                    class="dropdown-menu dropdown-menu-end shadow-sm"
                    :aria-labelledby="`block-actions-${block._id}`"
                  >
                    <li>
                      <button
                        class="dropdown-item"
                        @click="blockDialog(hostel, block)"
                      >
                        <i class="bi bi-pencil me-2"></i>Edit block
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item" @click="roomDialog(block)">
                        <i class="bi bi-plus-lg me-2"></i>Add room
                      </button>
                    </li>
                    <li>
                      <button
                        class="dropdown-item"
                        :class="{ 'text-danger': block.active }"
                        @click="toggleInventory('block', block)"
                      >
                        <i
                          class="bi me-2"
                          :class="
                            block.active ? 'bi-toggle-off' : 'bi-toggle-on'
                          "
                        ></i
                        >{{ block.active ? "Deactivate" : "Activate" }}
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <div
                v-show="expandedBlocks.has(recordId(block))"
                :id="`block-rooms-${block._id}`"
                class="block-rooms"
              >
                <div v-if="!roomsForBlock(block).length" class="empty-rooms">
                  No rooms have been added to this block.
                </div>
                <div v-else class="table-responsive room-table-wrap">
                  <table class="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Capacity</th>
                        <th>Occupied</th>
                        <th>Status</th>
                        <th class="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="room in roomsForBlock(block)" :key="room._id">
                        <td>
                          <strong>{{ room.name }}</strong>
                        </td>
                        <td>{{ room.capacity }}</td>
                        <td>{{ room.occupiedCount }}</td>
                        <td>
                          <span
                            class="room-status"
                            :class="
                              roomState(room, block, hostel).toLowerCase()
                            "
                            >{{ roomState(room, block, hostel) }}</span
                          >
                        </td>
                        <td class="text-end">
                          <div
                            v-if="canConfigure"
                            class="dropdown d-inline-block"
                          >
                            <button
                              :id="`room-actions-${room._id}`"
                              type="button"
                              class="btn action-menu-trigger dropdown-toggle"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                              :aria-label="`Actions for room ${room.name}`"
                            >
                              <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul
                              class="dropdown-menu dropdown-menu-end shadow-sm"
                              :aria-labelledby="`room-actions-${room._id}`"
                            >
                              <li>
                                <button
                                  class="dropdown-item"
                                  @click="roomDialog(block, room)"
                                >
                                  <i class="bi bi-pencil me-2"></i>Edit room
                                </button>
                              </li>
                              <li>
                                <button
                                  class="dropdown-item"
                                  :class="{ 'text-danger': room.active }"
                                  @click="toggleInventory('room', room)"
                                >
                                  <i
                                    class="bi me-2"
                                    :class="
                                      room.active
                                        ? 'bi-toggle-off'
                                        : 'bi-toggle-on'
                                    "
                                  ></i
                                  >{{ room.active ? "Deactivate" : "Activate" }}
                                </button>
                              </li>
                            </ul>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button
                  v-if="canConfigure"
                  type="button"
                  class="btn btn-sm btn-link add-room-link"
                  @click="roomDialog(block)"
                >
                  <i class="bi bi-plus-circle me-1"></i>Add room
                </button>
              </div>
            </section>
          </div>
        </article>
        <div v-if="!visibleHostels.length" class="inventory-empty">
          <i class="bi bi-buildings"></i><strong>No hostels found</strong
          ><span>Adjust the inventory filters or add a new hostel.</span>
        </div>
      </div>

      <footer v-if="filteredHostels.length" class="inventory-pagination">
        <small
          >Showing {{ (inventoryPage - 1) * inventoryFilters.limit + 1 }}–{{
            Math.min(
              inventoryPage * inventoryFilters.limit,
              filteredHostels.length,
            )
          }}
          of {{ filteredHostels.length }} hostels</small
        >
        <div class="d-flex align-items-center gap-2">
          <label for="inventory-page-size" class="small text-muted"
            >Rows per page</label
          ><select
            id="inventory-page-size"
            v-model.number="inventoryFilters.limit"
            class="form-select form-select-sm page-size-select"
          >
            <option :value="6">6</option>
            <option :value="12">12</option>
            <option :value="24">24</option></select
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="inventoryPage <= 1"
            @click="inventoryPage -= 1"
          >
            <i class="bi bi-chevron-left"></i
            ><span class="visually-hidden">Previous page</span></button
          ><span class="page-indicator">{{ inventoryPage }}</span
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="inventoryPage >= inventoryPages"
            @click="inventoryPage += 1"
          >
            <i class="bi bi-chevron-right"></i
            ><span class="visually-hidden">Next page</span>
          </button>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.accommodation-management h1 {
  color: #176867;
  font-size: 2rem;
  font-weight: 700;
}
.filter-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 240px)) 44px;
  gap: 0.75rem;
  padding: 1rem;
  background: #fff;
  border: 1px solid #e3e7ea;
}
.inventory-toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1.7fr) repeat(4, minmax(145px, 1fr));
  gap: 0.75rem;
  align-items: end;
}
.inventory-search {
  align-self: end;
}
.inventory-search .input-group-text,
.inventory-search .form-control {
  min-height: 3.5rem;
}
.inventory-filter {
  position: relative;
}
.inventory-filter label {
  position: absolute;
  z-index: 2;
  top: 0.35rem;
  left: 0.8rem;
  color: #6c757d;
  font-size: 0.72rem;
  pointer-events: none;
}
.inventory-filter .form-select {
  min-height: 3.5rem;
  padding-top: 1.25rem;
  padding-bottom: 0.2rem;
}
.inventory-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}
.summary-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-height: 6.25rem;
  padding: 1rem;
  background: #fff;
  border: 1px solid #dfe4e7;
  border-radius: 0.375rem;
}
.summary-item > div:not(.progress) {
  min-width: 0;
}
.summary-item small,
.summary-item strong {
  display: block;
}
.summary-item small {
  color: #5f6871;
}
.summary-item strong {
  color: #212529;
  font-size: 1.45rem;
}
.summary-icon,
.hostel-icon,
.add-hostel-icon {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
}
.summary-icon {
  width: 3.25rem;
  height: 3.25rem;
  font-size: 1.35rem;
}
.summary-hostels .summary-icon {
  color: #0d6efd;
  background: #e7f1ff;
}
.summary-blocks .summary-icon {
  color: #198754;
  background: #e6f5ed;
}
.summary-rooms .summary-icon {
  color: #b26a00;
  background: #fff3dc;
}
.summary-occupancy .summary-icon {
  color: #6f42c1;
  background: #f0e9ff;
}
.progress {
  height: 0.45rem;
  background: #e3e7ea;
}
.progress-bar {
  background: #129b72;
}
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 1rem;
  align-items: start;
}
.add-hostel-tile,
.hostel-card {
  min-height: 25rem;
  background: #fff;
  border-radius: 0.375rem;
}
.add-hostel-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 2rem;
  color: #212529;
  text-align: center;
  border: 1px dashed #8eb8e8;
}
.add-hostel-tile:hover,
.add-hostel-tile:focus-visible {
  background: #f8fbff;
  border-color: #0d6efd;
}
.add-hostel-tile:focus-visible {
  outline: 3px solid rgb(13 110 253 / 25%);
  outline-offset: 2px;
}
.add-hostel-tile > small {
  max-width: 15rem;
  color: #6c757d;
}
.add-hostel-icon {
  width: 4rem;
  height: 4rem;
  color: #0d6efd;
  background: #e7f1ff;
  font-size: 1.75rem;
}
.hostel-card {
  padding: 1rem;
  border: 1px solid #dfe4e7;
  border-top: 3px solid #198754;
  box-shadow: 0 0.2rem 0.75rem rgb(28 44 52 / 6%);
}
.hostel-card.is-inactive {
  border-top-color: #adb5bd;
}
.hostel-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.hostel-icon {
  width: 3rem;
  height: 3rem;
  font-size: 1.25rem;
}
.hostel-icon.male {
  color: #0d6efd;
  background: #e7f1ff;
}
.hostel-icon.female {
  color: #c72c59;
  background: #fde7ee;
}
.hostel-title {
  min-width: 0;
  margin-right: auto;
}
.hostel-title h2 {
  overflow: hidden;
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hostel-title p {
  margin: 0;
  color: #6c757d;
  font-size: 0.85rem;
}
.status-pill,
.resident-badge,
.room-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}
.status-pill {
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid currentColor;
}
.status-pill.active {
  color: #198754;
}
.status-pill.inactive {
  color: #6c757d;
}
.hostel-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 1rem;
}
.hostel-metrics > div {
  min-width: 0;
  padding: 0 0.65rem;
  border-left: 1px solid #e3e7ea;
}
.hostel-metrics > div:first-child {
  padding-left: 0;
  border-left: 0;
}
.hostel-metrics strong,
.hostel-metrics small {
  display: block;
}
.hostel-metrics strong {
  font-size: 0.95rem;
}
.hostel-metrics small {
  overflow: hidden;
  color: #6c757d;
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hostel-progress {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0 0.8rem;
  border-bottom: 1px solid #e3e7ea;
}
.hostel-progress small {
  color: #6c757d;
  font-size: 0.72rem;
}
.blocks-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
}
.blocks-heading strong {
  font-size: 0.9rem;
}
.block-list {
  display: grid;
  gap: 0.4rem;
}
.block-item {
  border: 1px solid #dfe4e7;
  border-radius: 0.3rem;
}
.block-item.is-inactive {
  background: #f8f9fa;
}
.block-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto 2rem;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.6rem;
  padding: 0.2rem 0.25rem 0.2rem 0.65rem;
}
.block-toggle {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  color: #212529;
  text-align: left;
  background: transparent;
  border: 0;
}
.block-toggle strong {
  overflow: hidden;
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resident-badge {
  padding: 0.2rem 0.55rem;
  color: #1559a4;
  background: #e7f1ff;
}
.block-capacity {
  color: #495057;
  font-size: 0.78rem;
}
.block-rooms {
  border-top: 1px solid #e3e7ea;
  background: #fbfcfd;
}
.block-rooms .table {
  font-size: 0.78rem;
}
.block-rooms th {
  color: #53606b;
  font-weight: 600;
  background: #eef2f4;
}
.block-rooms th,
.block-rooms td {
  padding: 0.35rem 0.5rem;
}
.room-status {
  min-width: 4.5rem;
  padding: 0.18rem 0.45rem;
}
.room-status.available {
  color: #147348;
  background: #dff4e9;
}
.room-status.full {
  color: #b4233a;
  background: #fde5ea;
}
.room-status.inactive {
  color: #5f6871;
  background: #e9ecef;
}
.add-room-link {
  padding: 0.45rem 0.6rem;
  text-decoration: none;
}
.empty-blocks,
.empty-rooms {
  padding: 1rem;
  color: #6c757d;
  font-size: 0.85rem;
  text-align: center;
}
.inventory-loading,
.inventory-empty {
  display: flex;
  grid-column: 1 / -1;
  min-height: 16rem;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #6c757d;
  background: #fff;
  border: 1px solid #dfe4e7;
}
.inventory-empty {
  flex-direction: column;
}
.inventory-empty i {
  font-size: 2rem;
}
.inventory-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  color: #6c757d;
}
.page-size-select {
  width: 4.5rem;
}
.page-indicator {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  color: #fff;
  background: #176867;
  border-radius: 0.3rem;
}
.action-menu-trigger {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  place-items: center;
  color: #495057;
  border: 1px solid transparent;
  border-radius: 0.375rem;
}
.action-menu-trigger::after {
  display: none;
}
.action-menu-trigger:hover,
.action-menu-trigger:focus-visible,
.action-menu-trigger[aria-expanded="true"] {
  color: #176867;
  background: #eef7f6;
  border-color: #b9d7d5;
}
.action-menu-trigger:focus-visible {
  box-shadow: 0 0 0 0.2rem rgb(23 104 103 / 20%);
}
.dropdown-menu {
  min-width: 11rem;
  padding: 0.35rem;
  border-color: #e3e7ea;
}
.dropdown-item {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  border-radius: 0.25rem;
}
.dropdown-item:active {
  color: #fff;
  background: #176867;
}
@media (min-width: 992px) {
  .applications-table-wrap {
    overflow: visible;
  }
  .room-table-wrap {
    overflow: visible;
  }
}
@media (max-width: 991px) {
  .applications-table-wrap:has(.dropdown-menu.show) {
    padding-bottom: 5.5rem;
  }
  .inventory-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .inventory-search {
    grid-column: 1 / -1;
  }
  .inventory-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .room-table-wrap:has(.dropdown-menu.show) {
    padding-bottom: 5rem;
  }
}
@media (max-width: 575px) {
  .filter-band,
  .inventory-toolbar,
  .inventory-summary {
    grid-template-columns: 1fr;
  }
  .inventory-search {
    grid-column: auto;
  }
  .hostel-card-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .hostel-title {
    flex: 1 1 10rem;
  }
  .hostel-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem 0;
  }
  .hostel-metrics > div:nth-child(3) {
    padding-left: 0;
    border-left: 0;
  }
  .block-header {
    grid-template-columns: minmax(0, 1fr) auto 2rem;
  }
  .resident-badge {
    display: none;
  }
  .inventory-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
  .inventory-pagination > div {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
