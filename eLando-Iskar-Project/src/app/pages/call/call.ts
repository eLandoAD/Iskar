import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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

  constructor(private signaling: Signaling, private router: Router) { }

  ngOnInit(): void {
    this.signaling.messages$.subscribe((msg) => this.handleMessage(msg));
  }

  sendChat(): void {
    if (!this.draft.trim()) return;
    this.signaling.send('chat', { text: this.draft });
    this.chatLog.push({ from: 'me', text: this.draft });
    this.draft = '';
  }

  private async handleMessage(msg: SignalMessage): Promise<void> {
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
      this.peerConnection?.close();
      this.screenPeerConnection?.close();
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.peerConnection.ontrack = (event) => {
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
      micStream.getAudioTracks().forEach((track) => this.peerConnection.addTrack(track, micStream!));
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.signaling.send('answer', answer);
  }

  private async handleScreenOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.screenPeerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.screenPeerConnection.ontrack = (event) => {
      this.screenVideoRef.nativeElement.srcObject = event.streams[0];
      this.isScreenSharing = true;
    };

    this.screenPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send('screen-ice-candidate', event.candidate.toJSON());
      }
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

    this.sentFiles.push(file.name);
    input.value = ''; // reset so the same file can be picked again if needed
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}