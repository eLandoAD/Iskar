import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { WaitingRoom } from './pages/waiting-room/waiting-room';
import { Call } from './pages/call/call';
import { ContactFallback } from './pages/contact-fallback/contact-fallback';
import { ConsultantLogin } from './pages/consultant-login/consultant-login';
import { ConsultantDashboard } from './pages/consultant-dashboard/consultant-dashboard';
import { ConsultantCall } from './pages/consultant-call/consultant-call';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'waiting-room', component: WaitingRoom },
  { path: 'call', component: Call },
  { path: 'contact', component: ContactFallback },
  { path: 'consultant/login', component: ConsultantLogin },
  { path: 'consultant/dashboard', component: ConsultantDashboard },
  { path: 'consultant/call', component: ConsultantCall },
  { path: '**', redirectTo: '' },
];