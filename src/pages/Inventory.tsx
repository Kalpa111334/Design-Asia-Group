import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Layout from '@/components/Layout';

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  unit_price: number;
  reorder_level: number;
  stock_levels: Array<{
    current_quantity: number;
    inventory_locations: {
      name: string;
    };
  }>;
}

interface Alert {
  id: string;
  alert_type: string;
  message: string;
  current_value: number;
  threshold_value: number;
  created_at: string;
  inventory_items: {
    name: string;
  };
}

const Inventory = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category: '',
    unit_price: '',
    reorder_level: '',
  });

  useEffect(() => {
    fetchItems();
    fetchAlerts();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          stock_levels (
            current_quantity,
            inventory_locations (name)
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setItems(data || []);
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

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select(`
          *,
          inventory_items (name)
        `)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('inventory_items').insert([
        {
          ...formData,
          unit_price: parseFloat(formData.unit_price),
          reorder_level: parseInt(formData.reorder_level),
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Inventory item created successfully',
      });

      setOpen(false);
      setFormData({ name: '', description: '', sku: '', category: '', unit_price: '', reorder_level: '' });
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTotalStock = (item: InventoryItem) => {
    return item.stock_levels?.reduce((sum, level) => sum + level.current_quantity, 0) || 0;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p>Loading inventory...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">Manage stock and supplies</p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                  <DialogDescription>
                    Create a new inventory item
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateItem} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unit_price">Unit Price</Label>
                      <Input
                        id="unit_price"
                        type="number"
                        step="0.01"
                        value={formData.unit_price}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorder_level">Reorder Level</Label>
                      <Input
                        id="reorder_level"
                        type="number"
                        value={formData.reorder_level}
                        onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Add Item</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="items" className="w-full">
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts {alerts.length > 0 && <Badge className="ml-2" variant="destructive">{alerts.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            {items.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No inventory items found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const totalStock = getTotalStock(item);
                  const isLowStock = totalStock <= item.reorder_level;

                  return (
                    <Card key={item.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle>{item.name}</CardTitle>
                            <CardDescription>{item.category}</CardDescription>
                          </div>
                          {isLowStock && (
                            <Badge variant="destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Low
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className="font-semibold">{totalStock}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Unit Price:</span>
                          <span className="font-semibold">${item.unit_price?.toFixed(2)}</span>
                        </div>
                        {item.sku && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">SKU:</span>
                            <span className="font-mono text-xs">{item.sku}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          {alert.inventory_items?.name}
                        </CardTitle>
                        <CardDescription>{alert.message}</CardDescription>
                      </div>
                      <Badge variant="destructive">
                        {alert.alert_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <TrendingDown className="w-4 h-4 text-destructive" />
                        <span>Current: {alert.current_value}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span>Threshold: {alert.threshold_value}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Inventory;
