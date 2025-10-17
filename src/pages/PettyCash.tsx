import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, CheckCircle, XCircle, Clock, Upload, Settings, TrendingUp, FileText } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ApprovalWorkflow from '@/components/ApprovalWorkflow';
import BudgetTracker from '@/components/BudgetTracker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  receipt_url: string | null;
  petty_cash_categories: {
    name: string;
    budget_limit: number;
  };
  profiles: {
    full_name: string;
  };
}

interface Category {
  id: string;
  name: string;
  description: string;
  budget_limit: number;
  is_active: boolean;
}

interface CategorySpending {
  category: string;
  spent: number;
  limit: number;
}

const PettyCash = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showBudgetTracker, setShowBudgetTracker] = useState(false);
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    receipt_url: '',
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    budget_limit: '',
  });

  useEffect(() => {
    // Wait for auth to resolve before running queries that may filter by user ID
    if (authLoading) return;
    fetchCategories();
    // Only fetch transactions when we have a user (for non-admin) or when admin
    if (isAdmin || user?.id) {
      fetchTransactions();
    }
  }, [authLoading, isAdmin, user?.id]);

  useEffect(() => {
    if (categories.length > 0 && transactions.length > 0) {
      calculateCategorySpending();
    }
  }, [categories, transactions]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('petty_cash_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message);
    }
  };

  const fetchTransactions = async () => {
    try {
      // Get transactions without relationships first
      let query = supabase
        .from('petty_cash_transactions')
        .select(`
          id,
          amount,
          description,
          status,
          created_at,
          receipt_url,
          employee_id,
          category_id
        `)
        .order('created_at', { ascending: false });

      // Apply employee filter only when user ID is available
      if (!isAdmin) {
        if (!user?.id) {
          // No user yet; avoid running a broken query
          setTransactions([]);
          return;
        }
        query = query.eq('employee_id', user.id);
      }

      const { data: transactionsData, error: transactionsError } = await query;

      if (transactionsError) throw transactionsError;

      // Get categories
      const categoryIds = [...new Set(transactionsData?.map(t => t.category_id).filter(Boolean) || [])];
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('petty_cash_categories')
        .select('id, name, budget_limit')
        .in('id', categoryIds);

      if (categoriesError) throw categoriesError;

      // Get profiles
      const employeeIds = [...new Set(transactionsData?.map(t => t.employee_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', employeeIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const transactionsWithRelations = transactionsData?.map(transaction => ({
        ...transaction,
        petty_cash_categories: categoriesData?.find(c => c.id === transaction.category_id),
        profiles: profilesData?.find(p => p.id === transaction.employee_id)
      })) || [];

      setTransactions(transactionsWithRelations);
    } catch (error: any) {
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateCategorySpending = () => {
    const spendingMap = new Map<string, { spent: number; limit: number }>();

    categories.forEach(cat => {
      spendingMap.set(cat.name, { spent: 0, limit: cat.budget_limit });
    });

    transactions
      .filter(t => t.status === 'approved')
      .forEach(t => {
        const catName = t.petty_cash_categories?.name;
        if (catName && spendingMap.has(catName)) {
          const current = spendingMap.get(catName)!;
          current.spent += parseFloat(t.amount.toString());
        }
      });

    const spendingArray: CategorySpending[] = [];
    spendingMap.forEach((value, key) => {
      spendingArray.push({
        category: key,
        spent: value.spent,
        limit: value.limit,
      });
    });

    setCategorySpending(spendingArray);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user?.id) {
        const { default: AlertSvc } = await import('@/utils/alert');
        AlertSvc.error('Error', 'You must be signed in to create a transaction.');
        return;
      }
      const { error } = await supabase.from('petty_cash_transactions').insert([
        {
          ...formData,
          amount: parseFloat(formData.amount),
          employee_id: user.id,
        },
      ]);

      if (error) throw error;

      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.success('Transaction submitted for approval');

      setTransactionOpen(false);
      setFormData({ amount: '', description: '', category_id: '', receipt_url: '' });
      fetchTransactions();
    } catch (error: any) {
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('petty_cash_categories').insert([
        {
          ...categoryFormData,
          budget_limit: parseFloat(categoryFormData.budget_limit),
        },
      ]);

      if (error) throw error;

      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.success('Category created successfully');

      setCategoryOpen(false);
      setCategoryFormData({ name: '', description: '', budget_limit: '' });
      fetchCategories();
    } catch (error: any) {
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const confirmed = await Alert.confirm(
        `${status === 'approved' ? 'Approve' : 'Reject'} transaction?`,
        status === 'approved' ? 'This will mark the transaction as approved.' : 'This will mark the transaction as rejected.'
      );
      if (!confirmed) return;
      if (!user?.id) {
        toast({
          title: 'Error',
          description: 'You must be signed in to update status.',
          variant: 'destructive',
        });
        return;
      }
      const { error } = await supabase
        .from('petty_cash_transactions')
        .update({ 
          status,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.toast(`Transaction ${status}`);

      fetchTransactions();
    } catch (error: any) {
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message);
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

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const totalApproved = transactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalPending = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="text-center space-y-4 max-w-sm mx-auto">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-primary/20 rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Loading transactions...</p>
              <p className="text-sm text-muted-foreground/70">Preparing petty cash data</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Petty Cash</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage expense transactions and budgets</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              onClick={() => setShowBudgetTracker(!showBudgetTracker)}
              className="w-full sm:w-auto"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Budget Tracker
            </Button>
            <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  New Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-full max-w-md">
                <DialogHeader>
                  <DialogTitle>Submit Expense</DialogTitle>
                  <DialogDescription>Submit a new petty cash expense</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTransaction} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount *</Label>
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
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name} (Budget: LKR {cat.budget_limit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receipt">Receipt (Optional)</Label>
                    <FileUpload
                      onUploadComplete={(fileUrl, fileName) => {
                        setFormData({ ...formData, receipt_url: fileUrl });
                      }}
                      accept="image/*,.pdf"
                      maxSize={5}
                      className="w-full"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Submit Transaction
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            {isAdmin && (
              <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Settings className="w-4 h-4 mr-2" />
                    New Category
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:w-full max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Category</DialogTitle>
                    <DialogDescription>Create a new petty cash category</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateCategory} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cat-name">Name *</Label>
                      <Input
                        id="cat-name"
                        value={categoryFormData.name}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat-description">Description</Label>
                      <Textarea
                        id="cat-description"
                        value={categoryFormData.description}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget Limit *</Label>
                      <Input
                        id="budget"
                        type="number"
                        step="0.01"
                        value={categoryFormData.budget_limit}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, budget_limit: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Create Category
                    </Button>
              </form>
            </DialogContent>
          </Dialog>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-success">LKR {totalApproved.toFixed(2)}</div>
                <CheckCircle className="w-8 h-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-warning">LKR {totalPending.toFixed(2)}</div>
                <Clock className="w-8 h-8 text-warning opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {transactions.filter(t => t.status === 'pending').length} transactions
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{categories.length}</div>
                <TrendingUp className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Tracking */}
        {categorySpending.length > 0 && (
            <Card>
            <CardHeader>
              <CardTitle>Budget Tracking by Category</CardTitle>
              <CardDescription>Current spending vs budget limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categorySpending.map((item) => {
                const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
                const isOverBudget = percentage > 100;
                const isNearLimit = percentage > 80 && percentage <= 100;

                return (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.category}</span>
                      <div className="text-right">
                        <span className={`font-semibold ${isOverBudget ? 'text-destructive' : isNearLimit ? 'text-warning' : ''}`}>
                          LKR {item.spent.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground"> / LKR {item.limit.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={`h-2 ${isOverBudget ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : ''}`}
                      />
                      {isOverBudget && (
                        <Badge variant="destructive" className="absolute -top-1 right-0 text-xs">
                          Over Budget
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {percentage.toFixed(1)}% of budget used
                    </p>
                  </div>
                );
              })}
              </CardContent>
            </Card>
        )}

        {/* Transactions List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <TabsContent key={status} value={status} className="space-y-4">
              {transactions
                .filter(t => status === 'all' || t.status === status)
                .map((transaction) => (
              <Card key={transaction.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-2xl">LKR {transaction.amount.toFixed(2)}</CardTitle>
                            <Badge variant="outline">{transaction.petty_cash_categories?.name}</Badge>
                      </div>
                      <CardDescription>{transaction.description}</CardDescription>
                      <p className="text-sm text-muted-foreground">
                        By: {transaction.profiles?.full_name}
                      </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(transaction.status)}
                          <Badge variant={getStatusVariant(transaction.status)}>{transaction.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                {isAdmin && transaction.status === 'pending' && (
                  <CardContent>
                    <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdateStatus(transaction.id, 'approved')}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(transaction.id, 'rejected')}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
                ))}
              {transactions.filter(t => status === 'all' || t.status === status).length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No {status !== 'all' ? status : ''} transactions found</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Budget Tracker */}
        {showBudgetTracker && (
          <div className="mt-6">
            <BudgetTracker employeeId={isAdmin ? undefined : user?.id} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PettyCash;
