import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConsultantSignaling } from '../../services/consultant-signaling';
import { WebrtcService } from '../../services/webrtc.service';
import { Subscription } from 'rxjs';

interface ChatMessage {
  from: 'me' | 'them';
  text: string;
}

@Component({
  selector: 'app-consultant-call',
  imports: [CommonModule, FormsModule],
  templateUrl: './consultant-call.html',
  styleUrl: './consultant-call.scss',
})
export class ConsultantCall implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('chatMessages') chatMessagesRef!: ElementRef<HTMLDivElement>;

  sessionId = '';
  connectionState = 'checking';
  connectionLabel = 'Connecting...';
  sharingScreen = false;
  chatInput = '';
  messages: ChatMessage[] = [];

  private msgSub?: Subscription;
  private localStream: MediaStream | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private signaling: ConsultantSignaling,
    private webrtc: WebrtcService
  ) { }

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.queryParams['sessionId'] || '';

    this.msgSub = this.signaling.messages$.subscribe(msg => {
      if (msg.type === 'answer') {
        this.webrtc.handleAnswer(msg.payload.sdp);
      }
      if (msg.type === 'ice-candidate') {
        this.webrtc.handleIceCandidate(msg.payload.candidate);
      }
      if (msg.type === 'chat') {
        this.messages.push({ from: 'them', text: msg.payload.text });
        this.scrollChat();
      }
      if (msg.type === 'call-ended') {
        this.leaveCall();
      }
    });
  }

  ngAfterViewInit(): void {
    this.startCamera();
  }

  async startCamera(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      this.localStream = stream;  // ← save it
      this.localVideoRef.nativeElement.srcObject = stream;
      this.connectionState = 'connected';
      this.connectionLabel = 'Camera ready';
    } catch (e) {
      this.connectionState = 'failed';
      this.connectionLabel = 'Camera access denied';
      console.error('Camera error', e);
    }
  }

  sendMessage(): void {
    if (!this.chatInput.trim()) return;
    this.signaling.send('chat', this.sessionId, { text: this.chatInput });
    this.messages.push({ from: 'me', text: this.chatInput });
    this.chatInput = '';
    this.scrollChat();
  }

  async toggleScreenShare(): Promise<void> {
    if (this.sharingScreen) {
      this.sharingScreen = false;
      // Stop logic will go here when wiring WebRTC
    } else {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        this.sharingScreen = true;
      } catch (e) {
        console.error('Screen share denied', e);
      }
    }
  }

  endCall(): void {
    this.signaling.send('end-call', this.sessionId, {});
    this.leaveCall();
  }

  leaveCall(): void {
  this.localStream?.getTracks().forEach(track => track.stop());  // ← stops camera
  this.localStream = null;
  this.webrtc.endCall();
  this.router.navigate(['/consultant/dashboard']);
}

  scrollChat(): void {
    setTimeout(() => {
      const el = this.chatMessagesRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
  }
}