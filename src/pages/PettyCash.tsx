import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  petty_cash_categories: {
    name: string;
  };
  profiles: {
    full_name: string;
  };
}

interface Category {
  id: string;
  name: string;
  budget_limit: number;
}

const PettyCash = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('petty_cash_categories')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('petty_cash_transactions')
        .select(`
          id,
          amount,
          description,
          status,
          created_at,
          petty_cash_categories (name),
          profiles (full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data as any || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('petty_cash_transactions').insert([
        {
          ...formData,
          amount: parseFloat(formData.amount),
          employee_id: user?.id,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Transaction submitted for approval',
      });

      setOpen(false);
      setFormData({ amount: '', description: '', category_id: '' });
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('petty_cash_transactions')
        .update({ 
          status,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Transaction ${status}`,
      });

      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p>Loading transactions...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Petty Cash</h1>
            <p className="text-muted-foreground">Manage expense transactions</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Expense</DialogTitle>
                <DialogDescription>
                  Submit a new petty cash expense
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Submit Transaction</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions found</p>
              </CardContent>
            </Card>
          ) : (
            transactions.map((transaction) => (
              <Card key={transaction.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-2xl">${transaction.amount.toFixed(2)}</CardTitle>
                        <Badge variant="outline">
                          {transaction.petty_cash_categories?.name}
                        </Badge>
                      </div>
                      <CardDescription>{transaction.description}</CardDescription>
                      <p className="text-sm text-muted-foreground">
                        By: {transaction.profiles?.full_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(transaction.status)}
                      <Badge variant={getStatusVariant(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                {isAdmin && transaction.status === 'pending' && (
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(transaction.id, 'approved')}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUpdateStatus(transaction.id, 'rejected')}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PettyCash;
