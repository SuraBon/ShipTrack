import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';

/**
 * Parses the structured note field of a parcel into an ordered list of
 * timeline events suitable for display.
 */
export function parseParcelTimeline(parcel: Parcel): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let idCounter = 1;
  const parcelRecord = parcel as Parcel & Record<string, unknown>;
  const getProofImage = (...values: unknown[]) => {
    const aliases = [
      ...values,
      parcel['รูปยืนยัน'],
      parcelRecord['รูปหลักฐาน'],
      parcelRecord['รูปภาพ'],
      parcelRecord['photoUrl'],
      parcelRecord['photoURL'],
      parcelRecord['PhotoUrl'],
      parcelRecord['PhotoURL'],
      parcelRecord['proofPhotoUrl'],
      parcelRecord['proofPhoto'],
      parcelRecord['imageUrl'],
      parcelRecord['imageURL'],
    ];
    return aliases.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
  };

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
      return `${description} (ส่งคนละจุดหรือฝากไว้ที่อื่น)${reason}`;
    }
    if (evt.deliveryMatchStatus === 'MATCHED_DECLARED_DESTINATION') {
      return `${description} (ส่งตรงตามปลายทางที่ระบุ)`;
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
          imageUrl: getProofImage(evt.photoUrl),
          latitude: evt.latitude,
          longitude: evt.longitude,
        });
      } else if (evt.eventType === 'FORWARD') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'ส่งต่อไปจุดถัดไป',
          description: `ส่งต่อโดย: ${evt.person || '-'} ไปยังแผนก/สาขา: ${evt.destLocation || '-'}`,
          timestamp: evt.timestamp,
          location: evt.location,
          destLocation: evt.destLocation,
          imageUrl: getProofImage(evt.photoUrl),
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
      } else if (evt.eventType === 'PICKUP') {
        events.push({
          id: String(idCounter++),
          status: 'completed',
          title: 'รับของแล้ว',
          description: `ผู้รับของ: ${evt.person || '-'}`,
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
          title: 'คืนงานจัดส่ง',
          description: `คืนงานโดย: ${evt.person || '-'}`,
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
          imageUrl: getProofImage(evt.photoUrl),
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
          imageUrl: getProofImage(evt.photoUrl),
          latitude: evt.latitude,
          longitude: evt.longitude,
          deliveryMatchStatus: evt.deliveryMatchStatus,
          deliveryMismatchReason: evt.deliveryMismatchReason,
        });
      } else if (evt.eventType === 'ROUTE_SAMPLE') {
        events.push({
          id: String(idCounter++),
          kind: 'routeSample',
          status: 'completed',
          title: 'ตำแหน่งระหว่างส่ง',
          description: evt.note || undefined,
          timestamp: evt.timestamp,
          location: evt.location || 'GPS',
          latitude: evt.latitude,
          longitude: evt.longitude,
        });
      }
    }

    // Add current status indicator if in transit
    if (parcel['สถานะ'] === 'กำลังจัดส่ง') {
      events.push({
        id: String(idCounter++),
        status: 'current',
        title: 'กำลังจัดส่ง',
        description: 'รายการนี้อยู่ระหว่างนำส่ง',
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

  const isCreationCurrent = parcel['สถานะ'] === 'รอจัดส่ง';
  events.push({
    id: String(idCounter++),
    status: isCreationCurrent ? 'current' : 'completed',
    title: 'สร้างรายการส่ง',
    description: `ผู้ส่ง: ${parcel['ผู้ส่ง']} → ผู้รับ: ${parcel['ผู้รับ']}`,
    timestamp: parcel['วันที่สร้าง'],
    location: parcel['สาขาผู้ส่ง'],
    destLocation: parcel['สาขาผู้รับ'],
    imageUrl: getProofImage(),
    latitude: creationLat,
    longitude: creationLng,
  });

  if (parcel['สถานะ'] === 'ส่งสำเร็จ') {
    events.push({
      id: String(idCounter++),
      status: 'completed',
      title: 'ส่งสำเร็จ',
      description: 'ส่งถึงปลายทางเรียบร้อย',
      timestamp: parcel['วันที่รับ'] ?? '',
      location: parcel['สาขาผู้รับ'],
      imageUrl: getProofImage(),
      latitude: parcelLat,
      longitude: parcelLng,
    });
  } else if (parcel['สถานะ'] === 'กำลังจัดส่ง') {
    events.push({
      id: String(idCounter++),
      status: 'current',
      title: 'กำลังจัดส่ง',
      description: 'รายการนี้อยู่ระหว่างนำส่ง',
      timestamp: '',
      location: '',
    });
  }

  return events;
}
