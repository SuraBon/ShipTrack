/**
 * Timeline Types
 * ประเภทข้อมูลสำหรับเส้นเวลาการจัดส่ง
 */

export type TimelineStatus = 'completed' | 'current' | 'pending';
export type DeliveryMatchStatus = 'MATCHED_DECLARED_DESTINATION' | 'DELIVERED_ELSEWHERE';

export interface TimelineEvent {
  id: string;
  kind?: 'event';
  eventType?: 'FORWARD' | 'PROXY' | 'DELIVERED' | 'CREATED' | 'START_DELIVERY' | 'PICKUP' | 'RELEASE_DELIVERY';
  status: TimelineStatus;
  title: string;
  description?: string;
  timestamp: string;
  location?: string;
  destLocation?: string;
  icon?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  deliveryMatchStatus?: DeliveryMatchStatus;
  deliveryMismatchReason?: string;
}

export interface ParcelTimeline {
  trackingId: string;
  events: TimelineEvent[];
  currentStatus: string;
  estimatedDelivery?: string;
}
