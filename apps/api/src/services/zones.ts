import { prisma } from '@/db.js';

/**
 * Проверяет, что каждая новая зона смежна хотя бы с одной уже выбранной зоной
 * (кроме первой — её можно выбрать свободно).
 * Используется при выборе зон матча и при выборе финальной зоны.
 */
export async function validateZoneSelection(mapId: string, zoneIds: string[]): Promise<{ valid: boolean; reason?: string }> {
  if (zoneIds.length === 0) {
    return { valid: true };
  }

  const zones = await prisma.zone.findMany({ where: { mapId, id: { in: zoneIds } } });
  if (zones.length !== zoneIds.length) {
    return { valid: false, reason: 'Одна или несколько зон не найдены на этой карте' };
  }

  const adjacency = new Map(zones.map((z) => [z.id, new Set(z.adjacentIds)]));

  // Зоны добавляются по порядку: zoneIds[0] — первая (свободный выбор),
  // каждая следующая должна быть смежна с объединением уже принятых зон.
  const accepted = new Set<string>([zoneIds[0]]);

  for (let i = 1; i < zoneIds.length; i++) {
    const candidate = zoneIds[i];
    const candidateAdj = adjacency.get(candidate) ?? new Set();

    let touchesAccepted = false;
    for (const acceptedId of accepted) {
      if (candidateAdj.has(acceptedId) || (adjacency.get(acceptedId)?.has(candidate) ?? false)) {
        touchesAccepted = true;
        break;
      }
    }

    if (!touchesAccepted) {
      return { valid: false, reason: `Зона "${candidate}" не граничит ни с одной из уже выбранных зон` };
    }
    accepted.add(candidate);
  }

  return { valid: true };
}

/**
 * Проверяет, что финальная зона смежна (или совпадает) с хотя бы одной из уже выбранных зон матча.
 */
export async function validateFinalZone(mapId: string, selectedZoneIds: string[], finalZoneId: string): Promise<{ valid: boolean; reason?: string }> {
  if (selectedZoneIds.includes(finalZoneId)) {
    return { valid: true };
  }

  const zones = await prisma.zone.findMany({
    where: { mapId, id: { in: [...selectedZoneIds, finalZoneId] } },
  });
  const finalZone = zones.find((z) => z.id === finalZoneId);
  if (!finalZone) {
    return { valid: false, reason: 'Финальная зона не найдена на этой карте' };
  }

  const finalAdj = new Set(finalZone.adjacentIds);
  const touches = selectedZoneIds.some((id) => {
    const z = zones.find((zz) => zz.id === id);
    return finalAdj.has(id) || (z ? z.adjacentIds.includes(finalZoneId) : false);
  });

  if (!touches) {
    return { valid: false, reason: 'Финальная зона должна граничить с одной из уже выбранных зон' };
  }
  return { valid: true };
}

/**
 * Возвращает список зон, доступных для выбора следующей —
 * т.е. смежных хотя бы с одной из уже выбранных. Используется фронтом для подсветки.
 */
export async function getAvailableNextZones(mapId: string, selectedZoneIds: string[]): Promise<string[]> {
  const allZones = await prisma.zone.findMany({ where: { mapId } });
  if (selectedZoneIds.length === 0) {
    return allZones.map((z) => z.id);
  }

  const selectedSet = new Set(selectedZoneIds);
  const available = new Set<string>();

  for (const zone of allZones) {
    if (selectedSet.has(zone.id)) continue;
    const isAdjacent =
      zone.adjacentIds.some((id) => selectedSet.has(id)) ||
      allZones.some((z) => selectedSet.has(z.id) && z.adjacentIds.includes(zone.id));
    if (isAdjacent) available.add(zone.id);
  }

  return Array.from(available);
}
