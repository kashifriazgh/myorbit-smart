'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BackIcon from '@mui/icons-material/ArrowBack';
import PeopleIcon from '@mui/icons-material/People';
import CopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import PendingIcon from '@mui/icons-material/AccessTime';
import { useAuth } from '@/app/lib/context/userContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { userDb } from '@/app/lib/firebase';

interface Invitation {
  id: string;
  senderUid: string;
  senderName: string;
  senderShareId: string;
  senderUsername?: string;
  receiverUid: string;
  receiverName: string;
  receiverShareId: string;
  receiverUsername?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export default function SharingPage() {
  const { user, isGuest } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [incomingRequests, setIncomingRequests] = useState<Invitation[]>([]);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Listen for incoming pending sharing invitations in real-time
  useEffect(() => {
    if (!user || isGuest) return;

    const q = query(
      collection(userDb, 'invitations'),
      where('receiverUid', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Invitation));
      setIncomingRequests(list);
    }, (err) => {
      console.error('Error listening to incoming invitations:', err);
    });

    return () => unsub();
  }, [user, isGuest]);

  const handleCopyId = () => {
    if (!user?.shareId) return;
    navigator.clipboard.writeText(user.shareId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isGuest) return;
    
    const targetId = inviteId.trim();
    if (!targetId) return;

    if (
      targetId.toUpperCase() === user.shareId || 
      targetId.toLowerCase() === user.username
    ) {
      setErrorMsg('You cannot send a sharing invitation to yourself.');
      setSuccessMsg('');
      return;
    }

    setLoadingInvite(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Find the user by Share ID first
      let q = query(collection(userDb, 'users'), where('shareId', '==', targetId.toUpperCase()));
      let querySnap = await getDocs(q);

      // If not found, try finding by Username
      if (querySnap.empty) {
        q = query(collection(userDb, 'users'), where('username', '==', targetId.toLowerCase()));
        querySnap = await getDocs(q);
      }

      if (querySnap.empty) {
        setErrorMsg(`No active user found with Share ID or Username matching "${targetId}".`);
        setLoadingInvite(false);
        return;
      }

      const targetDoc = querySnap.docs[0];
      const targetData = targetDoc.data();
      const targetUid = targetDoc.id;

      // Check if already shared
      const alreadyShared = user.sharedWith?.some(s => s.uid === targetUid);
      if (alreadyShared) {
        setErrorMsg(`You are already sharing notifications with ${targetData.displayName || 'this user'}.`);
        setLoadingInvite(false);
        return;
      }

      // Check if an invitation is already pending
      const qInviteCheck = query(
        collection(userDb, 'invitations'),
        where('senderUid', '==', user.uid),
        where('receiverUid', '==', targetUid),
        where('status', '==', 'pending')
      );
      const inviteCheckSnap = await getDocs(qInviteCheck);
      if (!inviteCheckSnap.empty) {
        setErrorMsg('An invitation request is already pending with this user.');
        setLoadingInvite(false);
        return;
      }

      // Create the pending invitation doc
      await addDoc(collection(userDb, 'invitations'), {
        senderUid: user.uid,
        senderName: user.displayName || 'User',
        senderShareId: user.shareId || '',
        senderUsername: user.username || user.email.split('@')[0],
        receiverUid: targetUid,
        receiverName: targetData.displayName || 'User',
        receiverShareId: targetData.shareId || targetId.toUpperCase(),
        receiverUsername: targetData.username || targetData.email.split('@')[0],
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      const fullName = `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() || targetData.displayName || 'User';
      const targetUsername = targetData.username || targetData.email.split('@')[0];
      setSuccessMsg(`Invitation request successfully sent to ${fullName} (@${targetUsername})!`);
      setInviteId('');
    } catch (err) {
      console.error('Failed to send sharing request:', err);
      setErrorMsg('Failed to process sharing request. Please try again.');
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleAcceptRequest = async (invite: Invitation) => {
    if (!user || isGuest) return;

    try {
      // 1. Update invitation status to accepted
      await updateDoc(doc(userDb, 'invitations', invite.id), {
        status: 'accepted',
        acknowledgedBySender: false,
      });

      // 2. Add receiver to sender's sharedWith array
      await updateDoc(doc(userDb, 'users', invite.senderUid), {
        sharedWith: arrayUnion({
          uid: invite.receiverUid,
          displayName: invite.receiverName,
          shareId: invite.receiverShareId,
        }),
      });

      // 3. Add sender to receiver's sharedWith array
      await updateDoc(doc(userDb, 'users', invite.receiverUid), {
        sharedWith: arrayUnion({
          uid: invite.senderUid,
          displayName: invite.senderName,
          shareId: invite.senderShareId,
        }),
      });

      setSuccessMsg(`You are now successfully connected with ${invite.senderName}!`);
      setErrorMsg('');
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setErrorMsg('Failed to accept invitation. Please try again.');
    }
  };

  const handleRejectRequest = async (invite: Invitation) => {
    try {
      // Delete the pending invitation document
      await deleteDoc(doc(userDb, 'invitations', invite.id));
      setSuccessMsg('Invitation request dismissed.');
      setErrorMsg('');
    } catch (err) {
      console.error('Error rejecting invitation:', err);
      setErrorMsg('Failed to reject invitation.');
    }
  };

  const handleRemoveSharedUser = async (sharedUser: { uid: string; displayName: string; shareId: string }) => {
    if (!user || isGuest) return;

    if (!window.confirm(`Are you sure you want to stop sharing push notifications with ${sharedUser.displayName}?`)) {
      return;
    }

    try {
      // 1. Remove other user from current user's sharedWith array
      await updateDoc(doc(userDb, 'users', user.uid), {
        sharedWith: arrayRemove({
          uid: sharedUser.uid,
          displayName: sharedUser.displayName,
          shareId: sharedUser.shareId,
        }),
      });

      // 2. Remove current user from other user's sharedWith array
      await updateDoc(doc(userDb, 'users', sharedUser.uid), {
        sharedWith: arrayRemove({
          uid: user.uid,
          displayName: user.displayName,
          shareId: user.shareId || '',
        }),
      });

      // 3. Delete any historical accepted invitations between them to keep it clean
      const q1 = query(
        collection(userDb, 'invitations'),
        where('senderUid', '==', user.uid),
        where('receiverUid', '==', sharedUser.uid)
      );
      const q2 = query(
        collection(userDb, 'invitations'),
        where('senderUid', '==', sharedUser.uid),
        where('receiverUid', '==', user.uid)
      );
      
      const snaps = await Promise.all([getDocs(q1), getDocs(q2)]);
      snaps.forEach(snap => {
        snap.forEach(docSnap => {
          deleteDoc(doc(userDb, 'invitations', docSnap.id)).catch(() => {});
        });
      });

      setSuccessMsg(`Stopped sharing notifications with ${sharedUser.displayName}.`);
      setErrorMsg('');
    } catch (err) {
      console.error('Error removing shared user:', err);
      setErrorMsg('Failed to delete sharing connection.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-sky-500 selection:text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[30%] w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[130px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-violet-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 lg:px-12 py-8">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors mb-6 group"
          >
            <BackIcon className="text-[16px] group-hover:-translate-x-0.5 transition-transform" />
            Back to Settings
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20">
              <PeopleIcon className="text-sky-400 text-[26px]" />
            </div>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-sky-200 to-indigo-300 bg-clip-text text-transparent tracking-tight">
                Device Sharing
              </h1>
              <p className="text-slate-400 text-sm mt-0.5 font-medium">
                Connect with other users to exchange task & schedule alerts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-2xl mx-auto px-6 lg:px-12 mt-10 space-y-6">
        
        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold leading-relaxed">
            ✓ {successMsg}
          </div>
        )}

        {/* Your Share ID Card */}
        <div className="p-6 rounded-[24px] border border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <h2 className="text-sm font-extrabold text-white mb-1.5">Your Sharing Identity</h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
            Share either your Username or unique Share ID code with others so they can invite you.
          </p>
          <div className="space-y-4">
            {user?.username && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Username</p>
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-sky-400">
                  @{user.username}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Share ID</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 font-mono text-sm font-bold text-indigo-300 tracking-wider">
                  {user?.shareId || 'Generating...'}
                </div>
                <button
                  onClick={handleCopyId}
                  className="flex items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex-shrink-0"
                  title="Copy Share ID"
                >
                  {copied ? (
                    <CheckIcon className="text-emerald-400 text-[18px]" />
                  ) : (
                    <CopyIcon className="text-slate-300 text-[18px]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Invite User Card */}
        <div className="p-6 rounded-[24px] border border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <h2 className="text-sm font-extrabold text-white mb-1.5">Add Shared Device Link</h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
            Enter another user&apos;s Share ID or unique Username to send them a sync invitation.
          </p>
          <form onSubmit={handleSendRequest} className="flex gap-2">
            <input
              type="text"
              required
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              placeholder="e.g. U-ABCD1234 or john_doe"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold tracking-wider placeholder:text-slate-650 focus:outline-none focus:border-sky-500/50"
            />
            <button
              type="submit"
              disabled={loadingInvite || !inviteId.trim()}
              className="flex items-center gap-2 bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loadingInvite ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <SendIcon className="text-[14px]" />
              )}
              Invite
            </button>
          </form>
        </div>

        {/* Incoming Pending Invites */}
        {incomingRequests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 ml-1">
              Pending Sharing Requests ({incomingRequests.length})
            </h3>
            <div className="space-y-2">
              {incomingRequests.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-500/20 bg-amber-950/5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <PendingIcon className="text-amber-400 text-[18px]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-100">
                        {invite.senderName}
                      </p>
                      {invite.senderUsername && (
                        <p className="text-[10px] text-sky-400 font-semibold mb-0.5">
                          @{invite.senderUsername}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-500 font-semibold tracking-wider font-mono">
                        ID: {invite.senderShareId}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(invite)}
                      className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckIcon className="text-[14px]" /> Accept
                    </button>
                    <button
                      onClick={() => handleRejectRequest(invite)}
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CloseIcon className="text-[14px]" /> Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Currently Shared Users List */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
            Connected Shared Users
          </h3>
          {isGuest || !user?.sharedWith || user.sharedWith.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-slate-800/80 rounded-[28px] bg-slate-900/10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-600 mb-3">
                <PeopleIcon className="text-[22px]" />
              </div>
              <p className="text-xs text-slate-400 font-semibold max-w-xs leading-relaxed">
                No shared devices yet. Exchange Share IDs with other users to link your notifications.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {user.sharedWith.map((sharedUser) => (
                <div
                  key={sharedUser.uid}
                  className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800/80 hover:border-slate-800 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 text-xs font-bold">
                      {sharedUser.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                        {sharedUser.displayName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wider font-mono">
                        {sharedUser.shareId}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSharedUser(sharedUser)}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-600 hover:text-rose-400 transition-all"
                    title="Remove Sharing"
                  >
                    <DeleteIcon className="text-[16px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
