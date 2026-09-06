import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { User, UserRole } from '../../models/delivery.model';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="role-selector-card">
      <div class="header-section">
        <div class="logo">
          <span class="logo-icon">⚡</span>
          <span class="logo-text">DUKATRACK</span>
          <span class="badge-tag">Delivery Coordination MVP</span>
        </div>
        <div class="sub-text">Kenyan Retailer - Dispatcher - Rider Real-time Platform</div>
      </div>

      <div class="selector-controls">
        <div class="control-group">
          <label class="control-label">1. Select Role:</label>
          <div class="role-buttons">
            <button 
              type="button" 
              class="role-btn" 
              [class.active]="selectedRole === 'retailer'"
              (click)="onRoleChange('retailer')">
              🛍️ Retailer
            </button>
            <button 
              type="button" 
              class="role-btn" 
              [class.active]="selectedRole === 'dispatcher'"
              (click)="onRoleChange('dispatcher')">
              🏢 Dispatcher
            </button>
            <button 
              type="button" 
              class="role-btn" 
              [class.active]="selectedRole === 'rider'"
              (click)="onRoleChange('rider')">
              🏍️ Rider
            </button>
          </div>
        </div>

        @if (selectedRole !== 'dispatcher') {
          <div class="control-group">
            <label class="control-label">2. Select Persona / User:</label>
            <select 
              class="user-select" 
              [(ngModel)]="selectedUserId" 
              (change)="onUserChange()">
              @for (u of filteredUsers; track u.id) {
                <option [value]="u.id">
                  {{ u.name }} ({{ u.phone }})
                </option>
              }
            </select>
          </div>
        }

        @if (selectedRole === 'dispatcher') {
          <div class="control-group">
            <label class="control-label">2. Persona / User:</label>
            @if (activeUser) {
              <div class="dispatcher-active-label">
                🏢 {{ activeUser.name }} (Hub Central)
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .role-selector-card {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      padding: 18px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      margin-bottom: 24px;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 12px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-icon {
      font-size: 24px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #38bdf8;
    }
    .badge-tag {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .sub-text {
      color: #94a3b8;
      font-size: 13px;
    }
    .selector-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: center;
    }
    .control-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .control-label {
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .role-buttons {
      display: flex;
      gap: 10px;
    }
    .role-btn {
      background: #334155;
      color: #e2e8f0;
      border: 1px solid #475569;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .role-btn:hover {
      background: #475569;
      border-color: #64748b;
    }
    .role-btn.active {
      background: #0284c7;
      color: #ffffff;
      border-color: #38bdf8;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
    }
    .user-select {
      background: #334155;
      color: #ffffff;
      border: 1px solid #475569;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      min-width: 280px;
    }
    .dispatcher-active-label {
      background: rgba(2, 132, 199, 0.2);
      border: 1px solid #0284c7;
      padding: 8px 14px;
      border-radius: 8px;
      color: #7dd3fc;
      font-size: 14px;
      font-weight: 600;
    }
  `],
})
export class RoleSelectorComponent implements OnInit {
  @Output() roleChange = new EventEmitter<{ role: UserRole; user: User }>();

  private readonly sampleUsers: User[] = [
    {
      id: 'ret-101',
      name: 'Mama Mboga Groceries (Kilimani)',
      phone: '+254712345678',
      role: 'retailer',
    },
    {
      id: 'ret-102',
      name: 'Nairobi Tech Hub (Westlands)',
      phone: '+254722998877',
      role: 'retailer',
    },
    {
      id: 'disp-201',
      name: 'Central Nairobi Logistics Hub',
      phone: '+254700000000',
      role: 'dispatcher',
    },
    {
      id: 'rider-301',
      name: 'James Omondi (Boda Boda KCB-123A)',
      phone: '+254733112233',
      role: 'rider',
    },
    {
      id: 'rider-302',
      name: 'Wanjiku Kamau (Express Bike)',
      phone: '+254744556677',
      role: 'rider',
    },
  ];

  public allUsers: User[] = [];
  public filteredUsers: User[] = [];
  public selectedRole: UserRole = 'retailer';
  public selectedUserId: string = '';
  public activeUser: User | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.apiService.getUsers().subscribe({
      next: (users) => {
        this.allUsers = users;
        this.onRoleChange(this.selectedRole);
      },
      error: (err) => {
        console.error('Failed to load users; using sample personas:', err);
        this.allUsers = this.sampleUsers;
        this.onRoleChange(this.selectedRole);
      },
    });
  }

  public onRoleChange(role: UserRole): void {
    this.selectedRole = role;
    this.filteredUsers = this.allUsers.filter((u) => u.role === role);

    if (this.filteredUsers.length > 0) {
      this.selectedUserId = this.filteredUsers[0].id;
      this.activeUser = this.filteredUsers[0];
    } else {
      this.selectedUserId = '';
      this.activeUser = null;
    }

    this.emitSelection();
  }

  public onUserChange(): void {
    this.activeUser = this.allUsers.find((u) => u.id === this.selectedUserId) || null;
    this.emitSelection();
  }

  private emitSelection(): void {
    if (this.activeUser) {
      this.roleChange.emit({
        role: this.selectedRole,
        user: this.activeUser,
      });
    }
  }
}
