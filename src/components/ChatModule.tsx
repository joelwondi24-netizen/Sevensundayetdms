import React, { useEffect, useState } from 'react';
import { Hash, Paperclip, Plus, Send, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { ChatChannel, ChatMessage, UserAccount } from '../types';
import type { WsEventPayload } from '../hooks/useRealtimeWS';

interface ChatModuleProps {
  currentUser: UserAccount;
  wsConnected: boolean;
  onlineUsers: number;
  lastWsEvent: WsEventPayload | null;
  onRefreshDashboard: () => void;
}

export const ChatModule: React.FC<ChatModuleProps> = ({
  currentUser,
  wsConnected,
  onlineUsers,
  lastWsEvent,
  onRefreshDashboard,
}) => {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDept, setNewChannelDept] = useState('Operations');
  const [messageText, setMessageText] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadChannels = async () => {
    try {
      const data = await api.get<ChatChannel[]>('/api/chat/channels');
      setChannels(data);
      if (data.length > 0 && !activeChannel) {
        setActiveChannel(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat channels');
    }
  };

  const loadMessages = async (channelId: number) => {
    try {
      const data = await api.get<ChatMessage[]>(`/api/chat/channels/${channelId}/messages`);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel messages');
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
    }
  }, [activeChannel?.id]);

  // Real-time WebSocket event reconciliation (idempotent)
  useEffect(() => {
    if (!lastWsEvent) return;
    if (lastWsEvent.event === 'chat:message') {
      const msg = lastWsEvent.payload as ChatMessage;
      if (activeChannel && msg.channel_id === activeChannel.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      setChannels((prev) =>
        prev.map((c) =>
          c.id === msg.channel_id ? { ...c, message_count: (c.message_count || 0) + 1 } : c
        )
      );
    } else if (lastWsEvent.event === 'chat:deleted') {
      const { id } = lastWsEvent.payload as { id: number };
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } else if (lastWsEvent.event === 'chat:channel_created') {
      const ch = lastWsEvent.payload as ChatChannel;
      setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [...prev, ch]));
    } else if (lastWsEvent.event === 'chat:channel_deleted') {
      const { id } = lastWsEvent.payload as { id: number };
      setChannels((prev) => prev.filter((c) => c.id !== id));
    }
  }, [lastWsEvent, activeChannel?.id]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setError(null);
    try {
      const created = await api.post<ChatChannel>('/api/chat/channels', {
        name: newChannelName,
        department: newChannelDept,
        description: `${newChannelDept} corporate channel`,
      });
      setChannels((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      setActiveChannel(created);
      setNewChannelName('');
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create channel');
    }
  };

  const handleDeleteChannel = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/chat/channels/${id}`);
      const next = channels.filter((c) => c.id !== id);
      setChannels(next);
      if (activeChannel?.id === id) {
        setActiveChannel(next[0] || null);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete channel');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !messageText.trim()) return;
    setError(null);
    try {
      const created = await api.post<ChatMessage>(`/api/chat/channels/${activeChannel.id}/messages`, {
        sender_name: currentUser.full_name,
        sender_role: currentUser.role,
        content: messageText,
        attachment_name: attachmentName || null,
      });
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
      setMessageText('');
      setAttachmentName('');
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    }
  };

  const handleDeleteMessage = async (id: number) => {
    try {
      await api.del(`/api/chat/messages/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete message');
    }
  };

  const visibleMessages = messages.filter(
    (m) =>
      !searchQuery.trim() ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
      <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-[#18243A] text-white">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <img
            src="/assets/aistudio/Seven_Sunday_app_icon_e967a609.png"
            alt="Seven Sunday Chat"
            className="w-9 h-9 rounded-lg border border-[#087CEB]/35 object-contain bg-[#FFFFFF] p-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-white truncate">Internal Corporate Chat</h2>
            <p className="text-xs text-[#38BDF8] truncate">
              {channels.length} Channels · {wsConnected ? `Live WS (${onlineUsers} active)` : 'Reconnecting'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {channels.map((ch) => {
            const isSelected = activeChannel?.id === ch.id;
            return (
              <div
                key={ch.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-[#087CEB] text-white'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveChannel(ch)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <Hash className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#38BDF8]'}`} />
                  <span className="text-xs font-semibold truncate">{ch.name}</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[11px] font-mono tabular-nums ${isSelected ? 'text-white/90 font-bold' : 'text-white/60'}`}>
                    {ch.message_count ?? 0}
                  </span>
                  {ch.is_default === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteChannel(ch.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-300"
                      title="Delete channel"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleCreateChannel} className="p-3 border-t border-white/10 bg-[#121C2E] space-y-2">
          <div className="text-xs font-semibold text-[#38BDF8]">Add Corporate Channel</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="channel-name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white/10 text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          <input
            type="text"
            placeholder="Department"
            value={newChannelDept}
            onChange={(e) => setNewChannelDept(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-white/10 text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:border-[#087CEB]"
          />
        </form>
      </div>

      <div className="lg:col-span-8 flex flex-col bg-[#FFFFFF] dark:bg-slate-900">
        {activeChannel ? (
          <>
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/aistudio/Seven_Sunday_app_icon_e967a609.png"
                  alt="Seven Sunday"
                  className="w-7 h-7 rounded-md border border-[#087CEB]/35 object-contain bg-[#FFFFFF] p-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#172033] dark:text-white truncate">#{activeChannel.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {activeChannel.department} · {activeChannel.description}
                  </div>
                </div>
              </div>
              <input
                type="search"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-44 focus:outline-none focus:border-[#087CEB]"
              />
            </div>

            {error && (
              <div className="mx-5 mt-3 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {visibleMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No messages in #{activeChannel.name} yet.
                </div>
              ) : (
                visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src="/assets/aistudio/Seven_Sunday_app_icon_e967a609.png"
                        alt="Seven Sunday"
                        className="w-8 h-8 rounded-lg border border-slate-200 object-contain bg-[#FFFFFF] p-1 shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-bold text-[#172033] dark:text-white">{msg.sender_name}</span>
                          <span className="text-xs text-slate-500">{msg.sender_role}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-[#172033] dark:text-slate-200 mt-1 whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        {msg.attachment_name && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#087CEB] font-semibold font-mono">
                            <Paperclip className="w-3 h-3" />
                            <span>Attached: {msg.attachment_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 shrink-0"
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 space-y-2">
              {attachmentName && (
                <div className="flex items-center justify-between text-xs text-[#18243A] dark:text-[#38BDF8] px-2 font-semibold">
                  <span>Attachment: {attachmentName}</span>
                  <button type="button" onClick={() => setAttachmentName('')} className="text-red-600">
                    Remove
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="inline-flex items-center justify-center px-3 py-2 bg-[#FFFFFF] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:border-[#087CEB]" title="Attach file reference">
                  <Paperclip className="w-4 h-4 text-[#172033] dark:text-slate-300" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAttachmentName(f.name);
                      e.target.value = '';
                    }}
                  />
                </label>
                <input
                  type="text"
                  placeholder={`Message #${activeChannel.name} as ${currentUser.full_name}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-sm bg-[#FFFFFF] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500">Select a channel to view messages.</div>
        )}
      </div>
    </div>
  );
};
