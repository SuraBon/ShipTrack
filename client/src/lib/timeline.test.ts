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
    'ประเภทสิ่งที่ส่ง': 'เอกสาร',
    'สถานะ': 'กำลังจัดส่ง',
    ...overrides,
  };
}

describe('parseParcelTimeline', () => {
  it('adds forwarding and current transit step', () => {
    const parcel = createParcel({
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569',
        eventType: 'FORWARD',
        location: 'ศูนย์ใหญ่บางนา',
        destLocation: 'มหาชัย',
        person: 'พนักงาน1',
      }],
    });
    const events = parseParcelTimeline(parcel);
    expect(events.map((e) => e.title)).toEqual(['ส่งต่อไปจุดถัดไป', 'กำลังจัดส่ง']);
    expect(events[0].destLocation).toBe('มหาชัย');
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

  it('uses parcel-level proof image aliases for created structured events', () => {
    const parcel = createParcel({
      imageUrl: 'https://example.com/create-proof.jpg',
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569',
        eventType: 'CREATED',
        location: 'MS',
        destLocation: 'มีนบุรี',
        person: 'A',
      }],
    } as Partial<Parcel>);
    const events = parseParcelTimeline(parcel);
    expect(events[0].imageUrl).toBe('https://example.com/create-proof.jpg');
  });

  it('uses redacted guest parcel coordinates when structured events are hidden', () => {
    const parcel = createParcel({
      'สถานะ': 'ส่งสำเร็จ',
      OriginLatitude: 13.7,
      OriginLongitude: 100.5,
      Latitude: 13.8,
      Longitude: 100.6,
    });
    const events = parseParcelTimeline(parcel);
    expect(events[0]).toMatchObject({
      title: 'สร้างรายการส่ง',
      latitude: 13.7,
      longitude: 100.5,
    });
    expect(events[events.length - 1]).toMatchObject({
      title: 'ส่งสำเร็จ',
      latitude: 13.8,
      longitude: 100.6,
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

  it('shows automatic pickup event after near-origin start delivery', () => {
    const parcel = createParcel({
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:30',
        eventType: 'PICKUP',
        location: 'ศูนย์ใหญ่บางนา',
        destLocation: 'มีนบุรี',
        person: 'Messenger A',
        latitude: 13.7,
        longitude: 100.5,
        note: 'autoPickup=originGpsMatched',
      }],
    });
    const events = parseParcelTimeline(parcel);
    expect(events[0]).toMatchObject({
      title: 'รับของแล้ว',
      description: 'ผู้รับของ: Messenger A',
      location: 'ศูนย์ใหญ่บางนา',
      destLocation: 'มีนบุรี',
      latitude: 13.7,
      longitude: 100.5,
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
      title: 'คืนงานจัดส่ง',
      description: 'คืนงานโดย: Messenger A',
    });
  });

  it('parses delivered proxy event', () => {
    const parcel = createParcel({
      'สถานะ': 'ส่งสำเร็จ',
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569',
        eventType: 'PROXY',
        location: 'มีนบุรี',
        person: 'สมชาย',
        photoUrl: 'https://example.com/p.jpg',
      }],
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
