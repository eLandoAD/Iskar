import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Signaling, SignalMessage } from '../../services/signaling';
import { Router } from '@angular/router';

interface ChatEntry {
  from: 'me' | 'consultant';
  text: string;
}

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './call.html',
  styleUrl: './call.scss',
})
export class Call implements OnInit {
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('screenVideo') screenVideoRef!: ElementRef<HTMLVideoElement>;

  private peerConnection!: RTCPeerConnection;
  private screenPeerConnection!: RTCPeerConnection;

  // Store streams until video elements are ready
  private pendingRemoteStream: MediaStream | null = null;
  private pendingScreenStream: MediaStream | null = null;

  isScreenSharing = false;
  micPermissionDenied = false;
  connectionLost = false;
  callEnded = false;

  chatLog: ChatEntry[] = [];
  draft = '';
  sentFiles: string[] = [];

  private cdr = inject(ChangeDetectorRef);

  constructor(
    private signaling: Signaling,
    private router: Router,
  ) { }
  
  ngOnInit(): void {
    this.signaling.messages$.subscribe((msg) => {
      this.handleMessage(msg);
    });
  }

  sendChat(): void {
    if (!this.draft.trim()) return;
    this.signaling.send('chat', { text: this.draft });
    this.chatLog = [...this.chatLog, { from: 'me', text: this.draft }];
    this.draft = '';
    this.cdr.detectChanges();
  }

  private async handleMessage(msg: SignalMessage): Promise<void> {
    if (msg.type === 'offer') {
      await this.handleOffer(msg.payload);
    } else if (msg.type === 'ice-candidate') {
      await this.peerConnection?.addIceCandidate(new RTCIceCandidate(msg.payload));
    } else if (msg.type === 'chat') {
      this.chatLog = [...this.chatLog, { from: 'consultant', text: msg.payload.text }];
      this.cdr.detectChanges();
    } else if (msg.type === 'screen-offer') {
      await this.handleScreenOffer(msg.payload);
    } else if (msg.type === 'screen-ice-candidate') {
      await this.screenPeerConnection?.addIceCandidate(new RTCIceCandidate(msg.payload));
    } else if (msg.type === 'screen-ended') {
      this.screenPeerConnection?.close();
      this.isScreenSharing = false;
      this.cdr.detectChanges();
    } else if (msg.type === 'end-call') {
      this.peerConnection?.close();
      this.screenPeerConnection?.close();
      this.callEnded = true;
      this.cdr.detectChanges();
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      // Store stream and attach once DOM is ready
      this.pendingRemoteStream = stream;
      this.attachRemoteStream();
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send('ice-candidate', event.candidate.toJSON());
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection.iceConnectionState === 'failed' ||
        this.peerConnection.iceConnectionState === 'disconnected') {
        this.connectionLost = true;
        this.cdr.detectChanges();
      }
    };

    await this.peerConnection.setRemoteDescription(offer);

    this.peerConnection.getTransceivers().forEach((t) => {
      if (t.receiver.track?.kind === 'video') t.direction = 'recvonly';
    });

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.micPermissionDenied = true;
      this.cdr.detectChanges();
    }

    if (micStream) {
      micStream.getAudioTracks().forEach(t => this.peerConnection.addTrack(t, micStream!));
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.signaling.send('answer', answer);
  }

  private attachRemoteStream(): void {
    if (!this.pendingRemoteStream) return;
    if (this.remoteVideoRef?.nativeElement) {
      this.remoteVideoRef.nativeElement.srcObject = this.pendingRemoteStream;
      this.pendingRemoteStream = null;
    } else {
      // Retry until element is in DOM
      setTimeout(() => this.attachRemoteStream(), 100);
    }
  }

  private attachScreenStream(): void {
    if (!this.pendingScreenStream) return;
    if (this.screenVideoRef?.nativeElement) {
      this.screenVideoRef.nativeElement.srcObject = this.pendingScreenStream;
      this.pendingScreenStream = null;
    } else {
      setTimeout(() => this.attachScreenStream(), 100);
    }
  }

  private async handleScreenOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.screenPeerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.screenPeerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      this.pendingScreenStream = stream;
      this.isScreenSharing = true;
      this.cdr.detectChanges();
      // Attach after DOM renders the screen video element
      setTimeout(() => this.attachScreenStream(), 150);
    };

    this.screenPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send('screen-ice-candidate', event.candidate.toJSON());
      }
    };

    await this.screenPeerConnection.setRemoteDescription(offer);
    this.screenPeerConnection.getTransceivers().forEach(t => t.direction = 'recvonly');

    const answer = await this.screenPeerConnection.createAnswer();
    await this.screenPeerConnection.setLocalDescription(answer);
    this.signaling.send('screen-answer', answer);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', this.signaling.sessionId);

    const response = await fetch('http://localhost:8080/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('File upload failed', response.status);
      return;
    }

    this.sentFiles = [...this.sentFiles, file.name];
    this.cdr.detectChanges();
    input.value = '';
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}