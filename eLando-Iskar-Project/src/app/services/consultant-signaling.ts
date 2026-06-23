import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SignalMessage {
  type: string;
  sessionId: string;
  role: 'customer' | 'consultant';
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class ConsultantSignaling {
  private socket: WebSocket | null = null;
  private sessionId = '';
  private consultantId = '';

  readonly messages$ = new Subject<SignalMessage>();
  readonly connected$ = new Subject<boolean>();

  connect(consultantId: string): void {
    this.consultantId = consultantId;
    this.socket = new WebSocket(`ws://localhost:8080/ws/signal?consultantId=${consultantId}`);

    this.socket.onopen = () => this.connected$.next(true);

    this.socket.onmessage = (event) => {
      const message: SignalMessage = JSON.parse(event.data);
      this.messages$.next(message);
    };

    this.socket.onclose = () => this.connected$.next(false);
    this.socket.onerror = (err) => console.error('Consultant signaling error', err);
  }

  send(type: string, sessionId: string, payload: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send — socket not open');
      return;
    }
    const message: SignalMessage = {
      type,
      sessionId,
      role: 'consultant',
      payload,
    };
    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}