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
  ) { }

  login(): void {
  if (!this.username.trim() || !this.password.trim()) {
    this.error = 'Please enter username and password';
    return;
  }

  this.loading = true;
  this.error = '';

  fetch('http://localhost:8080/api/consultants/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: this.username, password: this.password })
  })
  .then(res => {
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  })
  .then(data => {
    sessionStorage.setItem('consultantId', data.id);
    sessionStorage.setItem('consultantUsername', data.username);
    this.signaling.connect(data.id.toString());
    this.router.navigate(['/consultant/dashboard']);
  })
  .catch(() => {
    this.error = 'Invalid username or password';
    this.loading = false;
  });
}
}