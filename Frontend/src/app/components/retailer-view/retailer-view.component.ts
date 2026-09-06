import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
import { DeliveryRequest, StatusEvent, User } from '../../models/delivery.model';
import { finalize, Subscription } from 'rxjs';

@Component({
  selector: 'app-retailer-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="retailer-container">
      <div class="view-header">
        <h2>🛍️ Retailer Dashboard — {{ user.name }}</h2>
        <p class="subtitle">Create delivery requests, view generated QR codes, and track live delivery updates.</p>
      </div>

      <div class="main-grid">
        <!-- New Request Creation Form -->
        <div class="card form-card">
          <h3>📦 Create Delivery Request</h3>
          <form (ngSubmit)="createDelivery()">
            <div class="form-group">
              <label>Customer Name *</label>
              <input type="text" [(ngModel)]="newRequest.customer_name" name="customer_name" required placeholder="e.g. Achieng Odhiambo" />
            </div>

            <div class="form-group">
              <label>Customer Phone *</label>
              <input type="text" [(ngModel)]="newRequest.customer_phone" name="customer_phone" required placeholder="e.g. +254700112233" />
            </div>

            <div class="form-group">
              <label>Delivery Address *</label>
              <input type="text" [(ngModel)]="newRequest.customer_address" name="customer_address" required placeholder="e.g. House 14, Ring Road Kilimani, Nairobi" />
            </div>

            <div class="form-group">
              <label>Item Description *</label>
              <textarea [(ngModel)]="newRequest.item_description" name="item_description" rows="3" required placeholder="e.g. 1x Sack of Organic Carrots, 2x Cabbage Boxes"></textarea>
            </div>

            <button type="submit" class="btn btn-primary" [disabled]="isSubmitting">
              {{ isSubmitting ? 'Creating...' : '➕ Dispatch Delivery Request' }}
            </button>
          </form>
        </div>

        <!-- My Delivery Requests List -->
        <div class="card list-card">
          <div class="card-header">
            <h3>📋 My Delivery Requests ({{ requests.length }})</h3>
            <span class="live-indicator">🔴 Live Sync Active</span>
          </div>

          @if (requests.length === 0) {
            <div class="empty-state">
              No delivery requests created yet. Use the form on the left to dispatch your first order.
            </div>
          }

          @if (requests.length > 0) {
            <div class="request-items">
              @for (req of requests; track req.id) {
                <div class="request-item" [class.delivered]="req.status === 'DELIVERED'">
                  <div class="item-header">
                    <span class="item-id">#{{ req.id.substring(0, 8) }}</span>
                    <span class="status-badge" [ngClass]="getStatusBadgeClass(req.status)">
                      {{ getStatusLabel(req.status) }}
                    </span>
                  </div>

                  <div class="item-body">
                    <div class="item-title">{{ req.item_description }}</div>
                    <div class="item-detail"><strong>Customer:</strong> {{ req.customer_name }} ({{ req.customer_phone }})</div>
                    <div class="item-detail"><strong>Address:</strong> {{ req.customer_address }}</div>
                    @if (req.assigned_rider) {
                      <div class="item-detail">
                        <strong>Assigned Rider:</strong> 🏍️ {{ req.assigned_rider.name }}
                      </div>
                    }
                    <div class="token-tag">
                      🔑 <strong>QR Token:</strong> <code>{{ req.qr_code_token }}</code>
                    </div>
                  </div>

                  <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" (click)="openQrModal(req)">
                      📱 Show QR Code
                    </button>
                    <button class="btn btn-outline btn-sm" (click)="openHistoryModal(req)">
                      📜 Proof of Delivery Log
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- QR Code Display Modal -->
    @if (activeQrDelivery) {
      <div class="modal-backdrop" (click)="closeQrModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>📱 QR Code Proof of Delivery</h3>
            <button class="close-btn" (click)="closeQrModal()">×</button>
          </div>
          <div class="modal-body text-center">
            <p>Rider will scan this QR Code upon arrival to confirm delivery.</p>
            @if (qrDataUrl) {
              <div class="qr-wrapper">
                <img [src]="qrDataUrl" alt="Delivery QR Code" />
              </div>
            }
            <div class="token-display">
              Token: <strong>{{ activeQrDelivery.qr_code_token }}</strong>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Status History Modal -->
    @if (activeHistoryDelivery) {
      <div class="modal-backdrop" (click)="closeHistoryModal()">
        <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>📜 Immutable Audit Trail — Delivery #{{ activeHistoryDelivery.id.substring(0, 8) }}</h3>
            <button class="close-btn" (click)="closeHistoryModal()">×</button>
          </div>
          <div class="modal-body">
            <p class="help-note">
              Every status change writes a permanent, transaction-safe StatusEvent row. This log is the proof of delivery record.
            </p>

            <div class="timeline">
              @for (ev of historyEvents; track ev.id) {
                <div class="timeline-event">
                  <div class="timeline-badge" [class.qr-badge]="ev.method === 'qr_scan'">
                    {{ ev.method === 'qr_scan' ? '📷 QR' : '✍️ Manual' }}
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-title">
                      Status set to <strong>{{ ev.to_status }}</strong>
                      @if (ev.from_status) {
                        <span> (from {{ ev.from_status }})</span>
                      }
                    </div>
                    <div class="timeline-meta">
                      <span>Actor: <strong>{{ ev.actor?.name || ev.actor_role }}</strong></span> |
                      <span>Method: <code>{{ ev.method }}</code></span> |
                      <span>Time: {{ ev.timestamp | date:'medium' }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .retailer-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .view-header h2 {
      margin: 0;
      color: #0f172a;
    }
    .subtitle {
      color: #64748b;
      font-size: 14px;
      margin-top: 4px;
    }
    .main-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
      border: 1px solid #e2e8f0;
    }
    .card h3 {
      margin-top: 0;
      color: #1e293b;
      font-size: 18px;
    }
    .form-group {
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .form-group input, .form-group textarea {
      padding: 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    .btn {
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #0284c7;
      color: white;
      width: 100%;
    }
    .btn-primary:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #0f172a;
      color: white;
    }
    .btn-outline {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #334155;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .live-indicator {
      font-size: 12px;
      color: #ef4444;
      font-weight: 600;
    }
    .request-items {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .request-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: #f8fafc;
    }
    .request-item.delivered {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .item-id {
      font-weight: 700;
      color: #64748b;
      font-size: 13px;
    }
    .status-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-requested { background: #fef3c7; color: #b45309; }
    .badge-assigned { background: #dbeafe; color: #1e40af; }
    .badge-picked_up { background: #e0e7ff; color: #3730a3; }
    .badge-delivered { background: #dcfce7; color: #166534; }

    .item-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 16px;
      margin-bottom: 6px;
    }
    .item-detail {
      font-size: 13px;
      color: #475569;
      margin-bottom: 4px;
    }
    .token-tag {
      margin-top: 8px;
      font-size: 12px;
      background: #ffffff;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      display: inline-block;
    }
    .item-actions {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    .empty-state {
      text-align: center;
      color: #94a3b8;
      padding: 40px;
    }

    /* Modal Styling */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-card {
      background: white;
      border-radius: 12px;
      width: 420px;
      max-width: 90vw;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    }
    .modal-lg {
      width: 650px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
    }
    .qr-wrapper img {
      width: 200px;
      height: 200px;
      margin: 12px auto;
    }
    .token-display {
      background: #f1f5f9;
      padding: 8px;
      border-radius: 6px;
      margin-top: 10px;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    .timeline-event {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border-left: 2px solid #cbd5e1;
      padding-left: 12px;
    }
    .timeline-badge {
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .timeline-badge.qr-badge {
      background: #dcfce7;
      color: #15803d;
    }
    .timeline-title {
      font-size: 14px;
      color: #0f172a;
    }
    .timeline-meta {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .help-note {
      font-size: 12px;
      color: #0284c7;
      background: #f0f9ff;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #0284c7;
    }
  `],
})
export class RetailerViewComponent implements OnChanges {
  @Input() user!: User;

  public requests: DeliveryRequest[] = [];
  public isSubmitting = false;

  public newRequest = {
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    item_description: '',
  };

  public activeQrDelivery: DeliveryRequest | null = null;
  public qrDataUrl: string | null = null;

  public activeHistoryDelivery: DeliveryRequest | null = null;
  public historyEvents: StatusEvent[] = [];

  private socketSub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private socketService: SocketService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.loadRequests();
      this.setupSocketListener();
    }
  }

  private loadRequests(): void {
    this.apiService.getRequests('retailer', this.user.id).subscribe({
      next: (data) => (this.requests = data),
      error: (err) => console.error('Failed to load retailer requests:', err),
    });
  }

  private setupSocketListener(): void {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
    }

    this.socketSub = this.socketService.statusUpdated$.subscribe({
      next: (updatedDelivery) => {
        console.log('[Retailer View] Live status updated via socket:', updatedDelivery);
        const index = this.requests.findIndex((r) => r.id === updatedDelivery.id);
        if (index !== -1) {
          this.requests[index] = updatedDelivery;
        } else if (updatedDelivery.retailer_id === this.user.id) {
          this.requests.unshift(updatedDelivery);
        }
      },
    });
  }

  public createDelivery(): void {
    if (!this.newRequest.customer_name || !this.newRequest.customer_address || !this.newRequest.item_description) {
      return;
    }

    this.isSubmitting = true;
    this.apiService
      .createRequest({
        retailer_id: this.user.id,
        customer_name: this.newRequest.customer_name,
        customer_phone: this.newRequest.customer_phone,
        customer_address: this.newRequest.customer_address,
        item_description: this.newRequest.item_description,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (created) => {
          this.newRequest = { customer_name: '', customer_phone: '', customer_address: '', item_description: '' };
          const exists = this.requests.some((r) => r.id === created.id);
          if (!exists) {
            this.requests.unshift(created);
          }
        },
        error: (err) => {
          console.error('Failed to create delivery:', err);
        },
      });
  }

  public openQrModal(delivery: DeliveryRequest): void {
    this.activeQrDelivery = delivery;
    this.qrDataUrl = null;
    this.apiService.getQRCode(delivery.id).subscribe({
      next: (res) => (this.qrDataUrl = res.qrDataUrl),
      error: (err) => console.error('Failed to fetch QR code:', err),
    });
  }

  public closeQrModal(): void {
    this.activeQrDelivery = null;
    this.qrDataUrl = null;
  }

  public openHistoryModal(delivery: DeliveryRequest): void {
    this.activeHistoryDelivery = delivery;
    this.apiService.getStatusHistory(delivery.id).subscribe({
      next: (events) => (this.historyEvents = events),
      error: (err) => console.error('Failed to fetch history:', err),
    });
  }

  public closeHistoryModal(): void {
    this.activeHistoryDelivery = null;
    this.historyEvents = [];
  }

  public getStatusBadgeClass(status: string): string {
    return `badge-${status.toLowerCase()}`;
  }

  public getStatusLabel(status: string): string {
    switch (status) {
      case 'REQUESTED': return '⏳ Open Request';
      case 'ASSIGNED': return '🏍️ Rider Assigned';
      case 'PICKED_UP': return '📦 Picked Up';
      case 'DELIVERED': return '✅ Delivered (QR Verified)';
      default: return status;
    }
  }
}
