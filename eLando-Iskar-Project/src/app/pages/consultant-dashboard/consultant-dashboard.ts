import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  private waitTimeInterval?: any;
  private pollInterval?: any;

  constructor(
    private signaling: ConsultantSignaling,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadQueue();

    // Poll for new customers every 3 seconds
    this.pollInterval = setInterval(() => {
      this.loadQueue();
    }, 3000);

    // Tick wait times every second separately
    this.waitTimeInterval = setInterval(() => {
      this.waitingCustomers = this.waitingCustomers.map(c => ({
        ...c,
        waitTime: c.waitTime + 1,
      }));
    }, 1000);

    this.msgSub = this.signaling.messages$.subscribe(msg => {
      if (msg.type === 'queue-update') {
        this.waitingCustomers = msg.payload.customers;
      }
    });
  }

  loadQueue(): void {
    fetch('http://localhost:8080/api/calls')
      .then(res => res.json())
      .then(calls => {
        const filtered = calls
          .filter((c: any) => c.status === 'WAITING' || c.status === 'ACTIVE')
          .map((c: any) => ({
            sessionId: c.sessionId,
            sourcePage: c.sourcePage?.replace('{sourcePage=', '').replace('}', '') || 'Unknown',
            waitTime: 0
          }));
        this.waitingCustomers = [...filtered];
        this.cdr.detectChanges(); // force UI update
      });

  }
  onStatusChange(newStatus: string): void {
    const consultantId = sessionStorage.getItem('consultantId');
    fetch(`http://localhost:8080/api/consultants/${consultantId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus.toUpperCase() })
    });
  }

  answerCall(customer: WaitingCustomer): void {
    // Connect WebSocket with customer's sessionId
    this.signaling.connect(customer.sessionId);

    // Wait for socket to open, then send assigned message to customer
    setTimeout(() => {
      this.signaling.send('assigned', customer.sessionId, { consultantId: sessionStorage.getItem('consultantId') });

      // Navigate to call page
      this.router.navigate(['/consultant/call'], {
        queryParams: { sessionId: customer.sessionId }
      });
    }, 500);
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
    clearInterval(this.pollInterval);
    clearInterval(this.waitTimeInterval);
  }
}