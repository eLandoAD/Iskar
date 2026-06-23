import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConsultantSignaling } from '../../services/consultant-signaling';
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
  receivedFiles: { name: string; url: string }[] = [];

  private pc: RTCPeerConnection | null = null;
  private screenPc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private msgSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private signaling: ConsultantSignaling,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.queryParams['sessionId'] || '';

    // Don't reconnect here — dashboard already connected with customer's sessionId

    this.msgSub = this.signaling.messages$.subscribe(msg => {
      if (msg.type === 'answer') this.handleAnswer(msg.payload);
      if (msg.type === 'ice-candidate') this.handleIceCandidate(msg.payload);
      if (msg.type === 'screen-answer') this.handleScreenAnswer(msg.payload);
      if (msg.type === 'screen-ice-candidate') this.screenPc?.addIceCandidate(new RTCIceCandidate(msg.payload));
      if (msg.type === 'file-meta') {
        this.receivedFiles.push({
          name: msg.payload.name,
          url: `http://localhost:8080${msg.payload.url}`
        });
        this.cdr.detectChanges();
      }
      if (msg.type === 'chat') {
        this.messages.push({ from: 'them', text: msg.payload.text });
        this.scrollChat();
      }
      if (msg.type === 'end-call') this.leaveCall();
    });
  }

  ngAfterViewInit(): void {
    // Wait for socket to be ready before starting call
    setTimeout(() => this.startCall(), 1000);
  }

  async startCall(): Promise<void> {
    try {
      // Get camera + mic
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Show your own preview
      this.localVideoRef.nativeElement.srcObject = this.localStream;

      // Create peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Create a stream and add tracks to it
      const stream = new MediaStream([this.localStream!.getVideoTracks()[0], this.localStream!.getAudioTracks()[0]]);

      const videoTrack = stream.getVideoTracks()[0];
      this.pc.addTransceiver(videoTrack, { direction: 'sendonly', streams: [stream] });

      const audioTrack = stream.getAudioTracks()[0];
      this.pc.addTransceiver(audioTrack, { direction: 'sendrecv', streams: [stream] });

      // Trickle ICE
      this.pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.signaling.send('ice-candidate', this.sessionId, candidate.toJSON());
        }
      };

      // Track connection state
      this.pc.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        console.log('ICE state changed:', state);
        if (state === 'connected' || state === 'completed') {
          this.connectionState = 'connected';
          this.connectionLabel = 'Connected';
          this.cdr.detectChanges();
        } else if (state === 'failed' || state === 'disconnected') {
          this.connectionState = 'failed';
          this.connectionLabel = 'Connection lost';
          this.cdr.detectChanges();
        }
      };

      // Create and send offer to customer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.send('offer', this.sessionId, offer);
      console.log('Offer sent for sessionId:', this.sessionId);
      this.connectionLabel = 'Offer sent, waiting for customer...';

    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        this.connectionState = 'failed';
        this.connectionLabel = 'Camera/mic access denied';
      } else {
        this.connectionState = 'failed';
        this.connectionLabel = 'Failed to start call';
      }
      console.error('startCall error', e);
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('Answer received!', answer);
    await this.pc?.setRemoteDescription(new RTCSessionDescription(answer));
    this.connectionState = 'connected';
    this.connectionLabel = 'Connected';
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate', e);
    }
  }

  // Screen sharing
  async toggleScreenShare(): Promise<void> {
    if (this.sharingScreen) {
      this.stopScreenShare();
      return;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

      this.screenPc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      const screenStream = new MediaStream([screenTrack]);
      this.screenPc.addTransceiver(screenTrack, { direction: 'sendonly', streams: [screenStream] });

      this.screenPc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.signaling.send('screen-ice-candidate', this.sessionId, candidate.toJSON());
        }
      };

      // Stop sharing if user closes the browser's screen share dialog
      screenTrack.onended = () => this.stopScreenShare();

      const offer = await this.screenPc.createOffer();
      await this.screenPc.setLocalDescription(offer);

      this.signaling.send('screen-offer', this.sessionId, offer);
      this.sharingScreen = true;

    } catch (e) {
      console.error('Screen share error', e);
    }
  }

  async handleScreenAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.screenPc?.setRemoteDescription(new RTCSessionDescription(answer));
  }

  stopScreenShare(): void {
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.screenPc?.close();
    this.screenPc = null;
    this.screenStream = null;
    this.sharingScreen = false;
    this.signaling.send('screen-ended', this.sessionId, {});
  }

  sendMessage(): void {
    if (!this.chatInput.trim()) return;
    this.signaling.send('chat', this.sessionId, { text: this.chatInput });
    this.messages.push({ from: 'me', text: this.chatInput });
    this.chatInput = '';
    this.scrollChat();
  }

  endCall(): void {
    console.log('Sending end-call for sessionId:', this.sessionId);
    this.signaling.send('end-call', this.sessionId, {});

    setTimeout(() => {
      this.leaveCall();
    }, 300);
  }

  leaveCall(): void {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.pc?.close();
    this.screenPc?.close();
    this.pc = null;
    this.screenPc = null;
    this.localStream = null;
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