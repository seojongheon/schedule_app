import type { RoomMember } from '@/domain/entities';
import { initials } from '@/lib/utils';

export function ParticipantAvatar({ member, size = 'md' }: { member: RoomMember; size?: 'sm' | 'md' }) {
  return (
    <span
      className={size === 'sm' ? 'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white' : 'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white'}
      style={{ backgroundColor: member.color }}
      title={member.nickname}
    >
      {initials(member.nickname)}
    </span>
  );
}

export function ParticipantAvatarGroup({ members }: { members: RoomMember[] }) {
  return (
    <div className="flex -space-x-2">
      {members.slice(0, 4).map((member) => (
        <ParticipantAvatar key={member.id} member={member} size="sm" />
      ))}
      {members.length > 4 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 ring-2 ring-white">
          +{members.length - 4}
        </span>
      ) : null}
    </div>
  );
}
