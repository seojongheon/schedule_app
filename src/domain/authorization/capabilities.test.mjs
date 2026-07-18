import assert from "node:assert/strict";
import test from "node:test";

import {
  hasRoomCapability,
  hasServiceCapability,
  roomCapabilitiesFor,
  serviceCapabilitiesFor,
} from "./capabilities.ts";

const roomMatrix = {
  owner: [
    "room.read",
    "schedule.create",
    "schedule.edit_own",
    "schedule.edit_any",
    "invite.create",
    "member.manage",
    "manager.manage",
    "ownership.transfer",
    "room.delete",
  ],
  manager: [
    "room.read",
    "schedule.create",
    "schedule.edit_own",
    "schedule.edit_any",
    "invite.create",
    "member.manage",
  ],
  member: ["room.read", "schedule.create", "schedule.edit_own"],
  viewer: ["room.read"],
};

test("room roles resolve the exact approved capability matrix", () => {
  for (const [role, expected] of Object.entries(roomMatrix)) {
    assert.deepEqual([...roomCapabilitiesFor(role)].sort(), expected.sort(), role);
  }
  assert.deepEqual(roomCapabilitiesFor("unknown"), new Set());
});

test("room capability checks deny elevation and mutations outside the role", () => {
  assert.equal(hasRoomCapability("manager", "manager.manage"), false);
  assert.equal(hasRoomCapability("manager", "ownership.transfer"), false);
  assert.equal(hasRoomCapability("member", "invite.create"), false);
  assert.equal(hasRoomCapability("viewer", "schedule.create"), false);
  assert.equal(hasRoomCapability("owner", "room.delete"), true);
});

const serviceMatrix = {
  super_admin: [
    "service_role.manage",
    "user_room.read",
    "user_room.lookup_limited",
    "user_room.read_masked",
    "restriction.manage",
    "report_sanction.manage",
    "report_sanction.read",
    "inquiry.read_content",
    "inquiry.read_metadata",
    "inquiry.reply",
    "audit.read_full",
    "audit.read_operations",
    "audit.read_support",
    "audit.read_masked",
    "ip_block.release",
    "ip_block.read",
  ],
  operations_admin: [
    "user_room.read",
    "restriction.manage",
    "report_sanction.manage",
    "audit.read_operations",
    "ip_block.release",
  ],
  support_admin: [
    "user_room.lookup_limited",
    "inquiry.read_content",
    "inquiry.reply",
    "audit.read_support",
  ],
  auditor: [
    "user_room.read_masked",
    "report_sanction.read",
    "inquiry.read_metadata",
    "audit.read_masked",
    "ip_block.read",
  ],
};

test("service roles resolve the exact least-privilege matrix", () => {
  for (const [role, expected] of Object.entries(serviceMatrix)) {
    assert.deepEqual([...serviceCapabilitiesFor(role)].sort(), expected.sort(), role);
  }
  assert.deepEqual(serviceCapabilitiesFor("unknown"), new Set());
});

test("service roles never imply room membership capabilities", () => {
  for (const role of Object.keys(serviceMatrix)) {
    assert.equal(hasRoomCapability(role, "room.read"), false, role);
  }
  assert.equal(hasServiceCapability("support_admin", "restriction.manage"), false);
  assert.equal(hasServiceCapability("auditor", "inquiry.reply"), false);
  assert.equal(hasServiceCapability("operations_admin", "ip_block.release"), true);
});
