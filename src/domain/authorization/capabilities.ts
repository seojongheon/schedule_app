export const ROOM_ROLES = ["owner", "manager", "member", "viewer"] as const;
export type RoomRole = (typeof ROOM_ROLES)[number];

export const ROOM_CAPABILITIES = [
  "room.read",
  "schedule.create",
  "schedule.edit_own",
  "schedule.edit_any",
  "invite.create",
  "member.manage",
  "manager.manage",
  "ownership.transfer",
  "room.delete",
] as const;
export type RoomCapability = (typeof ROOM_CAPABILITIES)[number];

const ROOM_CAPABILITY_MATRIX: Record<RoomRole, readonly RoomCapability[]> = {
  owner: ROOM_CAPABILITIES,
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

export const SERVICE_ROLES = [
  "super_admin",
  "operations_admin",
  "support_admin",
  "auditor",
] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];

export const SERVICE_CAPABILITIES = [
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
] as const;
export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number];

const SERVICE_CAPABILITY_MATRIX: Record<ServiceRole, readonly ServiceCapability[]> = {
  super_admin: SERVICE_CAPABILITIES,
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

export function roomCapabilitiesFor(role: string): Set<RoomCapability> {
  if (!ROOM_ROLES.includes(role as RoomRole)) return new Set();
  return new Set(ROOM_CAPABILITY_MATRIX[role as RoomRole]);
}

export function hasRoomCapability(role: string, capability: string): boolean {
  return roomCapabilitiesFor(role).has(capability as RoomCapability);
}

export function serviceCapabilitiesFor(role: string): Set<ServiceCapability> {
  if (!SERVICE_ROLES.includes(role as ServiceRole)) return new Set();
  return new Set(SERVICE_CAPABILITY_MATRIX[role as ServiceRole]);
}

export function hasServiceCapability(role: string, capability: string): boolean {
  return serviceCapabilitiesFor(role).has(capability as ServiceCapability);
}
