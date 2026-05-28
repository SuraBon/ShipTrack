const SHEET_NAME = "Parcels";
const API_KEY_PROPERTY = "API_KEY";
const ADMIN_INITIAL_PIN_PROPERTY = "ADMIN_INITIAL_PIN";
const DEFAULT_ADMIN_PIN = "";
const SHIPTRACK_FOLDER_ID_PROPERTY = "SHIPTRACK_FOLDER_ID";
const VALID_ROLES = ["MESSENGER", "ADMIN"];
const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
// Do not hardcode the API key here. Set Script Properties: API_KEY.
const SCRIPT_API_KEY = "";
const MAX_NOTE_LENGTH = 2000;
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;
const MAX_REQUEST_LENGTH = 7 * 1024 * 1024;
const TRACKING_ID_REGEX = /^TRK\d{8}\d{4,}$/;
const EMPLOYEE_ID_REGEX = /^[A-Z0-9_]{1,50}$/;
const SAFE_PASSWORD_REGEX = /^[A-Za-z0-9!@#$%^&*()_\-+=.?]{4,100}$/;
const VALID_EVENT_TYPES = ["FORWARD", "PROXY", "DELIVERED"];
const VALID_DELIVERY_MATCH_STATUSES = ["MATCHED_DECLARED_DESTINATION", "DELIVERED_ELSEWHERE"];

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1EiIWLpHupOzkrh_Oft74U21XTeAc2KSah8H1t0ufNoQ/edit?gid=454662424#gid=454662424";
const SHIPTRACK_FOLDER_ID = "19OGCWa52JD6nFSBYcesfx51i7KjuAOT-";
const YEAR_SPREADSHEETS_PROPERTY = "YEAR_SPREADSHEETS";
const YEAR_SPREADSHEET_PREFIX = "ShipTrack";
const LEGACY_PARCEL_SHEET_NAME = SHEET_NAME;
const PARCEL_SHEET_PREFIX = "Parcels_";
const PARCEL_HEADERS = [
  "TrackingID",
  "วันที่สร้าง",
  "ผู้ส่ง",
  "สาขาผู้ส่ง",
  "ผู้รับ",
  "สาขาผู้รับ",
  "รายละเอียด",
  "หมายเหตุ",
  "สถานะ",
  "รูปยืนยัน",
  "Latitude",
  "Longitude",
  "CreatedBy",
  "OriginLatitude",
  "OriginLongitude"
];
const EVENT_HEADERS = [
  "EventID",
  "TrackingID",
  "Timestamp",
  "EventType",
  "Location",
  "DestLocation",
  "Person",
  "PhotoUrl",
  "Latitude",
  "Longitude",
  "Note",
  "DeliveryMatchStatus",
  "DeliveryMismatchReason"
];
const ROUTE_SAMPLE_HEADERS = [
  "SampleID",
  "TrackingID",
  "Timestamp",
  "Latitude",
  "Longitude",
  "Accuracy",
  "Speed",
  "Heading",
  "RecordedBy",
  "CreatedAt"
];

const USER_HEADERS = ["EmployeeID", "Name", "Role", "PIN", "CreatedAt", "Status", "UpdatedAt"];
const BRANCH_HEADERS = ["Name", "CreatedAt", "CreatedBy"];
const DEFAULT_BRANCHES = [
  "MS", "พระประแดง", "บางนา", "มีนบุรี", "เลียบด่วน",
  "เดอะมอลล์บางกะปิ", "วิภาวดี", "พิบูลสงคราม", "เซ็นทรัล พระราม 2",
  "เดอะมอลล์บางแค", "มหาชัย", "ศาลายา", "กาญจนา"
];
const AUTO_PICKUP_RADIUS_METERS = 150;
