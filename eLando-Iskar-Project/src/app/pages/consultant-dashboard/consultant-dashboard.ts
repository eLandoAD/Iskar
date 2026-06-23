import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConsultantSignaling } from '../../services/consultant-signaling';
import { Subscription } from 'rxjs';

interface WaitingCustomer {
  sessionId: string;
  sourcePage: string;
  waitTime: number;
}

@Component({
  selector: 'app-consultant-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './consultant-dashboard.html',
  styleUrl: './consultant-dashboard.scss',
})
export class ConsultantDashboard implements OnInit, OnDestroy {
  status = 'online';
  waitingCustomers: WaitingCustomer[] = [];

  private msgSub?: Subscription;
  private timerInterval?: any;

  constructor(
    private signaling: ConsultantSignaling,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Listen for incoming messages from the backend
    this.msgSub = this.signaling.messages$.subscribe(msg => {
      if (msg.type === 'queue-update') {
        this.waitingCustomers = msg.payload.customers;
      }
    });

    // Tick wait times every second
    this.timerInterval = setInterval(() => {
      this.waitingCustomers = this.waitingCustomers.map(c => ({
        ...c,
        waitTime: c.waitTime + 1,
      }));
    }, 1000);
  }

  onStatusChange(newStatus: string): void {
    this.signaling.send('status-update', '', { status: newStatus });
  }

  answerCall(customer: WaitingCustomer): void {
    this.signaling.send('answer-customer', customer.sessionId, {});
    // Navigate to the call page, passing the sessionId
    this.router.navigate(['/consultant/call'], {
      queryParams: { sessionId: customer.sessionId }
    });
  }

  declineCall(customer: WaitingCustomer): void {
    this.signaling.send('decline-customer', customer.sessionId, {});
    // Remove from local list
    this.waitingCustomers = this.waitingCustomers.filter(
      c => c.sessionId !== customer.sessionId
    );
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
    clearInterval(this.timerInterval);
  }
}