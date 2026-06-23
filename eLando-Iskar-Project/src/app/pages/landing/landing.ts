import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Signaling } from '../../services/signaling';
import { take } from 'rxjs';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  showConsent = false;
  agreed = false;
  private sourcePage = '';

  constructor(private signaling: Signaling, private router: Router) {}

  openConsent(sourcePage: string): void {
    this.sourcePage = sourcePage;
    this.showConsent = true;
  }

  cancelConsent(): void {
    this.showConsent = false;
    this.agreed = false;
  }

  confirmConsent(): void {
    if (!this.agreed) return;

    const sessionId = crypto.randomUUID();
    this.signaling.connect(sessionId);

    this.signaling.connected$.pipe(take(1)).subscribe(() => {
      this.signaling.send('queue-join', { sourcePage: this.sourcePage });
      this.router.navigate(['/waiting-room']);
    });
  }
}