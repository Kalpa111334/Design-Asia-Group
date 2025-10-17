import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface JobForm {
  category: 'DA' | 'TB' | 'AI';
  customer_name: string;
  job_number: string;
  contact_no: string;
  sales_person: string;
  start_date: string;
  completion_date: string;
  contractor_name: string;
  note: string;
}

interface MaterialRow {
  id: string;
  item_date: string;
  description: string;
  quantity: string;
  rate: string;
}

const Jobs = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [form, setForm] = useState<JobForm>({
    category: 'DA',
    customer_name: '',
    job_number: '',
    contact_no: '',
    sales_person: '',
    start_date: '',
    completion_date: '',
    contractor_name: '',
    note: '',
  });
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { id: crypto.randomUUID(), item_date: '', description: '', quantity: '', rate: '' },
  ]);

  useEffect(() => {
    if (!isAdmin) {
      // show info toast; Jobs still visible but creation restricted
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      import('@/utils/alert').then(({ default: Alert }) => Alert.toast('Only admins can create jobs', 'info'));
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    }
  };

  const addMaterial = () => {
    setMaterials(prev => [...prev, { id: crypto.randomUUID(), item_date: '', description: '', quantity: '', rate: '' }]);
  };

  const removeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const updateMaterial = (id: string, field: keyof MaterialRow, value: string) => {
    setMaterials(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } as MaterialRow : m)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !isAdmin) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', 'You are not authorized.');
      return;
    }
    if (!form.customer_name || !form.job_number) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Validation', 'Customer name and Job number are required.');
      return;
    }

    setSaving(true);
    try {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert([
          {
            category: form.category,
            customer_name: form.customer_name,
            job_number: form.job_number,
            contact_no: form.contact_no || null,
            sales_person: form.sales_person || null,
            start_date: form.start_date || null,
            completion_date: form.completion_date || null,
            contractor_name: form.contractor_name || null,
            note: form.note || null,
            created_by: user.id,
          },
        ])
        .select('id')
        .single();

      if (jobError) throw jobError;

      const materialRows = materials
        .filter(m => m.description || m.quantity || m.rate)
        .map(m => ({
          job_id: job.id,
          item_date: m.item_date || null,
          description: m.description || null,
          quantity: m.quantity ? parseFloat(m.quantity) : 0,
          rate: m.rate ? parseFloat(m.rate) : 0,
        }));

      if (materialRows.length > 0) {
        const { error: matError } = await supabase.from('job_materials').insert(materialRows);
        if (matError) throw matError;
      }

      const { default: Alert } = await import('@/utils/alert');
      Alert.success('Job created.');
      // Reset form
      setForm({
        category: 'DA',
        customer_name: '',
        job_number: '',
        contact_no: '',
        sales_person: '',
        start_date: '',
        completion_date: '',
        contractor_name: '',
        note: '',
      });
      setMaterials([{ id: crypto.randomUUID(), item_date: '', description: '', quantity: '', rate: '' }]);
      fetchJobs();
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">Create a job and automatically generate a task.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Card</CardTitle>
            <CardDescription>Fill in details matching your paper Job Card.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Main Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as JobForm['category'] })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DA">Design Asia (DA)</SelectItem>
                      <SelectItem value="TB">Top Bass (TB)</SelectItem>
                      <SelectItem value="AI">Alusion (AI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job Number</Label>
                  <Input value={form.job_number} onChange={(e) => setForm({ ...form, job_number: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Contact No</Label>
                  <Input value={form.contact_no} onChange={(e) => setForm({ ...form, contact_no: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Sales Person</Label>
                  <Input value={form.sales_person} onChange={(e) => setForm({ ...form, sales_person: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Completion Date</Label>
                  <Input type="date" value={form.completion_date} onChange={(e) => setForm({ ...form, completion_date: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Contractor Name / Worker</Label>
                  <Input value={form.contractor_name} onChange={(e) => setForm({ ...form, contractor_name: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Note</Label>
                  <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Materials Issued</h3>
                  <Button type="button" variant="outline" onClick={addMaterial}>Add Row</Button>
                </div>
                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate</div>
                </div>
                {materials.map((m) => (
                  <div key={m.id} className="grid grid-cols-12 gap-2">
                    <Input type="date" className="col-span-2" value={m.item_date} onChange={(e) => updateMaterial(m.id, 'item_date', e.target.value)} />
                    <Input className="col-span-6" value={m.description} onChange={(e) => updateMaterial(m.id, 'description', e.target.value)} />
                    <Input type="number" step="0.01" className="col-span-2" value={m.quantity} onChange={(e) => updateMaterial(m.id, 'quantity', e.target.value)} />
                    <div className="col-span-2 flex gap-2">
                      <Input type="number" step="0.01" value={m.rate} onChange={(e) => updateMaterial(m.id, 'rate', e.target.value)} />
                      <Button type="button" variant="ghost" onClick={() => removeMaterial(m.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving...' : 'Create Job'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>Select a job when creating a task.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-muted-foreground">No jobs yet.</p>
            ) : (
              jobs.map((j) => (
                <div key={j.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{j.customer_name} — {j.job_number}</p>
                    <p className="text-xs text-muted-foreground">{j.category} {j.contractor_name ? `• ${j.contractor_name}` : ''}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/tasks?jobId=${j.id}`;
                    }}
                  >
                    Create Task
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Jobs;


