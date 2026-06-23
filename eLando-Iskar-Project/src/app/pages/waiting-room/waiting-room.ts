import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Signaling } from '../../services/signaling';

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  templateUrl: './waiting-room.html',
  styleUrl: './waiting-room.scss',
})
export class WaitingRoom implements OnInit, OnDestroy {
  private timeoutHandle?: ReturnType<typeof setTimeout>;
  private readonly TIMEOUT_MS = 30000;

  constructor(private signaling: Signaling, private router: Router) { }

  ngOnInit(): void {
    this.signaling.messages$.subscribe((msg) => {
      if (msg.type === 'assigned') {
        this.clearTimeout();
        this.router.navigate(['/call']);
      } else if (msg.type === 'no-consultant-available') {
        this.clearTimeout();
        this.router.navigate(['/contact']);
      }
    });

    this.timeoutHandle = setTimeout(() => {
      this.router.navigate(['/contact']);
    }, this.TIMEOUT_MS);
  }

  ngOnDestroy(): void {
    this.clearTimeout();
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
  }
}