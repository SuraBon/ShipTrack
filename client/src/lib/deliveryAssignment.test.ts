import { describe, expect, it } from 'vitest';
import { buildAssignmentNote, getActiveDeliveryAssignment } from './deliveryAssignment';
import type { Parcel } from '@/types/parcel';

const baseParcel: Parcel = {
  TrackingID: 'TRK1',
  'วันที่สร้าง': '1 มกราคม 2569',
  'ผู้ส่ง': 'A',
  'สาขาผู้ส่ง': 'MS',
  'ผู้รับ': 'B',
  'สาขาผู้รับ': 'มีนบุรี',
  'ประเภทเอกสาร': 'เอกสาร',
  'สถานะ': 'กำลังจัดส่ง',
};

describe('getActiveDeliveryAssignment', () => {
  it('returns the latest active messenger assignment', () => {
    const parcel: Parcel = {
      ...baseParcel,
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:00',
        eventType: 'START_DELIVERY',
        location: 'MS',
        person: 'Messenger A',
        note: buildAssignmentNote('MSG_A'),
      }],
    };

    expect(getActiveDeliveryAssignment(parcel)).toMatchObject({
      assignedToId: 'MSG_A',
      assignedToName: 'Messenger A',
    });
  });

  it('clears assignment after release', () => {
    const parcel: Parcel = {
      ...baseParcel,
      events: [
        {
          id: 'EVT1',
          trackingId: 'TRK1',
          timestamp: '1 มกราคม 2569 10:00',
          eventType: 'START_DELIVERY',
          location: 'MS',
          person: 'Messenger A',
          note: buildAssignmentNote('MSG_A'),
        },
        {
          id: 'EVT2',
          trackingId: 'TRK1',
          timestamp: '1 มกราคม 2569 10:05',
          eventType: 'RELEASE_DELIVERY',
          location: 'MS',
          person: 'Messenger A',
          note: buildAssignmentNote('MSG_A'),
        },
      ],
    };

    expect(getActiveDeliveryAssignment(parcel)).toBeNull();
  });
});
