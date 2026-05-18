import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';

/**
 * Parses the structured note field of a parcel into an ordered list of
 * timeline events suitable for display.
 */
export function parseParcelTimeline(parcel: Parcel): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let idCounter = 1;

  // Extract GPS coordinates from the parcel record
  const parcelLat = typeof parcel['Latitude'] === 'number' ? parcel['Latitude'] : undefined;
  const parcelLng = typeof parcel['Longitude'] === 'number' ? parcel['Longitude'] : undefined;
  const originLat = typeof parcel['OriginLatitude'] === 'number' ? parcel['OriginLatitude'] : undefined;
  const originLng = typeof parcel['OriginLongitude'] === 'number' ? parcel['OriginLongitude'] : undefined;
  const creationLat = originLat ?? parcelLat;
  const creationLng = originLng ?? parcelLng;
  const appendDeliveryConfirmation = (description: string, evt: NonNullable<Parcel['events']>[number]) => {
    if (evt.deliveryMatchStatus === 'DELIVERED_ELSEWHERE') {
      const reason = evt.deliveryMismatchReason ? ` เหตุผล: ${evt.deliveryMismatchReason}` : '';
      return `${description} (ส่งคนละจุด / ฝากไว้ที่อื่น)${reason}`;
    }
    if (evt.deliveryMatchStatus === 'MATCHED_DECLARED_DESTINATION') {
      return `${description} (ยืนยันส่งตรงตามปลายทางที่ระบุ)`;
    }
    return description;
  };

  // ── A. Modern Structured Events ────────────────────────────────────────────────
  if (parcel.events && parcel.events.length > 0) {
    for (const evt of parcel.events) {
      if (evt.eventType === 'CREATED') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'สร้างรายการส่ง',
          description: `ผู้ส่ง: ${evt.person || parcel['ผู้ส่ง'] || '-'} → ผู้รับ: ${parcel['ผู้รับ'] || evt.destLocation || '-'}`,
          timestamp: evt.timestamp,
          location: evt.location,
          destLocation: evt.destLocation,
          imageUrl: evt.photoUrl,
          latitude: evt.latitude,
          longitude: evt.longitude,
        });
      } else if (evt.eventType === 'FORWARD') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'ส่งต่อพัสดุ',
          description: `ส่งต่อโดย: ${evt.person || '-'} ไปยังสาขา: ${evt.destLocation || '-'}`,
          timestamp: evt.timestamp,
          location: evt.location,
          destLocation: evt.destLocation,
          imageUrl: evt.photoUrl,
          latitude: evt.latitude,
          longitude: evt.longitude,
        });
      } else if (evt.eventType === 'START_DELIVERY') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'รับงานจัดส่ง',
          description: `ผู้รับงาน: ${evt.person || '-'}`,
          timestamp: evt.timestamp,
          location: evt.location,
          destLocation: evt.destLocation,
          latitude: evt.latitude,
          longitude: evt.longitude,
        });
      } else if (evt.eventType === 'RELEASE_DELIVERY') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'ปล่อยงานจัดส่ง',
          description: `ปล่อยงานโดย: ${evt.person || '-'}`,
          timestamp: evt.timestamp,
          location: evt.location,
          destLocation: evt.destLocation,
        });
      } else if (evt.eventType === 'PROXY') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'ส่งสำเร็จ',
          description: appendDeliveryConfirmation(`รับแทนโดย: ${evt.person || '-'}`, evt),
          timestamp: evt.timestamp,
          location: evt.location,
          imageUrl: evt.photoUrl,
          latitude: evt.latitude,
          longitude: evt.longitude,
          deliveryMatchStatus: evt.deliveryMatchStatus,
          deliveryMismatchReason: evt.deliveryMismatchReason,
        });
      } else if (evt.eventType === 'DELIVERED') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'ส่งสำเร็จ',
          description: appendDeliveryConfirmation('ส่งถึงปลายทางเรียบร้อย', evt),
          timestamp: evt.timestamp,
          location: evt.location,
          imageUrl: evt.photoUrl,
          latitude: evt.latitude,
          longitude: evt.longitude,
          deliveryMatchStatus: evt.deliveryMatchStatus,
          deliveryMismatchReason: evt.deliveryMismatchReason,
        });
      }
    }

    // Add current status indicator if in transit
    if (parcel['สถานะ'] === 'กำลังจัดส่ง') {
      events.push({
        id: String(idCounter++),
        status: 'current',
        title: 'กำลังจัดส่ง',
        description: 'พัสดุอยู่ระหว่างการเดินทาง',
        timestamp: '',
        location: '',
      });
    }

    // Also support adding a pending state if just created
    if (parcel['สถานะ'] === 'รอจัดส่ง' && events.length === 1) {
       events[0].status = 'current';
    }

    return events;
  }

  // ── B. Legacy Regex Parsing Fallback ──────────────────────────────────────────
  const note = parcel['หมายเหตุ'] ?? '';

  // ── 1. Creation event
  const isCreationCurrent = parcel['สถานะ'] === 'รอจัดส่ง';
  events.push({
    id: String(idCounter++),
    status: isCreationCurrent ? 'current' : 'completed',
    title: 'สร้างรายการส่ง',
    description: `ผู้ส่ง: ${parcel['ผู้ส่ง']} → ผู้รับ: ${parcel['ผู้รับ']}`,
    timestamp: parcel['วันที่สร้าง'],
    location: parcel['สาขาผู้ส่ง'],
    destLocation: parcel['สาขาผู้รับ'],
    imageUrl: parcel['รูปยืนยัน'],
    latitude: creationLat,
    longitude: creationLng,
  });

  // ── 2. Forward events
  const forwardRegex =
    /\[ส่งต่อโดย:\s*(.*?)\s*จากสาขา:\s*(.*?)\s*ไปสาขา:\s*(.*?)\s*เมื่อ:\s*(.*?)(?:\s*รูปภาพ:\s*(.*?))?(?:\s*GPS:\s*([\d.-]+),\s*([\d.-]+))?\]/g;

  const forwardEvents: TimelineEvent[] = [];
  let match: RegExpExecArray | null;
  while ((match = forwardRegex.exec(note)) !== null) {
    if (match[1]?.trim() && match[2]?.trim() && match[3]?.trim() && match[4]?.trim()) {
      const fwdLat = match[6] ? parseFloat(match[6]) : undefined;
      const fwdLng = match[7] ? parseFloat(match[7]) : undefined;
      forwardEvents.push({
        id: String(idCounter++),
        status: 'completed',
        title: 'ส่งต่อพัสดุ',
        description: `ส่งต่อโดย: ${match[1].trim()} ไปยังสาขา: ${match[3].trim()}`,
        timestamp: match[4].trim(),
        location: match[2].trim(),
        destLocation: match[3].trim(),
        imageUrl: match[5]?.trim() || undefined,
        latitude: fwdLat,
        longitude: fwdLng,
      });
    }
  }

  if (
    parcel['สถานะ'] !== 'ส่งสำเร็จ' &&
    parcel['รูปยืนยัน'] &&
    forwardEvents.length > 0
  ) {
    forwardEvents[forwardEvents.length - 1].imageUrl = parcel['รูปยืนยัน'];
  }

  events.push(...forwardEvents);

  // ── 3. Terminal event
  if (parcel['สถานะ'] === 'ส่งสำเร็จ') {
    const proxyRegex =
      /\[รับแทนโดย:\s*(.*?)\s*เมื่อ:\s*(.*?)(?:\s*รูปภาพ:\s*(.*?))?(?:\s*GPS:\s*([\d.-]+),\s*([\d.-]+))?\]/;
    const normalRegex =
      /\[รับพัสดุเรียบร้อย เมื่อ:\s*(.*?)(?:\s*รูปภาพ:\s*(.*?))?(?:\s*GPS:\s*([\d.-]+),\s*([\d.-]+))?\]/;

    const proxyMatch  = proxyRegex.exec(note);
    const normalMatch = normalRegex.exec(note);

    let description = 'ส่งถึงปลายทางเรียบร้อย';
    let timestamp   = parcel['วันที่รับ'] ?? '';
    let imageUrl    = parcel['รูปยืนยัน'] ?? undefined;

    if (proxyMatch) {
      description = `รับแทนโดย: ${proxyMatch[1]}`;
      timestamp   = proxyMatch[2];
      if (proxyMatch[3]) imageUrl = proxyMatch[3];
    } else if (normalMatch) {
      timestamp = normalMatch[1];
      if (normalMatch[2]) imageUrl = normalMatch[2];
    }

    events.push({
      id: String(idCounter++),
      status: 'completed',
      title: 'ส่งสำเร็จ',
      description,
      timestamp,
      location: parcel['สาขาผู้รับ'],
      imageUrl,
      latitude: parcelLat,
      longitude: parcelLng,
    });
  } else if (parcel['สถานะ'] === 'กำลังจัดส่ง') {
    events.push({
      id: String(idCounter++),
      status: 'current',
      title: 'กำลังจัดส่ง',
      description: 'พัสดุอยู่ระหว่างการเดินทาง',
      timestamp: '',
      location: '',
    });
  }

  return events;
}
