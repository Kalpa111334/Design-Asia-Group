import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Layout from '@/components/Layout';

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

const Chat = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
      const channel = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
          },
          () => fetchMessages(selectedUser.id)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
      fetchMessages(selectedUser.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-120px)]">
        <div className="grid md:grid-cols-3 gap-4 h-full">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {users.map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => setSelectedUser(profile)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent ${
                    selectedUser?.id === profile.id ? 'bg-accent' : ''
                  }`}
                >
                  <Avatar>
                    <AvatarFallback>{profile.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{profile.full_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>
                {selectedUser ? `Chat with ${selectedUser.full_name}` : 'Select a user to chat'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {selectedUser ? (
                <>
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mb-2" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] p-3 rounded-lg ${
                              msg.sender_id === user?.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p>{msg.message}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                    />
                    <Button type="submit" size="icon">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4" />
                    <p>Select a contact to start chatting</p>
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
