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

    connect(sessionId: string): void {
        // Close existing connection if any
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }

        this.consultantId = sessionId;
        this.socket = new WebSocket('ws://localhost:8080/ws/signal');

        this.socket.onopen = () => this.connected$.next(true);
        this.socket.onmessage = (event) => {
            const message: SignalMessage = JSON.parse(event.data);
            this.messages$.next(message);
        };
        this.socket.onclose = () => this.connected$.next(false);
        this.socket.onerror = (err) => console.error('Consultant signaling error', err);
    }

    send(type: string, sessionId: string, payload: any): void {
        // Reconnect if socket closed
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            const consultantId = sessionStorage.getItem('consultantId');
            if (consultantId) {
                this.connect(consultantId);
                // Retry after connection opens
                setTimeout(() => this.send(type, sessionId, payload), 500);
                return;
            }
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