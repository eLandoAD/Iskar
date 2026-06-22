import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Signaling, SignalMessage } from '../../services/signaling';

@Component({
  selector: 'app-call',
  standalone: true,
  templateUrl: './call.html',
  styleUrl: './call.scss',
})
export class Call implements OnInit {
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

  private peerConnection!: RTCPeerConnection;
  private readonly sessionId = 'test-session-1'; // matches whatever Track C hardcodes for now

  constructor(private signaling: Signaling) {}

  ngOnInit(): void {
    this.signaling.connect(this.sessionId);
    this.signaling.messages$.subscribe((msg) => this.handleMessage(msg));
  }

  private async handleMessage(msg: SignalMessage): Promise<void> {
    if (msg.type === 'offer') {
      await this.handleOffer(msg.payload);
    } else if (msg.type === 'ice-candidate') {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
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

    await this.peerConnection.setRemoteDescription(offer);

    // This is the directionality guard from the brief — force video to
    // receive-only even though the offer should already say so.
    this.peerConnection.getTransceivers().forEach((transceiver) => {
      if (transceiver.receiver.track?.kind === 'video') {
        transceiver.direction = 'recvonly';
      }
    });

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream.getAudioTracks().forEach((track) => this.peerConnection.addTrack(track, micStream));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.signaling.send('answer', answer);
  }
}