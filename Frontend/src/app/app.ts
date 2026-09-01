import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleSelectorComponent } from './components/role-selector/role-selector.component';
import { RetailerViewComponent } from './components/retailer-view/retailer-view.component';
import { DispatcherViewComponent } from './components/dispatcher-view/dispatcher-view.component';
import { RiderViewComponent } from './components/rider-view/rider-view.component';
import { SocketService } from './services/socket.service';
import { User, UserRole } from './models/delivery.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RoleSelectorComponent,
    RetailerViewComponent,
    DispatcherViewComponent,
    RiderViewComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public currentRole: UserRole = 'retailer';
  public currentUser: User | null = null;

  constructor(private socketService: SocketService) {}

  public onRoleSelected(event: { role: UserRole; user: User }): void {
    console.log('[App] Role changed:', event);
    this.currentRole = event.role;
    this.currentUser = event.user;

    // Direct Socket.io room join
    if (this.currentUser) {
      this.socketService.joinRoom(this.currentRole, this.currentUser.id);
    }
  }
}
