export type UserRole = 'retailer' | 'dispatcher' | 'rider';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt?: string;
}

export type DeliveryStatus = 'REQUESTED' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED';

export interface StatusEvent {
  id: string;
  delivery_id: string;
  from_status?: string | null;
  to_status: string;
  actor_id: string;
  actor_role: string;
  timestamp: string;
  method: 'manual_update' | 'qr_scan';
  actor?: User;
}

export interface DeliveryRequest {
  id: string;
  retailer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  item_description: string;
  status: DeliveryStatus;
  assigned_rider_id?: string | null;
  qr_code_token: string;
  created_at: string;
  updated_at: string;
  retailer?: User;
  assigned_rider?: User | null;
  status_events?: StatusEvent[];
}
