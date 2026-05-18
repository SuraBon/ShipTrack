import { describe, expect, it } from 'vitest';
import { parseParcelTimeline } from './timeline';
import type { Parcel } from '@/types/parcel';

function createParcel(overrides: Partial<Parcel> = {}): Parcel {
  return {
    TrackingID: 'TRK1',
    'วันที่สร้าง': '1 มกราคม 2569',
    'ผู้ส่ง': 'A',
    'สาขาผู้ส่ง': 'ศูนย์ใหญ่บางนา',
    'ผู้รับ': 'B',
    'สาขาผู้รับ': 'มีนบุรี',
    'ประเภทเอกสาร': 'เอกสาร',
    'สถานะ': 'กำลังจัดส่ง',
    ...overrides,
  };
}

describe('parseParcelTimeline', () => {
  it('adds forwarding and current transit step', () => {
    const parcel = createParcel({
      'หมายเหตุ': '[ส่งต่อโดย: พนักงาน1 จากสาขา: ศูนย์ใหญ่บางนา ไปสาขา: มหาชัย เมื่อ: 1 มกราคม 2569]',
    });
    const events = parseParcelTimeline(parcel);
    expect(events.map((e) => e.title)).toEqual(['สร้างรายการส่ง', 'ส่งต่อพัสดุ', 'กำลังจัดส่ง']);
    expect(events[0].destLocation).toBe('มีนบุรี');
    expect(events[1].destLocation).toBe('มหาชัย');
  });

  it('keeps created event GPS so maps can start from the real origin point', () => {
    const parcel = createParcel({
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569',
        eventType: 'CREATED',
        location: 'MS',
        destLocation: 'มีนบุรี',
        person: 'A',
        latitude: 13.7,
        longitude: 100.5,
      }],
    });
    const events = parseParcelTimeline(parcel);
    expect(events[0]).toMatchObject({
      title: 'สร้างรายการส่ง',
      location: 'MS',
      destLocation: 'มีนบุรี',
      latitude: 13.7,
      longitude: 100.5,
    });
  });

  it('shows start delivery event from messenger pickup', () => {
    const parcel = createParcel({
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:30',
        eventType: 'START_DELIVERY',
        location: 'ศูนย์ใหญ่บางนา',
        destLocation: 'มีนบุรี',
        person: 'Messenger A',
      }],
    });
    const events = parseParcelTimeline(parcel);
    expect(events[0]).toMatchObject({
      title: 'รับงานจัดส่ง',
      description: 'ผู้รับงาน: Messenger A',
      location: 'ศูนย์ใหญ่บางนา',
      destLocation: 'มีนบุรี',
    });
  });

  it('shows release delivery event', () => {
    const parcel = createParcel({
      events: [{
        id: 'EVT2',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:45',
        eventType: 'RELEASE_DELIVERY',
        location: 'ศูนย์ใหญ่บางนา',
        destLocation: 'มีนบุรี',
        person: 'Messenger A',
      }],
    });
    const events = parseParcelTimeline(parcel);
    expect(events[0]).toMatchObject({
      title: 'ปล่อยงานจัดส่ง',
      description: 'ปล่อยงานโดย: Messenger A',
    });
  });

  it('parses delivered proxy event', () => {
    const parcel = createParcel({
      'สถานะ': 'ส่งสำเร็จ',
      'หมายเหตุ': '[รับแทนโดย: สมชาย เมื่อ: 1 มกราคม 2569 รูปภาพ: https://example.com/p.jpg]',
    });
    const events = parseParcelTimeline(parcel);
    expect(events[events.length - 1].description).toContain('สมชาย');
    expect(events[events.length - 1].imageUrl).toContain('https://example.com/p.jpg');
  });

  it('shows delivery confirmation details for modern delivered events', () => {
    const parcel = createParcel({
      'สถานะ': 'ส่งสำเร็จ',
      events: [{
        id: 'EVT2',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569',
        eventType: 'DELIVERED',
        location: 'มีนบุรี',
        photoUrl: 'https://example.com/p.jpg',
        latitude: 13.8,
        longitude: 100.6,
        deliveryMatchStatus: 'DELIVERED_ELSEWHERE',
        deliveryMismatchReason: 'ฝากไว้ที่ป้อมยาม',
      }],
    });
    const events = parseParcelTimeline(parcel);
    expect(events[0]).toMatchObject({
      title: 'ส่งสำเร็จ',
      deliveryMatchStatus: 'DELIVERED_ELSEWHERE',
      deliveryMismatchReason: 'ฝากไว้ที่ป้อมยาม',
    });
    expect(events[0].description).toContain('ส่งคนละจุด');
    expect(events[0].description).toContain('ฝากไว้ที่ป้อมยาม');
  });
});
