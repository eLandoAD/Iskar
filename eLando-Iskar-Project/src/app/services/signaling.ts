import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SignalMessage {
  type: string;
  sessionId: string;
  role: 'customer' | 'consultant';
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class Signaling {
  private socket: WebSocket | null = null;
  public sessionId = '';
  private readonly role = 'customer';

  readonly messages$ = new Subject<SignalMessage>();
  readonly connected$ = new Subject<boolean>();

  connect(sessionId: string): void {
    this.sessionId = sessionId;
    this.socket = new WebSocket('ws://localhost:8080/ws/signal');

    this.socket.onopen = () => this.connected$.next(true);

    this.socket.onmessage = (event) => {
      const message: SignalMessage = JSON.parse(event.data);
      this.messages$.next(message);
    };

    this.socket.onclose = () => this.connected$.next(false);

    this.socket.onerror = (err) => console.error('Signaling socket error', err);
  }

  send(type: string, payload: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send — socket not open');
      return;
    }
    const message: SignalMessage = {
      type,
      sessionId: this.sessionId,
      role: this.role,
      payload,
    };
    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}