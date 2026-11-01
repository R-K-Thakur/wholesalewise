"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSession, type SessionData } from "@/app/login/actions";
import {
  getOwnerEmailsAction,
  addOwnerEmailAction,
  removeOwnerEmailAction,
  getStaffMembersAction,
  addStaffMemberAction,
  updateStaffMemberAction,
  resetStaffPasswordAction,
  deleteStaffMemberAction,
} from "@/app/(app)/admin/actions";
import type { StaffMember, StaffMemberInput } from "@/lib/types";
import {
  Loader2,
  PlusCircle,
  Trash2,
  ShieldAlert,
  UserCog,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit,
  Search,
  Lock,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  // Owners State
  const [ownerEmails, setOwnerEmails] = useState<string[]>([]);
  const [isLoadingOwnerEmails, setIsLoadingOwnerEmails] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);

  // Staff Members State
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Staff Dialog State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isSubmittingAddStaff, setIsSubmittingAddStaff] = useState(false);
  const [addStaffForm, setAddStaffForm] = useState<StaffMemberInput>({
    staffId: "",
    name: "",
    email: "",
    password: "",
    isActive: true,
    notes: "",
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit Staff Dialog State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isSubmittingEditStaff, setIsSubmittingEditStaff] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    password: string;
    isActive: boolean;
    notes: string;
  }>({
    name: "",
    email: "",
    password: "",
    isActive: true,
    notes: "",
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Reset Password Dialog State
  const [resetStaff, setResetStaff] = useState<StaffMember | null>(null);
  const [newResetPassword, setNewResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Delete Staff Confirmation Dialog
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  useEffect(() => {
    async function fetchSessionAndData() {
      setIsLoadingPage(true);
      const currentSession = await getSession();
      setSession(currentSession);

      if (!currentSession || currentSession.role !== "owner") {
        toast({
          title: "Access Denied",
          description: "You do not have permission to view admin settings.",
          variant: "destructive",
        });
        router.push("/login");
        return;
      }

      await Promise.all([fetchOwnerEmails(), fetchStaffMembers()]);
      setIsLoadingPage(false);
    }
    fetchSessionAndData();
  }, [router, toast]);

  async function fetchOwnerEmails() {
    setIsLoadingOwnerEmails(true);
    try {
      const emails = await getOwnerEmailsAction();
      setOwnerEmails(emails);
    } catch {
      toast({ title: "Error", description: "Failed to load owner emails.", variant: "destructive" });
    } finally {
      setIsLoadingOwnerEmails(false);
    }
  }

  async function fetchStaffMembers() {
    setIsLoadingStaff(true);
    try {
      const members = await getStaffMembersAction();
      setStaffMembers(members);
    } catch {
      toast({ title: "Error", description: "Failed to load staff members.", variant: "destructive" });
    } finally {
      setIsLoadingStaff(false);
    }
  }

  // --- Helpers ---
  function togglePasswordVisibility(id: string) {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function copyToClipboard(text: string, id: string, label: string) {
    if (!text) {
      toast({
        title: "Nothing to copy",
        description: `${label} is empty.`,
        variant: "destructive",
      });
      return;
    }

    let copied = false;

    // Method 1: Modern navigator.clipboard API (supported in HTTPS or localhost)
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        console.warn("navigator.clipboard.writeText failed, using fallback:", err);
      }
    }

    // Method 2: Synchronous document.execCommand fallback (works in HTTP, LAN IPs, all browsers)
    if (!copied && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);

        copied = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (err) {
        console.error("document.execCommand fallback failed:", err);
      }
    }

    if (copied) {
      setCopiedId(id);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard.`,
      });
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 2000);
    } else {
      toast({
        title: "Could not copy automatically",
        description: `Please copy manually: ${text}`,
        variant: "destructive",
      });
    }
  }

  function generateRandomPassword(): string {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  }

  function handleAutoSuggestStaffId() {
    const count = staffMembers.length + 1;
    const suggested = `STF-${String(count).padStart(2, "0")}`;
    setAddStaffForm((prev) => ({
      ...prev,
      staffId: suggested,
      email: prev.email || `${suggested.toLowerCase()}@wholesalewise.staff`,
    }));
  }

  // --- Handlers: Owner Emails ---
  const handleAddOwnerEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newOwnerEmail) return;
    setIsSubmittingOwner(true);
    const result = await addOwnerEmailAction(newOwnerEmail);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setNewOwnerEmail("");
      await fetchOwnerEmails();
      await fetchStaffMembers();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingOwner(false);
  };

  const handleRemoveOwnerEmail = async (emailToRemove: string) => {
    setIsSubmittingOwner(true);
    const result = await removeOwnerEmailAction(emailToRemove);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchOwnerEmails();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingOwner(false);
  };

  // --- Handlers: Staff Member Add ---
  const handleAddStaffSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addStaffForm.staffId || !addStaffForm.name || !addStaffForm.password) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in Staff ID, Full Name, and Password.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingAddStaff(true);
    try {
      const res = await addStaffMemberAction(addStaffForm);
      if (res.success) {
        toast({ title: "Staff Member Created", description: res.message });
        setIsAddStaffOpen(false);
        setAddStaffForm({
          staffId: "",
          name: "",
          email: "",
          password: "",
          isActive: true,
          notes: "",
        });
        await fetchStaffMembers();
      } else {
        toast({ title: "Failed to Add Staff", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add staff member.", variant: "destructive" });
    } finally {
      setIsSubmittingAddStaff(false);
    }
  };

  // --- Handlers: Staff Member Edit ---
  function openEditDialog(staff: StaffMember) {
    setEditingStaff(staff);
    setEditForm({
      name: staff.name,
      email: staff.email,
      password: staff.password,
      isActive: staff.isActive,
      notes: staff.notes || "",
    });
    setShowEditPassword(false);
  }

  const handleEditStaffSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStaff) return;
    setIsSubmittingEditStaff(true);
    try {
      const res = await updateStaffMemberAction(editingStaff.id, editForm);
      if (res.success) {
        toast({ title: "Staff Updated", description: res.message });
        setEditingStaff(null);
        await fetchStaffMembers();
      } else {
        toast({ title: "Update Failed", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update staff member.", variant: "destructive" });
    } finally {
      setIsSubmittingEditStaff(false);
    }
  };

  // --- Handlers: Staff Password Reset ---
  function openResetDialog(staff: StaffMember) {
    setResetStaff(staff);
    setNewResetPassword(generateRandomPassword());
    setShowResetPassword(true);
  }

  const handleResetPasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetStaff || !newResetPassword) return;
    setIsSubmittingReset(true);
    try {
      const res = await resetStaffPasswordAction(resetStaff.id, newResetPassword);
      if (res.success) {
        toast({ title: "Password Reset", description: res.message });
        setResetStaff(null);
        await fetchStaffMembers();
      } else {
        toast({ title: "Reset Failed", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to reset password.", variant: "destructive" });
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // --- Handlers: Staff Delete ---
  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    setIsSubmittingDelete(true);
    try {
      const res = await deleteStaffMemberAction(deletingStaff.id);
      if (res.success) {
        toast({ title: "Staff Removed", description: res.message });
        setDeletingStaff(null);
        await fetchStaffMembers();
      } else {
        toast({ title: "Delete Failed", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete staff member.", variant: "destructive" });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Filtered staff list based on search term
  const filteredStaff = staffMembers.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.staffId.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    );
  });

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading admin settings...</p>
      </div>
    );
  }

  if (!session || session.role !== "owner") {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <UserCog className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage staff credentials, passwords, login IDs, and store permissions
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            const nextId = `STF-${String(staffMembers.length + 1).padStart(2, "0")}`;
            setAddStaffForm({
              staffId: nextId,
              name: "",
              email: `${nextId.toLowerCase()}@wholesalewise.staff`,
              password: generateRandomPassword(),
              isActive: true,
              notes: "",
            });
            setShowAddPassword(true);
            setIsAddStaffOpen(true);
          }}
          className="gap-2 shadow-sm"
        >
          <PlusCircle className="h-4 w-4" />
          Add Staff Member
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="staff" className="w-full space-y-6">
        <TabsList className="grid w-full sm:w-[450px] grid-cols-2">
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Staff Credentials</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              {staffMembers.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="owners" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span>Store Owners</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              {ownerEmails.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: STAFF CREDENTIALS & MANAGEMENT */}
        {/* ========================================================================= */}
        <TabsContent value="staff" className="space-y-6">
          {/* Recovery Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex items-start gap-3.5">
            <KeyRound className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-foreground">
                Staff Credential Recovery & Management Center
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If any of your staff members forget their <strong>Staff ID</strong> or <strong>Password</strong>, you have full access to view, reveal, copy, or reset their credentials right here. All login details are safely recorded in this dashboard.
              </p>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Staff Members & Credentials
                </CardTitle>
                <CardDescription>
                  Staff can log in with either their Staff ID or Email and their assigned Password.
                </CardDescription>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {isLoadingStaff ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p>Loading staff credentials...</p>
                </div>
              ) : staffMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center border-dashed rounded-lg m-4 border-2">
                  <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <h3 className="font-semibold text-lg">No Staff Members Registered Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
                    Create credentials for your staff members so they can log in to manage inventory, sales, and purchases.
                  </p>
                  <Button
                    onClick={() => {
                      const nextId = "STF-01";
                      setAddStaffForm({
                        staffId: nextId,
                        name: "",
                        email: "stf-01@wholesalewise.staff",
                        password: generateRandomPassword(),
                        isActive: true,
                        notes: "",
                      });
                      setShowAddPassword(true);
                      setIsAddStaffOpen(true);
                    }}
                    className="gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add First Staff Member
                  </Button>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No staff members match &quot;{searchTerm}&quot;
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[120px]">Staff ID</TableHead>
                        <TableHead>Staff Name</TableHead>
                        <TableHead>Login Email</TableHead>
                        <TableHead className="w-[200px]">Password</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="text-right w-[160px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStaff.map((staff) => {
                        const isVisible = visiblePasswords[staff.id];
                        const isIdCopied = copiedId === `id_${staff.id}`;
                        const isNameCopied = copiedId === `name_${staff.id}`;
                        const isEmailCopied = copiedId === `email_${staff.id}`;
                        const isPwdCopied = copiedId === `pwd_${staff.id}`;
                        const isCredsCopied = copiedId === `all_${staff.id}`;

                        return (
                          <TableRow key={staff.id} className="hover:bg-muted/30">
                            {/* Staff ID */}
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="font-mono text-xs font-bold tracking-wide bg-background">
                                  {staff.staffId}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  title="Copy Staff ID"
                                  onClick={() => copyToClipboard(staff.staffId, `id_${staff.id}`, "Staff ID")}
                                >
                                  {isIdCopied ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>

                            {/* Staff Name */}
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">{staff.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  title="Copy Staff Name"
                                  onClick={() => copyToClipboard(staff.name, `name_${staff.id}`, "Staff Name")}
                                >
                                  {isNameCopied ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                              {staff.notes && (
                                <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                  {staff.notes}
                                </div>
                              )}
                            </TableCell>

                            {/* Staff Email */}
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground select-all font-mono">
                                  {staff.email}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  title="Copy Staff Email"
                                  onClick={() => copyToClipboard(staff.email, `email_${staff.id}`, "Staff Email")}
                                >
                                  {isEmailCopied ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>

                            {/* Password */}
                            <TableCell>
                              {staff.password ? (
                                <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded border max-w-fit">
                                  <span className="font-mono text-xs select-all min-w-[70px]">
                                    {isVisible ? staff.password : "••••••••"}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    title={isVisible ? "Hide Password" : "Show Password"}
                                    onClick={() => togglePasswordVisibility(staff.id)}
                                  >
                                    {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    title="Copy Password"
                                    onClick={() => copyToClipboard(staff.password, `pwd_${staff.id}`, "Password")}
                                  >
                                    {isPwdCopied ? (
                                      <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                                  onClick={() => openResetDialog(staff)}
                                >
                                  <KeyRound className="h-3 w-3 mr-1" />
                                  Set Password
                                </Button>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              {staff.isActive ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px]">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px]">
                                  Disabled
                                </Badge>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                  title="Copy All Credentials to share with staff"
                                  onClick={() =>
                                    copyToClipboard(
                                      `Staff Login Details for ${staff.name}:\nStaff ID: ${staff.staffId}\nEmail: ${staff.email}\nPassword: ${staff.password || "[Not Set]"}`,
                                      `all_${staff.id}`,
                                      "Full Credentials"
                                    )
                                  }
                                >
                                  {isCredsCopied ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  <span className="hidden lg:inline ml-1">Copy</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  title="Reset Password"
                                  onClick={() => openResetDialog(staff)}
                                >
                                  <KeyRound className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  title="Edit Staff Member"
                                  onClick={() => openEditDialog(staff)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  title="Delete Staff Member"
                                  onClick={() => setDeletingStaff(staff)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: STORE OWNERS */}
        {/* ========================================================================= */}
        <TabsContent value="owners" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Manage Owner Access
              </CardTitle>
              <CardDescription>
                Owners have full administrative control, including managing staff credentials and store settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddOwnerEmail} className="flex items-end gap-2">
                <div className="flex-grow">
                  <Label htmlFor="newOwnerEmail" className="sr-only">
                    New Owner Email
                  </Label>
                  <Input
                    id="newOwnerEmail"
                    type="email"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="owner@example.com"
                    disabled={isSubmittingOwner}
                  />
                </div>
                <Button type="submit" disabled={isSubmittingOwner || !newOwnerEmail}>
                  {isSubmittingOwner ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  Add Owner
                </Button>
              </form>

              <div className="space-y-3">
                <h3 className="text-base font-medium text-foreground">Current Store Owners:</h3>
                {isLoadingOwnerEmails ? (
                  <div className="flex items-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading owner emails...
                  </div>
                ) : ownerEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No owner emails configured. Add an email to grant owner access.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {ownerEmails.map((email) => (
                      <li
                        key={email}
                        className="flex items-center justify-between p-3 border rounded-md bg-muted/20"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{email}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOwnerEmail(email)}
                          disabled={isSubmittingOwner}
                          className="text-destructive hover:bg-destructive/10"
                          aria-label={`Remove ${email} as owner`}
                        >
                          <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {ownerEmails.length === 1 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>To change the sole owner, add the new owner email first, then remove the current one.</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* DIALOG: ADD STAFF MEMBER */}
      {/* ========================================================================= */}
      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Add New Staff Member
            </DialogTitle>
            <DialogDescription>
              Assign a unique Staff ID and Password. All details will be securely saved in your Admin Dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddStaffSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="add-staffId" className="text-xs font-semibold">
                    Staff ID *
                  </Label>
                  <button
                    type="button"
                    onClick={handleAutoSuggestStaffId}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Suggest
                  </button>
                </div>
                <Input
                  id="add-staffId"
                  placeholder="e.g. STF-01"
                  value={addStaffForm.staffId}
                  onChange={(e) =>
                    setAddStaffForm((prev) => ({
                      ...prev,
                      staffId: e.target.value.toUpperCase().replace(/\s+/g, ""),
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-name" className="text-xs font-semibold">
                  Full Name *
                </Label>
                <Input
                  id="add-name"
                  placeholder="e.g. Rahul Sharma"
                  value={addStaffForm.name}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email" className="text-xs font-semibold">
                Email Address
              </Label>
              <Input
                id="add-email"
                type="email"
                placeholder="staff@example.com (or leave default)"
                value={addStaffForm.email}
                onChange={(e) => setAddStaffForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Staff can log in using either their Staff ID or Email.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="add-password" className="text-xs font-semibold">
                  Login Password *
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    setAddStaffForm((prev) => ({ ...prev, password: generateRandomPassword() }))
                  }
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  <RefreshCw className="h-2.5 w-2.5" /> Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  id="add-password"
                  type={showAddPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={addStaffForm.password}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-notes" className="text-xs font-semibold">
                Notes / Designation (Optional)
              </Label>
              <Input
                id="add-notes"
                placeholder="e.g. Sales Cashier, Morning Shift"
                value={addStaffForm.notes}
                onChange={(e) => setAddStaffForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddStaffOpen(false)}
                disabled={isSubmittingAddStaff}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingAddStaff}>
                {isSubmittingAddStaff && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Staff Credentials
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: EDIT STAFF MEMBER */}
      {/* ========================================================================= */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Staff Member - {editingStaff?.staffId}
            </DialogTitle>
            <DialogDescription>
              Update staff details, change password, or adjust account status.
            </DialogDescription>
          </DialogHeader>

          {editingStaff && (
            <form onSubmit={handleEditStaffSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold">
                  Staff Full Name
                </Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-xs font-semibold">
                  Email Address
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-password" className="text-xs font-semibold">
                    Password (leave as-is or enter new)
                  </Label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm((prev) => ({ ...prev, password: generateRandomPassword() }))
                    }
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Generate
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-notes" className="text-xs font-semibold">
                  Notes
                </Label>
                <Input
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Account Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Disabled accounts cannot log in to WholesaleWise
                  </p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingStaff(null)}
                  disabled={isSubmittingEditStaff}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingEditStaff}>
                  {isSubmittingEditStaff && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: RESET PASSWORD */}
      {/* ========================================================================= */}
      <Dialog open={!!resetStaff} onOpenChange={(open) => !open && setResetStaff(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset Staff Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetStaff?.name}</strong> ({resetStaff?.staffId}).
            </DialogDescription>
          </DialogHeader>

          {resetStaff && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reset-pwd" className="text-xs font-semibold">
                    New Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setNewResetPassword(generateRandomPassword())}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Generate Random
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="reset-pwd"
                    type={showResetPassword ? "text" : "password"}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    required
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">Credentials to share with staff:</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2"
                    onClick={() =>
                      copyToClipboard(
                        `Staff Login for ${resetStaff.name}:\nStaff ID: ${resetStaff.staffId}\nNew Password: ${newResetPassword}`,
                        `dialog_reset_${resetStaff.id}`,
                        "New Credentials"
                      )
                    }
                  >
                    <Copy className="h-2.5 w-2.5" />
                    Copy
                  </Button>
                </div>
                <p className="font-mono text-muted-foreground">Staff ID: {resetStaff.staffId}</p>
                <p className="font-mono text-muted-foreground">New Password: {newResetPassword}</p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetStaff(null)}
                  disabled={isSubmittingReset}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingReset || !newResetPassword}>
                  {isSubmittingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm New Password
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: CONFIRM DELETE STAFF */}
      {/* ========================================================================= */}
      <Dialog open={!!deletingStaff} onOpenChange={(open) => !open && setDeletingStaff(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove Staff Member
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deletingStaff?.name}</strong> (ID: {deletingStaff?.staffId})? Their login access and saved credentials will be deleted.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingStaff(null)}
              disabled={isSubmittingDelete}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteStaff}
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Delete Staff Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
