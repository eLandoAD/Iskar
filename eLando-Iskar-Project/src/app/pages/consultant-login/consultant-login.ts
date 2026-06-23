import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConsultantSignaling } from '../../services/consultant-signaling';

@Component({
  selector: 'app-consultant-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './consultant-login.html',
  styleUrl: './consultant-login.scss',
})
export class ConsultantLogin {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private router: Router,
    private signaling: ConsultantSignaling
  ) {}

  login(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Please enter username and password';
      return;
    }

    this.loading = true;
    this.error = '';

    // Store consultant ID — will be replaced with real API call once Person A is ready
    sessionStorage.setItem('consultantId', this.username);

    // Connect the WebSocket as this consultant
    this.signaling.connect(this.username);

    // Small delay to simulate login — remove when real API exists
    setTimeout(() => {
      this.loading = false;
      this.router.navigate(['/consultant/dashboard']);
    }, 500);
  }
}