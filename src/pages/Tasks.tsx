import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTimer } from '@/contexts/TimerContext';
import { TaskTimer } from '@/components/TaskTimer';
import { Plus, CheckCircle, Clock, AlertCircle, CheckSquare, Users, Filter, Eye, Edit, Trash2, MapPin, FileCheck, File, X, Camera } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import NoAccess from '@/components/NoAccess';
import CameraCapture from '@/components/CameraCapture';
import { downloadTasksInvoiceSvg } from '@/utils/svgInvoice';

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  created_at: string;
  location_required: boolean;
  requires_proof: boolean;
  proof_url: string | null;
  proof_photo_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  estimated_hours?: number | null;
  spent_seconds?: number | null;
  task_identification_code?: string | null;
  task_assignees?: Array<{
    profiles: Profile;
  }>;
  task_attachments?: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
    uploaded_by: string;
    created_at: string;
  }>;
  profiles?: Profile;
}

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const { user, isAdmin } = useAuth();
  const { hasAccess, canEdit, checkAccessAndNavigate } = usePermissions();
  const { toast } = useToast();
  const { isTimerRunning, isTimerPaused, getFormattedTime } = useTimer();

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date: string;
    location_required: boolean;
    requires_proof: boolean;
    assignee_ids: string[];
    job_id?: string | null;
    task_identification_code: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    location_required: false,
    requires_proof: false,
    assignee_ids: [],
    job_id: null,
    task_identification_code: '',
  });

  const [attachedFiles, setAttachedFiles] = useState<Array<{
    fileUrl: string;
    fileName: string;
    fileType: string;
  }>>([]);

  const [showCamera, setShowCamera] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!checkAccessAndNavigate('tasks')) {
      return;
    }
    // Run daily carry-over (server-side guarded)
    supabase.rpc('carry_over_incomplete_tasks')
      .then((res) => {
        if (res.error) {
          console.warn('Carry-over RPC error:', res.error.message);
        } else {
          const updated = Array.isArray(res.data) && res.data[0]?.updated_count;
          if (updated && updated > 0) {
            console.log(`Carried over ${updated} tasks to today`);
          }
        }
      })
      .catch((e) => console.warn('Carry-over RPC failed:', e));

    fetchTasks();
    fetchEmployees();
    const jid = searchParams.get('jobId');
    if (jid) {
      setCreateOpen(true);
      setFormData((prev) => ({ ...prev, job_id: jid }));
    }
  }, [checkAccessAndNavigate]);

  // Real-time updates for task time entries
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('task_time_entries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_time_entries',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Time entry change:', payload);
          // Refresh tasks to get updated time data
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      // First get tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch time summary separately and merge client-side (views have no FK)
      const taskIds = (tasksData || []).map(t => t.id);
      let timeSummary: Array<{ task_id: string; spent_seconds: number }>|null = null;
      if (taskIds.length > 0) {
        const { data: tsData, error: tsError } = await supabase
          .from('v_task_time_summary')
          .select('task_id, spent_seconds')
          .in('task_id', taskIds);
        if (tsError) throw tsError;
        timeSummary = tsData;
      }

      // Get all unique user IDs
      const userIds = new Set<string>();
      tasksData?.forEach(task => {
        userIds.add(task.created_by);
      });

      // Get all task assignees
      const { data: assigneesData, error: assigneesError } = await supabase
        .from('task_assignees')
        .select(`
          task_id,
          user_id
        `);

      if (assigneesError) throw assigneesError;

      // Get assignee profiles
      const assigneeIds = [...new Set(assigneesData?.map(a => a.user_id) || [])];
      const { data: assigneeProfiles, error: assigneeProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds);

      if (assigneeProfilesError) throw assigneeProfilesError;

      // Get all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Get task attachments
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('task_attachments')
        .select('*')
        .order('created_at', { ascending: false });

      if (attachmentsError) throw attachmentsError;

      // Combine the data
      const tasksWithRelations = tasksData?.map(task => ({
        ...task,
        spent_seconds: timeSummary?.find(ts => ts.task_id === task.id)?.spent_seconds ?? null,
        profiles: profilesData?.find(p => p.id === task.created_by),
        task_assignees: assigneesData?.filter(a => a.task_id === task.id).map(assignee => ({
          ...assignee,
          profiles: assigneeProfiles?.find(p => p.id === assignee.user_id)
        })) || [],
        task_attachments: attachmentsData?.filter(a => a.task_id === task.id) || []
      })) || [];

      setTasks(tasksWithRelations);
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (fileUrl: string, fileName: string) => {
    const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
    setAttachedFiles(prev => [...prev, { fileUrl, fileName, fileType }]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([
          {
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            due_date: formData.due_date || null,
            location_required: formData.location_required,
            requires_proof: formData.requires_proof,
            created_by: user?.id,
            status: 'pending',
            job_id: formData.job_id || null,
            task_identification_code: formData.task_identification_code || null,
          },
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Assign employees to task
      if (formData.assignee_ids.length > 0 && taskData) {
        const assignments = formData.assignee_ids.map((userId) => ({
          task_id: taskData.id,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from('task_assignees')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      // Upload attached files
      if (attachedFiles.length > 0 && taskData) {
        const attachments = attachedFiles.map((file) => ({
          task_id: taskData.id,
          file_name: file.fileName,
          file_url: file.fileUrl,
          file_type: file.fileType,
          uploaded_by: user?.id,
        }));

        const { error: attachmentError } = await supabase
          .from('task_attachments')
          .insert(attachments);

        if (attachmentError) throw attachmentError;
      }

      const { default: Alert } = await import('@/utils/alert');
      Alert.success('Task created successfully');

      setCreateOpen(false);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        location_required: false,
        requires_proof: false,
        assignee_ids: [],
      });
      setAttachedFiles([]);
      fetchTasks();
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq('id', taskId);

      if (error) throw error;

      const { default: Alert } = await import('@/utils/alert');
      Alert.toast('Task status updated');

      fetchTasks();
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    }
  };

  const handleCompleteTask = (taskId: string) => {
    setCurrentTaskId(taskId);
    setShowCamera(true);
  };

  const handlePhotoCapture = async (imageBlob: Blob) => {
    if (!currentTaskId) return;

    try {
      // Upload the photo proof
      const fileName = `proof_${currentTaskId}_${Date.now()}.jpg`;
      const filePath = `proofs/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, imageBlob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('files')
        .getPublicUrl(filePath);

      // Update task status to pending approval with photo proof
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: 'pending_approval',
          proof_photo_url: publicUrl,
          completed_at: new Date().toISOString()
        })
        .eq('id', currentTaskId);

      if (updateError) throw updateError;

      Alert.success('Task completed! Photo proof uploaded. Waiting for admin approval.');
      fetchTasks();
    } catch (error: any) {
      console.error('Error uploading proof photo:', error);
      Alert.error('Error', 'Failed to upload photo proof. Please try again.');
    } finally {
      setShowCamera(false);
      setCurrentTaskId(null);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    const confirmed = await Alert.confirm(
      'Approve Task',
      'Are you sure you want to approve this task?'
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      Alert.success('Task approved successfully');
      fetchTasks();
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'rejected',
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', taskId);

      if (error) throw error;

      Alert.success('Task rejected successfully');
      fetchTasks();
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = await Alert.confirm('Delete task?', 'This action cannot be undone.');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);

      if (error) throw error;

      const { default: Alert } = await import('@/utils/alert');
      Alert.success('Task deleted successfully');

      setDetailsOpen(false);
      fetchTasks();
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'pending_approval':
        return <Camera className="w-4 h-4 text-blue-500" />;
      case 'rejected':
        return <X className="w-4 h-4 text-destructive" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'pending_approval':
        return 'outline';
      case 'rejected':
        return 'destructive';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const toggleAssignee = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(userId)
        ? prev.assignee_ids.filter((id) => id !== userId)
        : [...prev.assignee_ids, userId],
    }));
  };

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  // Check for access permission - this will handle auto-backout for no_access
  if (!hasAccess('tasks')) {
    return <NoAccess resource="Tasks" />;
  }

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
              <p className="text-muted-foreground font-medium">Loading tasks...</p>
              <p className="text-sm text-muted-foreground/70">Fetching your task list</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold">Tasks</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage and track your tasks</p>
          </div>
          {canEdit('tasks') && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Add a new task and assign to employees</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task_identification_code">Task Identification Code</Label>
                    <Input
                      id="task_identification_code"
                      placeholder="Enter task identification code (e.g., TASK-001, PROJ-2024-001)"
                      value={formData.task_identification_code}
                      onChange={(e) => setFormData({ ...formData, task_identification_code: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional: Enter a custom identification code for easier task tracking. If left empty, a code will be auto-generated.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) =>
                          setFormData({ ...formData, priority: value as 'low' | 'medium' | 'high' | 'urgent' })
                        }
                      >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="location_required"
                        checked={formData.location_required}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, location_required: checked as boolean })
                        }
                      />
                      <Label htmlFor="location_required" className="cursor-pointer">
                        Location Required
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requires_proof"
                        checked={formData.requires_proof}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, requires_proof: checked as boolean })
                        }
                      />
                      <Label htmlFor="requires_proof" className="cursor-pointer">
                        Requires Proof/Photo
                      </Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign To Employees (multiple)</Label>
                    <Input
                      placeholder="Search employees..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                    />
                    <ScrollArea className="h-48 border rounded-md p-4">
                      <div className="space-y-2">
                        {employees
                          .filter((e) => e.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                          .map((employee) => (
                            <div key={employee.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`employee-${employee.id}`}
                                checked={formData.assignee_ids.includes(employee.id)}
                                onCheckedChange={() => toggleAssignee(employee.id)}
                              />
                              <Label htmlFor={`employee-${employee.id}`} className="cursor-pointer font-normal">
                                {employee.full_name} ({employee.email})
                              </Label>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                    {formData.assignee_ids.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Selected: {formData.assignee_ids.length} employee{formData.assignee_ids.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  
                  {/* File Upload Section */}
                  <div className="space-y-2">
                    <Label>Attach Documents (Optional)</Label>
                    <FileUpload
                      onUploadComplete={handleFileUpload}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif"
                      maxSize={10}
                      className="w-full"
                    />
                    
                    {/* Display attached files */}
                    {attachedFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Attached Files</Label>
                        <div className="space-y-1">
                          {attachedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <div className="flex items-center space-x-2">
                                <File className="w-4 h-4" />
                                <span className="text-sm">{file.fileName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {file.fileType.toUpperCase()}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAttachedFile(index)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full">
                    Create Task
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-filter">Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger id="priority-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        <div className="grid gap-4">
          {/* Progress Summary */}
          {tasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Progress Summary</CardTitle>
                <CardDescription>Overview of tasks by status and priority</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const total = tasks.length;
                  const completed = tasks.filter(t => t.status === 'completed').length;
                  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
                  const pendingApproval = tasks.filter(t => t.status === 'pending_approval').length;
                  const pending = tasks.filter(t => t.status === 'pending').length;
                  const rejected = tasks.filter(t => t.status === 'rejected').length;

                  const pct = Math.round((completed / total) * 100);

                  const byPriority = {
                    urgent: tasks.filter(t => t.priority === 'urgent').length,
                    high: tasks.filter(t => t.priority === 'high').length,
                    medium: tasks.filter(t => t.priority === 'medium').length,
                    low: tasks.filter(t => t.priority === 'low').length,
                  } as const;

                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2 text-sm">
                          <span>Overall Completion</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{pct}%</span>
                            <Button size="sm" variant="outline" onClick={() => {
                              const weekAgo = new Date();
                              weekAgo.setDate(weekAgo.getDate() - 7);
                              const rows = tasks
                                .filter(t => new Date(t.created_at) >= weekAgo)
                                .map(t => ({
                                  id: t.id,
                                  title: t.title,
                                  status: t.status,
                                  priority: t.priority,
                                  created_at: new Date(t.created_at).toLocaleString(),
                                  due_date: t.due_date ? new Date(t.due_date).toLocaleString() : '',
                                  completed_at: (t as any).completed_at ? new Date((t as any).completed_at).toLocaleString() : '',
                                }));
                              downloadTasksInvoiceSvg(`weekly_tasks_${new Date().toISOString().slice(0,10)}`, rows, { title: 'Weekly Tasks Invoice' });
                            }}>Export weekly Invoice (SVG)</Button>
                          </div>
                        </div>
                        <Progress value={pct} />
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-muted-foreground">
                          <div>Completed: {completed}</div>
                          <div>In progress: {inProgress}</div>
                          <div>Pending: {pending}</div>
                          <div>Pending approval: {pendingApproval}</div>
                          <div>Rejected: {rejected}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-3 rounded-md border bg-card">
                          <div className="text-xs text-muted-foreground">Urgent</div>
                          <div className="text-lg font-semibold">{byPriority.urgent}</div>
                        </div>
                        <div className="p-3 rounded-md border bg-card">
                          <div className="text-xs text-muted-foreground">High</div>
                          <div className="text-lg font-semibold">{byPriority.high}</div>
                        </div>
                        <div className="p-3 rounded-md border bg-card">
                          <div className="text-xs text-muted-foreground">Medium</div>
                          <div className="text-lg font-semibold">{byPriority.medium}</div>
                        </div>
                        <div className="p-3 rounded-md border bg-card">
                          <div className="text-xs text-muted-foreground">Low</div>
                          <div className="text-lg font-semibold">{byPriority.low}</div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        {(() => {
                          const totalSpent = tasks.reduce((s, t) => s + (t.spent_seconds || 0), 0);
                          const totalEst = tasks.reduce((s, t) => s + ((t.estimated_hours || 0) * 3600), 0);
                          const hrs = (secs: number) => (secs / 3600).toFixed(1);
                          return (
                            <div className="flex gap-4 flex-wrap">
                              <span>Actual: {hrs(totalSpent)} h</span>
                              <span>Estimated: {hrs(totalEst)} h</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tasks found</p>
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task) => (
              <Card key={task.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>{task.title}</CardTitle>
                        {task.task_identification_code && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            {task.task_identification_code}
                          </Badge>
                        )}
                        {task.location_required && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            Location
                          </Badge>
                        )}
                        {task.requires_proof && (
                          <Badge variant="outline" className="text-xs">
                            <FileCheck className="w-3 h-3 mr-1" />
                            Proof Required
                          </Badge>
                        )}
                        {task.task_attachments && task.task_attachments.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <File className="w-3 h-3 mr-1" />
                            {task.task_attachments.length} Attachment{task.task_attachments.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{task.description}</CardDescription>
                      {task.task_assignees && task.task_assignees.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>
                            Assigned to: {task.task_assignees.map((a) => a.profiles.full_name).join(', ')}
                          </span>
                        </div>
                      )}
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(task.due_date).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(task.status)}
                        <Badge variant={getStatusVariant(task.status)}>{task.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {/* Task Timer with Actions */}
                    <TaskTimer
                      taskId={task.id}
                      estimatedHours={task.estimated_hours}
                      spentSeconds={task.spent_seconds}
                      status={task.status}
                      canEdit={canEdit('tasks')}
                      onStatusChange={(newStatus) => handleUpdateStatus(task.id, newStatus as any)}
                      compact={true}
                    />

                    {/* Complete with Photo Button - Only show for tasks requiring proof */}
                    {canEdit('tasks') && task.requires_proof && task.status === 'in_progress' && (
                      <Button size="sm" onClick={() => handleCompleteTask(task.id)}>
                        <Camera className="w-4 h-4 mr-2" />
                        Complete with Photo
                      </Button>
                    )}

                    {/* Admin Approval Buttons - Only show for pending_approval tasks */}
                    {isAdmin && task.status === 'pending_approval' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleApproveTask(task.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectTask(task.id)}>
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}

                    {/* Details Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailsOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Details
                    </Button>

                    {/* Delete Button - Only for admins */}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Task Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Task Details</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedTask.title}</h3>
                  <p className="text-muted-foreground mt-1">{selectedTask.description}</p>
                  {selectedTask.task_identification_code && (
                    <div className="mt-2">
                      <Label className="text-muted-foreground">Task ID</Label>
                      <p className="mt-1 font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                        {selectedTask.task_identification_code}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Task Timer */}
                <TaskTimer
                  taskId={selectedTask.id}
                  estimatedHours={selectedTask.estimated_hours}
                  spentSeconds={selectedTask.spent_seconds}
                  status={selectedTask.status}
                  canEdit={canEdit('tasks')}
                  onStatusChange={(newStatus) => {
                    handleUpdateStatus(selectedTask.id, newStatus as any);
                    setSelectedTask({ ...selectedTask, status: newStatus });
                  }}
                  compact={false}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedTask.status)}
                      <Badge variant={getStatusVariant(selectedTask.status)}>
                        {selectedTask.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Priority</Label>
                    <div className="mt-1">
                      <Badge variant={getPriorityVariant(selectedTask.priority)}>{selectedTask.priority}</Badge>
                    </div>
                  </div>
                </div>
                {selectedTask.due_date && (
                  <div>
                    <Label className="text-muted-foreground">Due Date</Label>
                    <p className="mt-1">{new Date(selectedTask.due_date).toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Created By</Label>
                  <p className="mt-1">{selectedTask.profiles?.full_name || 'Unknown'}</p>
                </div>
                {selectedTask.task_assignees && selectedTask.task_assignees.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Assigned To</Label>
                    <div className="mt-1 space-y-1">
                      {selectedTask.task_assignees.map((assignee, index) => (
                        <p key={index}>{assignee.profiles.full_name} ({assignee.profiles.email})</p>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Created At</Label>
                  <p className="mt-1">{new Date(selectedTask.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {selectedTask.location_required && (
                    <Badge variant="outline">
                      <MapPin className="w-3 h-3 mr-1" />
                      Location Required
                    </Badge>
                  )}
                  {selectedTask.requires_proof && (
                    <Badge variant="outline">
                      <FileCheck className="w-3 h-3 mr-1" />
                      Proof Required
                    </Badge>
                  )}
                </div>
                
                {/* Task Attachments */}
                {selectedTask.task_attachments && selectedTask.task_attachments.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Attached Files</Label>
                    <div className="mt-2 space-y-2">
                      {selectedTask.task_attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div className="flex items-center space-x-3">
                            <File className="w-4 h-4" />
                            <div>
                              <p className="text-sm font-medium">{attachment.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {attachment.file_type.toUpperCase()} • {new Date(attachment.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(attachment.file_url, '_blank')}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = attachment.file_url;
                                link.download = attachment.file_name;
                                link.click();
                              }}
                            >
                              <File className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photo Proof */}
                {selectedTask.proof_photo_url && (
                  <div>
                    <Label className="text-muted-foreground">Photo Proof</Label>
                    <div className="mt-2">
                      <img
                        src={selectedTask.proof_photo_url}
                        alt="Task completion proof"
                        className="w-full max-w-md h-auto rounded-md border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Captured on: {selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Approval/Rejection Info */}
                {selectedTask.approved_at && (
                  <div>
                    <Label className="text-muted-foreground">Approval Info</Label>
                    <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        ✅ Approved on {new Date(selectedTask.approved_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {selectedTask.rejected_at && (
                  <div>
                    <Label className="text-muted-foreground">Rejection Info</Label>
                    <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">
                        ❌ Rejected on {new Date(selectedTask.rejected_at).toLocaleString()}
                      </p>
                      {selectedTask.rejection_reason && (
                        <p className="text-sm text-red-700 mt-1">
                          <strong>Reason:</strong> {selectedTask.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Camera Capture Modal */}
        <CameraCapture
          isOpen={showCamera}
          onCapture={handlePhotoCapture}
          onClose={() => {
            setShowCamera(false);
            setCurrentTaskId(null);
          }}
        />
      </div>
    </Layout>
  );
};

export default Tasks;
