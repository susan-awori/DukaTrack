import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
import { DeliveryRequest, User } from '../../models/delivery.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dispatcher-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dispatcher-container">
      <div class="view-header">
        <h2>🏢 Central Dispatcher Hub — {{ user.name }}</h2>
        <p class="subtitle">Live queue of open delivery requests from Kenya retailers. Assign riders in real-time.</p>
      </div>

      <div class="stats-bar">
        <div class="stat-card highlight">
          <div class="stat-number">{{ openRequests.length }}</div>
          <div class="stat-label">Pending Assignment (REQUESTED)</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ activeAssignments.length }}</div>
          <div class="stat-label">In Progress (ASSIGNED / PICKED_UP)</div>
        </div>
        <div class="stat-card success">
          <div class="stat-number">{{ completedDeliveries.length }}</div>
          <div class="stat-label">Completed (DELIVERED)</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>⚡ Incoming Open Requests</h3>
          <span class="live-badge">🟢 Real-time Socket Room: 'dispatchers'</span>
        </div>

        @if (openRequests.length === 0) {
          <div class="empty-state">
            🎉 All caught up! No unassigned delivery requests right now. New requests will appear here instantly.
          </div>
        }

        @if (openRequests.length > 0) {
          <div class="grid-list">
            @for (req of openRequests; track req.id) {
              <div class="request-card">
                <div class="card-top">
                  <span class="req-id">#{{ req.id.substring(0, 8) }}</span>
                  <span class="badge-tag">REQUESTED</span>
                </div>

                <div class="req-title">{{ req.item_description }}</div>

                <div class="req-info">
                  <div><strong>Store:</strong> {{ req.retailer?.name || 'Retailer' }}</div>
                  <div><strong>Customer:</strong> {{ req.customer_name }} ({{ req.customer_phone }})</div>
                  <div><strong>Destination:</strong> {{ req.customer_address }}</div>
                  <div><strong>Requested At:</strong> {{ req.created_at | date:'shortTime' }}</div>
                </div>

                <div class="assign-box">
                  <label>Select Rider to Assign:</label>
                  <div class="assign-controls">
                    <select [(ngModel)]="selectedRiders[req.id]" class="rider-select">
                      <option value="">-- Choose Rider --</option>
                      @for (rider of riders; track rider.id) {
                        <option [value]="rider.id">
                          🏍️ {{ rider.name }} ({{ rider.phone }})
                        </option>
                      }
                    </select>
                    <button 
                      class="btn btn-primary" 
                      [disabled]="!selectedRiders[req.id]"
                      (click)="assignRider(req)">
                      Assign Rider
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Active / Completed Deliveries Overview Table -->
      <div class="card margin-top">
        <h3>📊 All Platform Deliveries Overview</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Retailer</th>
                <th>Item</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Assigned Rider</th>
                <th>QR Token</th>
              </tr>
            </thead>
            <tbody>
              @for (req of allRequests; track req.id) {
                <tr>
                  <td><code>#{{ req.id.substring(0, 8) }}</code></td>
                  <td>{{ req.retailer?.name || 'Retailer' }}</td>
                  <td><strong>{{ req.item_description }}</strong></td>
                  <td>{{ req.customer_name }}</td>
                  <td>
                    <span class="status-pill" [ngClass]="'status-' + req.status.toLowerCase()">
                      {{ req.status }}
                    </span>
                  </td>
                  <td>{{ req.assigned_rider?.name || '— Unassigned —' }}</td>
                  <td><code>{{ req.qr_code_token }}</code></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dispatcher-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .view-header h2 { margin: 0; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
    
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .stat-card {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 16px 20px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .stat-card.highlight { border-left: 4px solid #0284c7; }
    .stat-card.success { border-left: 4px solid #16a34a; }
    .stat-number { font-size: 28px; font-weight: 800; color: #0f172a; }
    .stat-label { font-size: 13px; color: #64748b; font-weight: 600; }

    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
    }
    .margin-top { margin-top: 10px; }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-header h3 { margin: 0; color: #0f172a; }
    .live-badge {
      background: #ecfdf5;
      color: #047857;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid #a7f3d0;
    }
    .grid-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    .request-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .req-id { font-weight: 700; color: #64748b; font-size: 12px; }
    .badge-tag {
      background: #fef3c7; color: #b45309;
      font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;
    }
    .req-title {
      font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 10px;
    }
    .req-info {
      font-size: 13px; color: #334155; display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;
    }
    .assign-box {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
    .assign-box label { font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 6px; }
    .assign-controls { display: flex; gap: 8px; }
    .rider-select {
      flex: 1;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 13px;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #0284c7; color: white; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }

    .empty-state { text-align: center; color: #64748b; padding: 40px; }

    /* Table styles */
    .table-responsive { overflow-x: auto; margin-top: 12px; }
    .data-table {
      width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;
    }
    .data-table th, .data-table td {
      padding: 10px 12px; border-bottom: 1px solid #e2e8f0;
    }
    .data-table th { background: #f1f5f9; color: #475569; font-weight: 700; }
    .status-pill {
      font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;
    }
    .status-requested { background: #fef3c7; color: #b45309; }
    .status-assigned { background: #dbeafe; color: #1e40af; }
    .status-picked_up { background: #e0e7ff; color: #3730a3; }
    .status-delivered { background: #dcfce7; color: #166534; }
  `],
})
export class DispatcherViewComponent implements OnInit, OnChanges {
  @Input() user!: User;

  public allRequests: DeliveryRequest[] = [];
  public openRequests: DeliveryRequest[] = [];
  public activeAssignments: DeliveryRequest[] = [];
  public completedDeliveries: DeliveryRequest[] = [];
  public riders: User[] = [];

  public selectedRiders: { [deliveryId: string]: string } = {};

  private newReqSub: Subscription | null = null;
  private statusSub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.loadRiders();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.loadAllRequests();
      this.setupSocketListeners();
    }
  }

  private loadRiders(): void {
    this.apiService.getUsers('rider').subscribe({
      next: (data) => (this.riders = data),
      error: (err) => console.error('Failed to load riders:', err),
    });
  }

  private loadAllRequests(): void {
    this.apiService.getRequests('dispatcher', this.user.id).subscribe({
      next: (requests) => {
        this.allRequests = requests;
        this.categorizeRequests();
      },
      error: (err) => console.error('Failed to load dispatcher requests:', err),
    });
  }

  private categorizeRequests(): void {
    this.openRequests = this.allRequests.filter((r) => r.status === 'REQUESTED');
    this.activeAssignments = this.allRequests.filter(
      (r) => r.status === 'ASSIGNED' || r.status === 'PICKED_UP'
    );
    this.completedDeliveries = this.allRequests.filter((r) => r.status === 'DELIVERED');
  }

  private setupSocketListeners(): void {
    if (this.newReqSub) this.newReqSub.unsubscribe();
    if (this.statusSub) this.statusSub.unsubscribe();

    this.newReqSub = this.socketService.newRequest$.subscribe({
      next: (newDelivery) => {
        console.log('[Dispatcher View] New request received via socket:', newDelivery);
        const exists = this.allRequests.some((r) => r.id === newDelivery.id);
        if (!exists) {
          this.allRequests.unshift(newDelivery);
          this.categorizeRequests();
        }
      },
    });

    this.statusSub = this.socketService.statusUpdated$.subscribe({
      next: (updatedDelivery) => {
        console.log('[Dispatcher View] Delivery status updated via socket:', updatedDelivery);
        const index = this.allRequests.findIndex((r) => r.id === updatedDelivery.id);
        if (index !== -1) {
          this.allRequests[index] = updatedDelivery;
        } else {
          this.allRequests.unshift(updatedDelivery);
        }
        this.categorizeRequests();
      },
    });
  }

  public assignRider(delivery: DeliveryRequest): void {
    const riderId = this.selectedRiders[delivery.id];
    if (!riderId) return;

    this.apiService.assignRider(delivery.id, riderId, this.user.id).subscribe({
      next: (updated) => {
        const index = this.allRequests.findIndex((r) => r.id === updated.id);
        if (index !== -1) {
          this.allRequests[index] = updated;
          this.categorizeRequests();
        }
      },
      error: (err) => console.error('Failed to assign rider:', err),
    });
  }
}
