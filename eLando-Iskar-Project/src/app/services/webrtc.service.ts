import { Injectable } from '@angular/core';
import { ConsultantSignaling } from './consultant-signaling';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

@Injectable({ providedIn: 'root' })
export class WebrtcService {
  private pc: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;

  constructor(private signaling: ConsultantSignaling) {}

  async startCall(sessionId: string): Promise<void> {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Get consultant's camera + mic
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    const videoTrack = this.localStream.getVideoTracks()[0];
    const audioTrack = this.localStream.getAudioTracks()[0];

    // VIDEO: sendonly — we send our camera, we never receive the customer's camera
    this.pc.addTransceiver(videoTrack, { direction: 'sendonly' });

    // AUDIO: sendrecv — we send our mic and receive the customer's mic
    this.pc.addTransceiver(audioTrack, { direction: 'sendrecv' });

    // Trickle ICE candidates to the customer
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.send('ice-candidate', sessionId, { candidate });
      }
    };

    // Log connection state changes
    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', this.pc?.iceConnectionState);
    };

    // Create and send the offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.signaling.send('offer', sessionId, { sdp: offer });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc?.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate', e);
    }
  }

  endCall(): void {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
  }
}