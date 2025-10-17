import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, PhoneOff, Users, Copy, Send, MessageSquare } from 'lucide-react';
import { createSignalingChannel, defaultRtcConfig, SignalMessage } from '@/utils/webrtc/signaling';
import Alert from '@/utils/alert';
import { useAuth } from '@/contexts/AuthContext';

type Peer = {
  id: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
};

const Meet = () => {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState<string>('');
  const [searchParams] = useSearchParams();
  const [joined, setJoined] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const signalingRef = useRef<ReturnType<typeof createSignalingChannel> | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ from: string; text: string }>>([]);
  const [devices, setDevices] = useState<{ cams: MediaDeviceInfo[]; mics: MediaDeviceInfo[]}>({ cams: [], mics: [] });
  const [selectedCam, setSelectedCam] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMessage, setInviteMessage] = useState('Join my MIDIZ meeting.');
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    return () => {
      // cleanup
      Object.values(peers).forEach(p => p.pc.close());
      localStream?.getTracks().forEach(t => t.stop());
      signalingRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const rid = searchParams.get('roomId');
    const auto = searchParams.get('autoJoin');
    if (rid) setRoomId(rid);
    if (rid && auto === '1' && !joined) {
      joinRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function initLocalMedia() {
    const constraints: MediaStreamConstraints = {
      audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      video: selectedCam ? { deviceId: { exact: selectedCam } } : { width: 1280, height: 720 },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch(() => {});
    }
    return stream;
  }

  async function enumerateDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cams: all.filter(d => d.kind === 'videoinput'),
        mics: all.filter(d => d.kind === 'audioinput'),
      });
    } catch {}
  }

  async function joinRoom() {
    try {
      if (!roomId.trim()) {
        Alert.error('Room ID required', 'Please enter a room ID or create one.');
        return;
      }
      await enumerateDevices();
      const stream = await initLocalMedia();
      const signaling = createSignalingChannel({
        roomId,
        onMessage: onSignal,
      });
      signalingRef.current = signaling;
      await signaling.subscribe();
      await signaling.trackPresence({ userId: user?.id, email: user?.email });
      setJoined(true);
      // Announce presence with an offer to new peers
      // Presence state can be used to know who is in the room
      const state = signaling.getPresenceState();
      const others = Object.keys(state || {});
      for (const other of others) {
        if (!peers[other]) {
          await createAndSendOffer(other, stream);
        }
      }
    } catch (e: any) {
      Alert.error('Unable to join', e.message || String(e));
    }
  }

  function ensurePeer(peerId: string) {
    if (peers[peerId]) return peers[peerId];
    const pc = new RTCPeerConnection(defaultRtcConfig());
    const remoteStream = new MediaStream();
    const peer: Peer = { id: peerId, pc, stream: remoteStream };

    // Remote track handler
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
      setPeers(prev => ({ ...prev, [peerId]: peer }));
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate && signalingRef.current) {
        signalingRef.current.send({ type: 'candidate', senderId: user?.id || 'unknown', payload: { to: peerId, candidate: e.candidate } });
      }
    };

    // Data channel (chat)
    if (!dataChannelRef.current) {
      const dc = pc.createDataChannel('chat');
      wireDataChannel(dc);
      dataChannelRef.current = dc;
    } else {
      pc.ondatachannel = (e) => wireDataChannel(e.channel);
    }

    // Attach local tracks
    localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));

    setPeers(prev => ({ ...prev, [peerId]: peer }));
    return peer;
  }

  function wireDataChannel(dc: RTCDataChannel) {
    dc.onmessage = (e) => {
      setMessages(m => [...m, { from: 'Peer', text: String(e.data) }]);
    };
  }

  async function createAndSendOffer(peerId: string, stream: MediaStream) {
    const { pc } = ensurePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await signalingRef.current?.send({ type: 'offer', senderId: user?.id || 'unknown', payload: { to: peerId, sdp: offer } });
  }

  async function onSignal(msg: SignalMessage) {
    const from = msg.senderId;
    if (!from || from === user?.id) return;

    if (msg.type === 'offer') {
      const peer = ensurePeer(from);
      await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      await signalingRef.current?.send({ type: 'answer', senderId: user?.id || 'unknown', payload: { to: from, sdp: answer } });
    } else if (msg.type === 'answer') {
      const peer = ensurePeer(from);
      await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
    } else if (msg.type === 'candidate') {
      const peer = ensurePeer(from);
      if (msg.payload?.candidate) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
      }
    } else if (msg.type === 'leave') {
      const peer = peers[from];
      if (peer) {
        peer.pc.close();
        setPeers(prev => { const n = { ...prev }; delete n[from]; return n; });
      }
    }
  }

  function toggleMic() {
    localStream?.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setMicOn(prev => !prev);
  }

  function toggleCam() {
    localStream?.getVideoTracks().forEach(t => (t.enabled = !t.enabled));
    setCamOn(prev => !prev);
  }

  async function switchVideoDevice(id: string) {
    setSelectedCam(id);
    const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id } }, audio: false });
    const newTrack = newStream.getVideoTracks()[0];
    const old = localStream?.getVideoTracks()[0];
    if (old) {
      localStream?.removeTrack(old);
      old.stop();
    }
    localStream?.addTrack(newTrack);
    Object.values(peers).forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newTrack);
    });
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream!;
    }
  }

  async function switchAudioDevice(id: string) {
    setSelectedMic(id);
    const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id } }, video: false });
    const newTrack = newStream.getAudioTracks()[0];
    const old = localStream?.getAudioTracks()[0];
    if (old) {
      localStream?.removeTrack(old);
      old.stop();
    }
    localStream?.addTrack(newTrack);
    Object.values(peers).forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sender) sender.replaceTrack(newTrack);
    });
  }

  async function shareScreen() {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = displayStream.getVideoTracks()[0];
      Object.values(peers).forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      screenTrack.onended = () => {
        const original = localStream?.getVideoTracks()[0];
        if (!original) return;
        Object.values(peers).forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(original);
        });
      };
    } catch (e) {
      // ignored
    }
  }

  function leave() {
    signalingRef.current?.send({ type: 'leave', senderId: user?.id || 'unknown' });
    Object.values(peers).forEach(p => p.pc.close());
    localStream?.getTracks().forEach(t => t.stop());
    setPeers({});
    setJoined(false);
  }

  function copyInvite() {
    const link = `${window.location.origin}/meet?roomId=${encodeURIComponent(roomId)}&autoJoin=1`;
    navigator.clipboard.writeText(link);
    Alert.success('Copied', 'Invite link copied to clipboard');
  }

  function openInvite() {
    if (!roomId.trim()) {
      Alert.error('Room ID required', 'Enter a room ID first.');
      return;
    }
    const link = `${window.location.origin}/meet?roomId=${encodeURIComponent(roomId)}&autoJoin=1`;
    setInviteLink(link);
    setInviteOpen(true);
  }

  function sendEmailInvites() {
    if (!inviteEmails.trim()) {
      copyInvite();
      return;
    }
    const mailto = `mailto:${encodeURIComponent(inviteEmails)}?subject=${encodeURIComponent('MIDIZ Meeting Invite')}&body=${encodeURIComponent(`${inviteMessage}\n\nRoom: ${roomId}\nLink: ${inviteLink}`)}`;
    window.location.href = mailto;
  }

  function sendChat() {
    if (!chatInput.trim()) return;
    dataChannelRef.current?.send(chatInput);
    setMessages(m => [...m, { from: 'Me', text: chatInput }]);
    setChatInput('');
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Meet</h1>
            <p className="text-muted-foreground">MIDIZ</p>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-48" />
            {!joined ? (
              <Button onClick={joinRoom} className="btn-animated"><Users className="w-4 h-4 mr-2"/>Join</Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={copyInvite} variant="outline" className="btn-animated"><Copy className="w-4 h-4 mr-2"/>Copy Link</Button>
                <Button onClick={openInvite} className="btn-animated">Add & Invite</Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="md:col-span-3 elevated-card">
            <CardHeader>
              <CardTitle>Conference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video ref={localVideoRef} muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/30 to-transparent" />
                </div>
                {Object.values(peers).map((p) => (
                  <div key={p.id} className="relative rounded-lg overflow-hidden bg-black aspect-video">
                    <VideoTile stream={p.stream} />
                    <div className="absolute bottom-2 left-2 text-xs text-white/90 bg-black/40 px-2 py-1 rounded">{p.id.slice(0,6)}</div>
                  </div>
                ))}
              </div>

              {joined && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={toggleMic} variant={micOn ? 'default' : 'outline'} className="btn-animated">
                    {micOn ? <Mic className="w-4 h-4 mr-2"/> : <MicOff className="w-4 h-4 mr-2"/>}
                    {micOn ? 'Mute' : 'Unmute'}
                  </Button>
                  <Button onClick={toggleCam} variant={camOn ? 'default' : 'outline'} className="btn-animated">
                    {camOn ? <VideoIcon className="w-4 h-4 mr-2"/> : <VideoOff className="w-4 h-4 mr-2"/>}
                    {camOn ? 'Stop Video' : 'Start Video'}
                  </Button>
                  <Button onClick={shareScreen} variant="outline" className="btn-animated">
                    <MonitorUp className="w-4 h-4 mr-2"/> Share Screen
                  </Button>
                  {devices.cams.length > 0 && (
                    <select className="border rounded px-2 py-1 text-sm" value={selectedCam} onChange={(e) => switchVideoDevice(e.target.value)}>
                      <option value="">Default Camera</option>
                      {devices.cams.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,4)}`}</option>))}
                    </select>
                  )}
                  {devices.mics.length > 0 && (
                    <select className="border rounded px-2 py-1 text-sm" value={selectedMic} onChange={(e) => switchAudioDevice(e.target.value)}>
                      <option value="">Default Mic</option>
                      {devices.mics.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,4)}`}</option>))}
                    </select>
                  )}
                  <Button onClick={leave} variant="destructive" className="btn-animated">
                    <PhoneOff className="w-4 h-4 mr-2"/> Leave
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="elevated-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4"/>Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 overflow-auto rounded border p-3 space-y-2 bg-muted/30">
                {messages.map((m, idx) => (
                  <div key={idx} className="text-sm"><span className="font-medium">{m.from}:</span> {m.text}</div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message" />
                <Button onClick={sendChat}><Send className="w-4 h-4"/></Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Participants</DialogTitle>
              <DialogDescription>Share the link or send email invites.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Invite Link</label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={inviteLink} />
                  <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink); Alert.success('Copied', 'Invite link copied'); }}>Copy</Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Emails (comma separated)</label>
                <Input placeholder="alice@example.com, bob@example.com" value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <Input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
                <Button onClick={sendEmailInvites}>Send Email</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

const VideoTile = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} playsInline className="w-full h-full object-cover"/>;
};

export default Meet;


