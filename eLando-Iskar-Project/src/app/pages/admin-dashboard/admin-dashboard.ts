import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsultantSignaling } from '../../services/consultant-signaling';
import { Subscription } from 'rxjs';

interface CallRecord {
  id: string;
  consultant: string;
  sourcePage: string;
  startTime: string;
  duration: string;
  status: 'active' | 'completed' | 'missed';
}

interface Stats {
  callsToday: number;
  avgAnswerTime: number;
  consultantsOnline: number;
  missedCalls: number;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit, OnDestroy {
  tabs = ['Current', 'Past', 'Missed'];
  activeTab = 'Current';

  stats: Stats = {
    callsToday: 0,
    avgAnswerTime: 0,
    consultantsOnline: 0,
    missedCalls: 0,
  };

  // Mock data — will be replaced with real API data from Person A
  calls: CallRecord[] = [
    {
      id: '1',
      consultant: 'john',
      sourcePage: '/products/phone',
      startTime: '10:32:00',
      duration: '4m 12s',
      status: 'completed',
    },
    {
      id: '2',
      consultant: 'sarah',
      sourcePage: '/products/laptop',
      startTime: '11:05:00',
      duration: '—',
      status: 'missed',
    },
    {
      id: '3',
      consultant: 'john',
      sourcePage: '/tariffs',
      startTime: '11:45:00',
      duration: '1m 55s',
      status: 'active',
    },
  ];

  private msgSub?: Subscription;

  constructor(private signaling: ConsultantSignaling) {}

  ngOnInit(): void {
    this.recalcStats();

    // Listen for real data when backend is ready
    this.msgSub = this.signaling.messages$.subscribe(msg => {
      if (msg.type === 'admin-update') {
        this.calls = msg.payload.calls;
        this.stats = msg.payload.stats;
      }
    });
  }

  filteredCalls(): CallRecord[] {
    const map: Record<string, CallRecord['status']> = {
      Current: 'active',
      Past: 'completed',
      Missed: 'missed',
    };
    return this.calls.filter(c => c.status === map[this.activeTab]);
  }

  recalcStats(): void {
    this.stats.callsToday = this.calls.length;
    this.stats.missedCalls = this.calls.filter(c => c.status === 'missed').length;
    this.stats.consultantsOnline = 2; // mock
    this.stats.avgAnswerTime = 14;    // mock
  }

  exportCsv(): void {
    const headers = ['Consultant', 'Source Page', 'Start Time', 'Duration', 'Status'];
    const rows = this.calls.map(c =>
      [c.consultant, c.sourcePage, c.startTime, c.duration, c.status].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
  }
}