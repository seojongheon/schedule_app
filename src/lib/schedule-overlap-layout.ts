export type ScheduleLayoutInput = {
  id: string;
  startMinute: number;
  endMinute: number;
  createdAt: string;
};

export type ScheduleLayoutSegment = {
  kind: 'schedule';
  scheduleId: string;
  startMinute: number;
  endMinute: number;
  columnIndex: number;
  columnCount: number;
};

export type ScheduleOverflowSegment = {
  kind: 'overflow';
  id: string;
  startMinute: number;
  endMinute: number;
  columnIndex: 3;
  columnCount: 4;
  scheduleIds: string[];
  hiddenScheduleIds: string[];
};

function creationTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function creationOrder(left: ScheduleLayoutInput, right: ScheduleLayoutInput) {
  return creationTime(left.createdAt) - creationTime(right.createdAt) || left.id.localeCompare(right.id);
}

function mergeScheduleSegments(segments: ScheduleLayoutSegment[]) {
  const merged: ScheduleLayoutSegment[] = [];
  const latestByScheduleId = new Map<string, ScheduleLayoutSegment>();

  for (const segment of segments) {
    const latest = latestByScheduleId.get(segment.scheduleId);

    if (
      latest
      && latest.endMinute === segment.startMinute
      && latest.columnIndex === segment.columnIndex
      && latest.columnCount === segment.columnCount
    ) {
      latest.endMinute = segment.endMinute;
      continue;
    }

    const next = { ...segment };
    merged.push(next);
    latestByScheduleId.set(segment.scheduleId, next);
  }

  return merged.sort((left, right) =>
    left.startMinute - right.startMinute
    || left.columnIndex - right.columnIndex
    || left.scheduleId.localeCompare(right.scheduleId));
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function overflowId(startMinute: number, endMinute: number, scheduleIds: string[]) {
  return `overflow-${startMinute}-${endMinute}-${scheduleIds.join('-')}`;
}

function mergeOverflowSegments(segments: ScheduleOverflowSegment[]) {
  const merged: ScheduleOverflowSegment[] = [];

  for (const segment of segments) {
    const latest = merged.at(-1);

    if (
      latest
      && latest.endMinute === segment.startMinute
      && sameIds(latest.scheduleIds, segment.scheduleIds)
      && sameIds(latest.hiddenScheduleIds, segment.hiddenScheduleIds)
    ) {
      latest.endMinute = segment.endMinute;
      latest.id = overflowId(latest.startMinute, latest.endMinute, latest.scheduleIds);
      continue;
    }

    merged.push({ ...segment, scheduleIds: [...segment.scheduleIds], hiddenScheduleIds: [...segment.hiddenScheduleIds] });
  }

  return merged;
}

export function buildScheduleOverlapLayout(inputs: ScheduleLayoutInput[]): {
  scheduleSegments: ScheduleLayoutSegment[];
  overflowSegments: ScheduleOverflowSegment[];
} {
  const validInputs = inputs.filter((input) =>
    Number.isFinite(input.startMinute)
    && Number.isFinite(input.endMinute)
    && input.endMinute > input.startMinute);
  const boundaries = [...new Set(validInputs.flatMap((input) => [input.startMinute, input.endMinute]))]
    .sort((left, right) => left - right);
  const scheduleSegments: ScheduleLayoutSegment[] = [];
  const overflowSegments: ScheduleOverflowSegment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startMinute = boundaries[index];
    const endMinute = boundaries[index + 1];
    const active = validInputs
      .filter((input) => input.startMinute < endMinute && input.endMinute > startMinute)
      .sort(creationOrder);
    const isOverflow = active.length >= 5;
    const visible = isOverflow ? active.slice(0, 3) : active;
    const columnCount = isOverflow ? 4 : active.length;

    for (const [columnIndex, input] of visible.entries()) {
      scheduleSegments.push({
        kind: 'schedule',
        scheduleId: input.id,
        startMinute,
        endMinute,
        columnIndex,
        columnCount,
      });
    }

    if (isOverflow) {
      const scheduleIds = active.map((input) => input.id);
      overflowSegments.push({
        kind: 'overflow',
        id: overflowId(startMinute, endMinute, scheduleIds),
        startMinute,
        endMinute,
        columnIndex: 3,
        columnCount: 4,
        scheduleIds,
        hiddenScheduleIds: active.slice(3).map((input) => input.id),
      });
    }
  }

  return {
    scheduleSegments: mergeScheduleSegments(scheduleSegments),
    overflowSegments: mergeOverflowSegments(overflowSegments),
  };
}
