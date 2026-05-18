/**
 * Parcel Tracker Types
 * ประเภทข้อมูลสำหรับระบบติดตามพัสดุ
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
  'ประเภทเอกสาร': string;
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
}

export interface ParcelEventRecord {
  id: string;
  trackingId: string;
  timestamp: string;
  eventType: 'FORWARD' | 'PROXY' | 'DELIVERED' | 'CREATED' | 'START_DELIVERY' | 'RELEASE_DELIVERY';
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
  docType: string;
  description?: string;
  note?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  pin?: string;
}

export interface CreateParcelResponse {
  success: boolean;
  trackingID?: string;
  error?: string;
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
}

export interface ConfirmReceiptResponse {
  success: boolean;
  error?: string;
}

export interface StartDeliveryPayload {
  action: 'startDelivery';
  trackingID: string;
}

export interface StartDeliveryResponse {
  success: boolean;
  error?: string;
  alreadyStarted?: boolean;
  assignedToId?: string;
  assignedToName?: string;
}

export interface ReleaseDeliveryPayload {
  action: 'releaseDelivery';
  trackingID: string;
}

export interface ReleaseDeliveryResponse {
  success: boolean;
  error?: string;
  alreadyReleased?: boolean;
}
