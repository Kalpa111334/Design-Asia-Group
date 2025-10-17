import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare, Search, CheckCheck, Check, Circle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface UserWithUnread extends Profile {
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

const Chat = () => {
  const [users, setUsers] = useState<UserWithUnread[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithUnread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
      markMessagesAsRead(selectedUser.id);

      const channel = supabase
        .channel(`messages-${selectedUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `or(and(sender_id.eq.${user?.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user?.id}))`,
          },
          () => {
            fetchMessages(selectedUser.id);
            markMessagesAsRead(selectedUser.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUser, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id)
        .order('full_name');

      if (error) throw error;

      // Fetch unread message counts and last messages for each user
      const usersWithData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: unreadMessages } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('sender_id', profile.id)
            .eq('receiver_id', user?.id)
            .eq('is_read', false);

          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('message, created_at')
            .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user?.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...profile,
            unreadCount: unreadMessages?.length || 0,
            lastMessage: lastMessage?.message,
            lastMessageTime: lastMessage?.created_at,
          };
        })
      );

      // Sort by unread messages first, then by last message time
      usersWithData.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) {
          return b.unreadCount - a.unreadCount;
        }
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        return 0;
      });

      setUsers(usersWithData);
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const markMessagesAsRead = async (senderId: string) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user?.id)
        .eq('is_read', false);

      // Refresh user list to update unread counts
      fetchUsers();
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMessage.trim()) return;

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          sender_id: user?.id,
          receiver_id: selectedUser.id,
          message: newMessage.trim(),
        },
      ]);

      if (error) throw error;
      setNewMessage('');
      fetchUsers(); // Update last message for selected user
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnread = users.reduce((sum, u) => sum + u.unreadCount, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Chat</h1>
            <p className="text-muted-foreground">
              Real-time messaging with team members
              {totalUnread > 0 && ` • ${totalUnread} unread`}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
          {/* Contacts Sidebar */}
          <Card className="md:col-span-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>Contacts</span>
                <Badge variant="outline">{filteredUsers.length}</Badge>
              </CardTitle>
              <div className="pt-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-4 pt-0">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No contacts found</p>
                    </div>
                  ) : (
                    filteredUsers.map((profile) => (
                      <div
                        key={profile.id}
                        onClick={() => setSelectedUser(profile)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-accent ${
                          selectedUser?.id === profile.id ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="relative">
                          <Avatar className="flex-shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {profile.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {profile.unreadCount > 0 && (
                            <Circle className="absolute -top-1 -right-1 w-3 h-3 fill-destructive text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{profile.full_name}</p>
                            {profile.lastMessageTime && (
                              <span className="text-xs text-muted-foreground">
                                {formatTime(profile.lastMessageTime)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground truncate">
                              {profile.lastMessage || profile.email}
                            </p>
                            {profile.unreadCount > 0 && (
                              <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1">
                                {profile.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="md:col-span-2 flex flex-col">
            <CardHeader className="border-b">
              {selectedUser ? (
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {selectedUser.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{selectedUser.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
              ) : (
                <CardTitle>Select a user to chat</CardTitle>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              {selectedUser ? (
                <>
                  <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">No messages yet</p>
                        <p className="text-sm">Start the conversation!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg, index) => {
                          const isOwn = msg.sender_id === user?.id;
                          const showTimestamp = index === 0 || 
                            new Date(messages[index - 1].created_at).getTime() < new Date(msg.created_at).getTime() - 300000;

                          return (
                            <div key={msg.id}>
                              {showTimestamp && (
                                <div className="text-center my-4">
                                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                    {formatTime(msg.created_at)}
                                  </span>
                                </div>
                              )}
                              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex items-end gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className={`text-xs ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                      {isOwn ? user?.email?.charAt(0).toUpperCase() : selectedUser.full_name.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div
                                    className={`px-4 py-2 rounded-2xl ${
                                      isOwn
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted rounded-bl-sm'
                                    }`}
                                  >
                                    <p className="break-words">{msg.message}</p>
                                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                      <span className="text-[10px] opacity-70">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isOwn && (
                                        msg.is_read ? 
                                          <CheckCheck className="w-3 h-3 opacity-70" /> : 
                                          <Check className="w-3 h-3 opacity-70" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                      />
                      <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
                  <div className="text-center">
                    <MessageSquare className="w-20 h-20 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Welcome to Chat</p>
                    <p className="text-sm mt-2">Select a contact from the list to start messaging</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Chat;
