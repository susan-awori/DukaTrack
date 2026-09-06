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
  private readonly demoRequests: DeliveryRequest[] = [];

  constructor(private http: HttpClient) {}

  /** Fetch mock users, optionally filtered by role */
  getUsers(role?: string): Observable<User[]> {
    if (this.isDeployedWithoutBackend()) {
      return of(this.getDemoUsers(role));
    }

    let params = new HttpParams();
    if (role) {
      params = params.set('role', role);
    }
    return this.http.get<User[]>(`${this.API_URL}/users`, { params }).pipe(
      timeout(8000),
      catchError(() => of(this.getDemoUsers(role))),
    );
  }

  /** Fetch delivery requests for a specific role and user */
  getRequests(role: string, userId: string): Observable<DeliveryRequest[]> {
    if (this.isDeployedWithoutBackend()) {
      return of(
        this.demoRequests.filter(
          (request) =>
            (role === 'retailer' && request.retailer_id === userId) ||
            role === 'dispatcher' ||
            (role === 'rider' && request.assigned_rider_id === userId),
        ),
      );
    }

    const params = new HttpParams()
      .set('role', role)
      .set('userId', userId);
    return this.http.get<DeliveryRequest[]>(`${this.API_URL}/requests`, { params }).pipe(
      timeout(8000),
      catchError(() =>
        of(
          this.demoRequests.filter(
            (request) =>
              (role === 'retailer' && request.retailer_id === userId) ||
              role === 'dispatcher' ||
              (role === 'rider' && request.assigned_rider_id === userId),
          ),
        ),
      ),
    );
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
    if (
      typeof window !== 'undefined' &&
      !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      this.API_URL.includes('localhost')
    ) {
      return of(this.saveDemoRequest(data));
    }

    return this.http.post<DeliveryRequest>(`${this.API_URL}/requests`, data).pipe(
      timeout(8000),
      catchError(() => of(this.saveDemoRequest(data))),
    );
  }

  private getDemoUsers(role?: string): User[] {
    const users: User[] = [
      { id: 'ret-101', name: 'Mama Mboga Groceries (Kilimani)', phone: '+254712345678', role: 'retailer' },
      { id: 'ret-102', name: 'Nairobi Tech Hub (Westlands)', phone: '+254722998877', role: 'retailer' },
      { id: 'disp-201', name: 'Central Nairobi Logistics Hub', phone: '+254700000000', role: 'dispatcher' },
      { id: 'rider-301', name: 'James Omondi (Boda Boda KCB-123A)', phone: '+254733112233', role: 'rider' },
      { id: 'rider-302', name: 'Wanjiku Kamau (Express Bike)', phone: '+254744556677', role: 'rider' },
    ];

    return role ? users.filter((user) => user.role === role) : users;
  }

  private saveDemoRequest(data: {
    retailer_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    item_description: string;
  }): DeliveryRequest {
    const request = this.createDemoRequest(data);
    this.demoRequests.unshift(request);
    return request;
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
    if (this.isDeployedWithoutBackend()) {
      return of(this.assignDemoRequest(deliveryId, riderId));
    }

    return this.http.post<DeliveryRequest>(`${this.API_URL}/requests/${deliveryId}/assign`, {
      riderId,
      dispatcherId,
    }).pipe(
      timeout(8000),
      catchError(() => of(this.assignDemoRequest(deliveryId, riderId))),
    );
  }

  private assignDemoRequest(deliveryId: string, riderId: string): DeliveryRequest {
    const request = this.demoRequests.find((item) => item.id === deliveryId);
    if (!request) {
      throw new Error('Demo delivery request was not found');
    }

    request.assigned_rider_id = riderId;
    request.status = 'ASSIGNED';
    request.updated_at = new Date().toISOString();
    request.assigned_rider = this.getDemoUsers('rider').find((user) => user.id === riderId) || null;
    return request;
  }

  private isDeployedWithoutBackend(): boolean {
    return (
      typeof window !== 'undefined' &&
      !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      this.API_URL.includes('localhost')
    );
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
