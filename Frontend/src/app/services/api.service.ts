import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DeliveryRequest, StatusEvent, User } from '../models/delivery.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly API_URL = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  /** Fetch mock users, optionally filtered by role */
  getUsers(role?: string): Observable<User[]> {
    let params = new HttpParams();
    if (role) {
      params = params.set('role', role);
    }
    return this.http.get<User[]>(`${this.API_URL}/users`, { params });
  }

  /** Fetch delivery requests for a specific role and user */
  getRequests(role: string, userId: string): Observable<DeliveryRequest[]> {
    const params = new HttpParams()
      .set('role', role)
      .set('userId', userId);
    return this.http.get<DeliveryRequest[]>(`${this.API_URL}/requests`, { params });
  }

  /** Fetch Data URL QR code for a delivery */
  getQRCode(deliveryId: string): Observable<{ deliveryId: string; token: string; qrDataUrl: string }> {
    return this.http.get<{ deliveryId: string; token: string; qrDataUrl: string }>(
      `${this.API_URL}/requests/${deliveryId}/qr`
    );
  }

  /** Create a new delivery request (Retailer) */
  createRequest(data: {
    retailer_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    item_description: string;
  }): Observable<DeliveryRequest> {
    return this.http.post<DeliveryRequest>(`${this.API_URL}/requests`, data).pipe(
      timeout(8000),
      catchError(() => of(this.createDemoRequest(data))),
    );
  }

  private createDemoRequest(data: {
    retailer_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    item_description: string;
  }): DeliveryRequest {
    const now = new Date().toISOString();
    const id = `demo-${Date.now()}`;

    return {
      id,
      ...data,
      status: 'REQUESTED',
      assigned_rider_id: null,
      qr_code_token: `DUKATRACK-DEMO-${Date.now().toString(36).toUpperCase()}`,
      created_at: now,
      updated_at: now,
    };
  }

  /** Assign a rider to a delivery request (Dispatcher) */
  assignRider(deliveryId: string, riderId: string, dispatcherId: string): Observable<DeliveryRequest> {
    return this.http.post<DeliveryRequest>(`${this.API_URL}/requests/${deliveryId}/assign`, {
      riderId,
      dispatcherId,
    });
  }

  /** Update delivery status manually (Rider - PICKED_UP, etc.) */
  updateStatus(deliveryId: string, newStatus: string, riderId: string): Observable<DeliveryRequest> {
    return this.http.post<DeliveryRequest>(`${this.API_URL}/requests/${deliveryId}/status`, {
      newStatus,
      riderId,
    });
  }

  /** Confirm delivery via scanned QR code token (Rider) */
  confirmDelivery(deliveryId: string, scannedToken: string, riderId: string): Observable<DeliveryRequest> {
    return this.http.post<DeliveryRequest>(`${this.API_URL}/requests/${deliveryId}/confirm-delivery`, {
      scannedToken,
      riderId,
    });
  }

  /** Fetch immutable status event history for proof of delivery audit log */
  getStatusHistory(deliveryId: string): Observable<StatusEvent[]> {
    return this.http.get<StatusEvent[]>(`${this.API_URL}/requests/${deliveryId}/history`);
  }
}
