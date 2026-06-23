import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Signaling, SignalMessage } from '../../services/signaling';
import { Router } from '@angular/router';

interface ChatEntry {
  from: 'me' | 'consultant';
  text: string;
}

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './call.html',
  styleUrl: './call.scss',
})
export class Call implements OnInit {
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('screenVideo') screenVideoRef!: ElementRef<HTMLVideoElement>;

  private peerConnection!: RTCPeerConnection;
  private screenPeerConnection!: RTCPeerConnection;
  isScreenSharing = false;
  micPermissionDenied = false;
  connectionLost = false;
  callEnded = false;

  chatLog: ChatEntry[] = [];
  draft = '';
  sentFiles: string[] = [];

  constructor(
    private signaling: Signaling,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.signaling.messages$.subscribe((msg) => {
      console.log('Customer received message:', msg.type);
      this.handleMessage(msg);
    });
  }

  sendChat(): void {
    if (!this.draft.trim()) return;
    this.signaling.send('chat', { text: this.draft });
    this.chatLog.push({ from: 'me', text: this.draft });
    this.draft = '';
  }

  private async handleMessage(msg: SignalMessage): Promise<void> {
    console.log('Customer received message:', msg.type);
    if (msg.type === 'offer') {
      await this.handleOffer(msg.payload);
    } else if (msg.type === 'ice-candidate') {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
    } else if (msg.type === 'chat') {
      this.chatLog.push({ from: 'consultant', text: msg.payload.text });
    } else if (msg.type === 'screen-offer') {
      await this.handleScreenOffer(msg.payload);
    } else if (msg.type === 'screen-ice-candidate') {
      await this.screenPeerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
    } else if (msg.type === 'screen-ended') {
      this.screenPeerConnection?.close();
      this.isScreenSharing = false;
    } else if (msg.type === 'end-call') {
      this.callEnded = true;
      this.cdr.detectChanges();
      this.peerConnection?.close();
      this.screenPeerConnection?.close();
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Set ontrack FIRST before setRemoteDescription
    this.peerConnection.ontrack = (event) => {
      console.log('Track received!', event.streams);
      this.remoteVideoRef.nativeElement.srcObject = event.streams[0];
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send('ice-candidate', event.candidate.toJSON());
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        this.connectionLost = true;
      }
    };

    await this.peerConnection.setRemoteDescription(offer);

    this.peerConnection.getTransceivers().forEach((transceiver) => {
      if (transceiver.receiver.track?.kind === 'video') {
        transceiver.direction = 'recvonly';
      }
    });

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('Microphone permission denied or unavailable', err);
      this.micPermissionDenied = true;
    }

    if (micStream) {
      micStream.getAudioTracks().forEach((track) =>
        this.peerConnection.addTrack(track, micStream!));
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.signaling.send('answer', answer);
  }

  private async handleScreenOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.screenPeerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Set to true FIRST so the video element gets rendered
    this.isScreenSharing = true;
    this.cdr.detectChanges();

    this.screenPeerConnection.ontrack = (event) => {
      // Wait for DOM to render the video element
      setTimeout(() => {
        if (this.screenVideoRef?.nativeElement) {
          this.screenVideoRef.nativeElement.srcObject = event.streams[0];
        }
      }, 100);
    };

    this.screenPeerConnection.ontrack = (event) => {
      console.log('Screen track received!', event.streams);
      setTimeout(() => {
        if (this.screenVideoRef?.nativeElement) {
          this.screenVideoRef.nativeElement.srcObject = event.streams[0];
        } else {
          console.log('screenVideoRef still undefined!');
        }
      }, 100);
    };

    await this.screenPeerConnection.setRemoteDescription(offer);

    this.screenPeerConnection.getTransceivers().forEach((transceiver) => {
      transceiver.direction = 'recvonly';
    });

    const answer = await this.screenPeerConnection.createAnswer();
    await this.screenPeerConnection.setLocalDescription(answer);

    this.signaling.send('screen-answer', answer);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    console.log('Uploading file, sessionId:', this.signaling.sessionId);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', this.signaling.sessionId);

    const response = await fetch('http://localhost:8080/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    console.log('Upload response status:', response.status);

    if (!response.ok) {
      console.error('File upload failed', response.status);
      return;
    }

    this.sentFiles.push(file.name);
    input.value = '';
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}