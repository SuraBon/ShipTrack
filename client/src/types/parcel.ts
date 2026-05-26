/**
 * Parcel Tracker Types
 * ประเภทข้อมูลสำหรับระบบติดตามรายการส่ง
 */

export type ParcelStatus = 'รอจัดส่ง' | 'กำลังจัดส่ง' | 'ส่งสำเร็จ';
export type DeliveryMatchStatus = 'MATCHED_DECLARED_DESTINATION' | 'DELIVERED_ELSEWHERE';

export interface Parcel {
  TrackingID: string;
  'วันที่สร้าง': string;
  'ผู้ส่ง': string;
  'สาขาผู้ส่ง': string;
  'ผู้รับ': string;
  'สาขาผู้รับ': string;
  'ประเภทสิ่งที่ส่ง'?: string;
  'รายละเอียด'?: string;
  'สถานะ': ParcelStatus;
  'วันที่รับ'?: string;
  'หมายเหตุ'?: string;
  'รูปยืนยัน'?: string;
  'Latitude'?: number;
  'Longitude'?: number;
  'OriginLatitude'?: number;
  'OriginLongitude'?: number;
  'events'?: ParcelEventRecord[];
  routeSamples?: ParcelRouteSample[];
}

export interface ParcelRouteSample {
  id: string;
  trackingID: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  recordedBy?: string;
  createdAt?: string;
}

export interface ParcelEventRecord {
  id: string;
  trackingId: string;
  timestamp: string;
  eventType: 'FORWARD' | 'PROXY' | 'DELIVERED' | 'CREATED' | 'START_DELIVERY' | 'PICKUP' | 'RELEASE_DELIVERY' | 'ROUTE_SAMPLE';
  location: string;
  destLocation?: string;
  person?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  deliveryMatchStatus?: DeliveryMatchStatus;
  deliveryMismatchReason?: string;
}

export interface ParcelSummary {
  total: number;
  pending: number;
  transit: number;
  delivered: number;
}

export interface APIResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface CreateParcelPayload {
  action: 'createParcel';
  senderName: string;
  senderBranch: string;
  receiverName: string;
  receiverBranch: string;
  description?: string;
  note?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  pin?: string;
  clientId?: string;
  idempotencyKey?: string;
}

export interface CreateParcelResponse {
  success: boolean;
  trackingID?: string;
  error?: string;
  queued?: boolean;
}

export interface GetParcelsPayload {
  action: 'getParcels';
  status: string;
  limit?: number;
  offset?: number;
}

export interface GetParcelsResponse {
  success: boolean;
  parcels: Parcel[];
  totalCount?: number;
  hasMore?: boolean;
  error?: string;
}

export interface GetParcelPayload {
  action: 'getParcel';
  trackingID: string;
}

export interface GetParcelResponse {
  success: boolean;
  parcel?: Parcel;
  error?: string;
}

export interface ExportSummaryResponse {
  success: boolean;
  summary?: ParcelSummary;
  error?: string;
}

export interface ConfirmReceiptPayload {
  action: 'confirmReceipt';
  trackingID: string;
  photoUrl: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  eventType?: 'FORWARD' | 'PROXY' | 'DELIVERED';
  location?: string;
  destLocation?: string;
  person?: string;
  deliveryMatchStatus?: DeliveryMatchStatus;
  deliveryMismatchReason?: string;
  pin?: string;
  idempotencyKey?: string;
}

export interface ConfirmReceiptResponse {
  success: boolean;
  error?: string;
  queued?: boolean;
}

export interface StartDeliveryPayload {
  action: 'startDelivery';
  trackingID: string;
  latitude?: number;
  longitude?: number;
  idempotencyKey?: string;
}

export interface StartDeliveryResponse {
  success: boolean;
  error?: string;
  queued?: boolean;
  alreadyStarted?: boolean;
  assignedToId?: string;
  assignedToName?: string;
  autoPickedUp?: boolean;
}

export interface ReleaseDeliveryPayload {
  action: 'releaseDelivery';
  trackingID: string;
  idempotencyKey?: string;
}

export interface ReleaseDeliveryResponse {
  success: boolean;
  error?: string;
  queued?: boolean;
  alreadyReleased?: boolean;
}
