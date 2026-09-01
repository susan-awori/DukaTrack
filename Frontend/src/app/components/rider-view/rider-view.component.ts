import { Component, Input, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
import { DeliveryRequest, User } from '../../models/delivery.model';
import { Subscription } from 'rxjs';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-rider-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rider-container">
      <div class="view-header">
        <h2>🏍️ Rider Portal — {{ user.name }}</h2>
        <p class="subtitle">Your active assigned deliveries. Update status to 'Picked Up' or scan QR code to confirm delivery.</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>📦 My Assigned Deliveries ({{ assignedDeliveries.length }})</h3>
          <span class="live-badge">🟢 Real-time Socket Room: 'rider_{{ user.id }}'</span>
        </div>

        @if (assignedDeliveries.length === 0) {
          <div class="empty-state">
            No deliveries assigned to you yet. When a dispatcher assigns a request to you, it will appear here in real-time.
          </div>
        }

        @if (assignedDeliveries.length > 0) {
          <div class="delivery-cards">
            @for (req of assignedDeliveries; track req.id) {
              <div class="delivery-card" [class.delivered]="req.status === 'DELIVERED'">
                <div class="card-top">
                  <span class="req-id">#{{ req.id.substring(0, 8) }}</span>
                  <span class="status-badge" [ngClass]="getStatusBadgeClass(req.status)">
                    {{ req.status }}
                  </span>
                </div>

                <div class="req-title">{{ req.item_description }}</div>

                <div class="req-info">
                  <div><strong>Store (Retailer):</strong> {{ req.retailer?.name || 'Retailer' }}</div>
                  <div><strong>Customer Name:</strong> {{ req.customer_name }}</div>
                  <div><strong>Customer Phone:</strong> 📞 <a [href]="'tel:' + req.customer_phone">{{ req.customer_phone }}</a></div>
                  <div><strong>Delivery Address:</strong> 📍 {{ req.customer_address }}</div>
                </div>

                @if (req.status !== 'DELIVERED') {
                  <div class="action-bar">
                    <!-- Step 1: Picked Up Button -->
                    @if (req.status === 'ASSIGNED') {
                      <button 
                        class="btn btn-warning" 
                        (click)="markPickedUp(req)">
                        🚚 Mark as Picked Up
                      </button>
                    }

                    <!-- Step 2: Scan QR to Confirm Delivery -->
                    @if (req.status === 'PICKED_UP') {
                      <button 
                        class="btn btn-success" 
                        (click)="openQrScannerModal(req)">
                        📷 Scan QR to Confirm Delivery
                      </button>
                    }
                  </div>
                }

                @if (req.status === 'DELIVERED') {
                  <div class="delivered-banner">
                    ✅ Verified Delivered via QR Code Proof
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- QR Code Scanner Modal -->
    @if (activeScanDelivery) {
      <div class="modal-backdrop" (click)="closeScannerModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>📷 Scan Delivery QR Code</h3>
            <button class="close-btn" (click)="closeScannerModal()">×</button>
          </div>

          <div class="modal-body">
            <p class="modal-instruct">
              Scan the customer's QR code or enter the QR token manually to complete proof of delivery for 
              <strong>#{{ activeScanDelivery.id.substring(0, 8) }}</strong>.
            </p>

            <!-- Camera Stream Container for html5-qrcode -->
            <div id="reader" style="width: 100%; min-height: 250px; background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 16px;"></div>

            <div class="manual-input-box">
              <label class="manual-label">Or enter scanned QR Token manually:</label>
              <div class="input-group">
                <input 
                  type="text" 
                  [(ngModel)]="manualToken" 
                  placeholder="e.g. DUKATRACK-A1B2C3D4" 
                  class="token-input" />
                <button class="btn btn-primary" (click)="submitToken(manualToken)">
                  Confirm
                </button>
              </div>
            </div>

            @if (scanErrorMessage) {
              <div class="error-banner">
                ⚠️ {{ scanErrorMessage }}
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .rider-container { display: flex; flex-direction: column; gap: 20px; }
    .view-header h2 { margin: 0; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }

    .card {
      background: white; border-radius: 12px; padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header h3 { margin: 0; color: #0f172a; }
    .live-badge {
      background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 700;
      padding: 4px 10px; border-radius: 20px; border: 1px solid #bfdbfe;
    }
    .delivery-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
    .delivery-card {
      border: 2px solid #cbd5e1; border-radius: 12px; padding: 18px; background: #ffffff;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .delivery-card.delivered { border-color: #86efac; background: #f0fdf4; }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .req-id { font-weight: 700; color: #64748b; font-size: 13px; }
    .status-badge {
      padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase;
    }
    .badge-assigned { background: #dbeafe; color: #1e40af; }
    .badge-picked_up { background: #fef3c7; color: #b45309; }
    .badge-delivered { background: #dcfce7; color: #166534; }

    .req-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .req-info { font-size: 14px; color: #334155; display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .req-info a { color: #0284c7; text-decoration: none; font-weight: 600; }

    .action-bar { border-top: 1px solid #e2e8f0; padding-top: 14px; }
    .btn {
      width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; border: none;
    }
    .btn-warning { background: #d97706; color: white; }
    .btn-warning:hover { background: #b45309; }
    .btn-success { background: #16a34a; color: white; }
    .btn-success:hover { background: #15803d; }
    .btn-primary { background: #0284c7; color: white; width: auto; }

    .delivered-banner {
      background: #dcfce7; color: #15803d; font-weight: 700; font-size: 13px; text-align: center;
      padding: 10px; border-radius: 8px; border: 1px solid #86efac; margin-top: 10px;
    }

    .empty-state { text-align: center; color: #94a3b8; padding: 40px; }

    /* Modal styling */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal-card {
      background: white; border-radius: 12px; width: 450px; max-width: 90vw; padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; }
    .modal-instruct { font-size: 13px; color: #475569; margin-bottom: 12px; }
    .manual-input-box { margin-top: 14px; }
    .manual-label { font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 6px; }
    .input-group { display: flex; gap: 8px; }
    .token-input {
      flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; text-transform: uppercase;
    }
    .error-banner {
      background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px; border-radius: 6px;
      font-size: 13px; margin-top: 14px; font-weight: 600;
    }
  `],
})
export class RiderViewComponent implements OnChanges, OnDestroy {
  @Input() user!: User;

  public assignedDeliveries: DeliveryRequest[] = [];
  public activeScanDelivery: DeliveryRequest | null = null;
  public manualToken: string = '';
  public scanErrorMessage: string | null = null;

  private html5QrScanner: Html5Qrcode | null = null;
  private assignedSub: Subscription | null = null;
  private statusSub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private socketService: SocketService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.loadAssignedDeliveries();
      this.setupSocketListeners();
    }
  }

  public getStatusBadgeClass(status: string): string {
    return `badge-${status.toLowerCase()}`;
  }

  private loadAssignedDeliveries(): void {
    this.apiService.getRequests('rider', this.user.id).subscribe({
      next: (data) => (this.assignedDeliveries = data),
      error: (err) => console.error('Failed to load rider deliveries:', err),
    });
  }

  private setupSocketListeners(): void {
    if (this.assignedSub) this.assignedSub.unsubscribe();
    if (this.statusSub) this.statusSub.unsubscribe();

    this.assignedSub = this.socketService.assigned$.subscribe({
      next: (assignedDelivery) => {
        console.log('[Rider View] Delivery assigned to me via socket:', assignedDelivery);
        const index = this.assignedDeliveries.findIndex((r) => r.id === assignedDelivery.id);
        if (index !== -1) {
          this.assignedDeliveries[index] = assignedDelivery;
        } else {
          this.assignedDeliveries.unshift(assignedDelivery);
        }
      },
    });

    this.statusSub = this.socketService.statusUpdated$.subscribe({
      next: (updatedDelivery) => {
        console.log('[Rider View] Delivery status updated via socket:', updatedDelivery);
        const index = this.assignedDeliveries.findIndex((r) => r.id === updatedDelivery.id);
        if (index !== -1) {
          this.assignedDeliveries[index] = updatedDelivery;
        }
      },
    });
  }

  public markPickedUp(delivery: DeliveryRequest): void {
    this.apiService.updateStatus(delivery.id, 'PICKED_UP', this.user.id).subscribe({
      next: (updated) => {
        const index = this.assignedDeliveries.findIndex((r) => r.id === updated.id);
        if (index !== -1) {
          this.assignedDeliveries[index] = updated;
        }
      },
      error: (err) => console.error('Failed to mark as picked up:', err),
    });
  }

  public openQrScannerModal(delivery: DeliveryRequest): void {
    this.activeScanDelivery = delivery;
    this.manualToken = '';
    this.scanErrorMessage = null;

    setTimeout(() => {
      this.initCameraScanner();
    }, 200);
  }

  private initCameraScanner(): void {
    const readerDiv = document.getElementById('reader');
    if (!readerDiv) return;

    this.html5QrScanner = new Html5Qrcode('reader');
    this.html5QrScanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          console.log('[Camera QR Scan Success] Decoded token:', decodedText);
          this.submitToken(decodedText);
        },
        () => {
          // parse errors on frames ignored
        }
      )
      .catch((err) => {
        console.warn('[Camera Scanner Warning] Camera access not available:', err);
      });
  }

  public submitToken(token: string): void {
    if (!token || !this.activeScanDelivery) return;

    this.scanErrorMessage = null;
    this.apiService
      .confirmDelivery(this.activeScanDelivery.id, token, this.user.id)
      .subscribe({
        next: (updated) => {
          console.log('[Rider View] Delivery confirmed successfully:', updated);
          const index = this.assignedDeliveries.findIndex((r) => r.id === updated.id);
          if (index !== -1) {
            this.assignedDeliveries[index] = updated;
          }
          this.closeScannerModal();
        },
        error: (err) => {
          console.error('QR Confirm Error:', err);
          this.scanErrorMessage =
            err.error?.error || 'Invalid QR code token! Delivery status remains unchanged.';
        },
      });
  }

  public closeScannerModal(): void {
    if (this.html5QrScanner) {
      this.html5QrScanner
        .stop()
        .then(() => {
          this.html5QrScanner?.clear();
          this.html5QrScanner = null;
        })
        .catch(() => {
          this.html5QrScanner = null;
        });
    }
    this.activeScanDelivery = null;
    this.manualToken = '';
    this.scanErrorMessage = null;
  }

  ngOnDestroy(): void {
    this.closeScannerModal();
  }
}
