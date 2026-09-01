import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { DeliveryRequest, UserRole } from '../models/delivery.model';

@Injectable({
  providedIn: 'root',
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly SERVER_URL = 'http://localhost:3000';

  private newRequestSubject = new Subject<DeliveryRequest>();
  private assignedSubject = new Subject<DeliveryRequest>();
  private statusUpdatedSubject = new Subject<DeliveryRequest>();

  public newRequest$: Observable<DeliveryRequest> = this.newRequestSubject.asObservable();
  public assigned$: Observable<DeliveryRequest> = this.assignedSubject.asObservable();
  public statusUpdated$: Observable<DeliveryRequest> = this.statusUpdatedSubject.asObservable();

  constructor() {
    this.initSocket();
  }

  private initSocket(): void {
    if (this.socket) return;

    console.log('[SocketService] Connecting to backend at', this.SERVER_URL);
    this.socket = io(this.SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] Socket connected successfully:', this.socket?.id);
    });

    this.socket.on('new_request', (delivery: DeliveryRequest) => {
      console.log('[SocketService] Event received: new_request', delivery);
      this.newRequestSubject.next(delivery);
    });

    this.socket.on('assigned', (delivery: DeliveryRequest) => {
      console.log('[SocketService] Event received: assigned', delivery);
      this.assignedSubject.next(delivery);
    });

    this.socket.on('status_updated', (delivery: DeliveryRequest) => {
      console.log('[SocketService] Event received: status_updated', delivery);
      this.statusUpdatedSubject.next(delivery);
    });

    this.socket.on('disconnect', () => {
      console.warn('[SocketService] Socket disconnected from server');
    });
  }

  /**
   * Join targeted Socket.io room based on user role and ID.
   * Cleans up room membership on role switch.
   */
  public joinRoom(role: UserRole, userId: string): void {
    if (!this.socket) {
      this.initSocket();
    }
    console.log(`[SocketService] Requesting join_room -> role: ${role}, userId: ${userId}`);
    this.socket?.emit('join_room', { role, userId });
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
