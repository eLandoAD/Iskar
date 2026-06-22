import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { WaitingRoom } from './pages/waiting-room/waiting-room';
import { Call } from './pages/call/call';
import { ContactFallback } from './pages/contact-fallback/contact-fallback';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'waiting-room', component: WaitingRoom },
  { path: 'call', component: Call },
  { path: 'contact', component: ContactFallback },
  { path: '**', redirectTo: '' },
];