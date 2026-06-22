/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Users,
  ShieldCheck,
  Activity,
  AlertTriangle,
  UserPlus,
  Search,
  Filter,
  Trash2,
  SquarePen,
  X,
  CheckCircle,
  Plus,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { SystemUser } from "../types";

interface AdminPortalProps {
  users: SystemUser[];
  onAddUser: (u: Omit<SystemUser, "id" | "joinedDate">) => void;
  onUpdateUser: (u: SystemUser) => void;
  onDeleteUser: (id: string) => void;
}

export function AdminPortal({
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}: AdminPortalProps) {
  // Filters local states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);

  // New user form state
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    role: "Student" as "Student" | "Tutor" | "Admin",
    status: "Active" as "Active" | "Suspended" | "Pending",
    avatarUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDorJ4qyZIREwslmenco5ww4h0VRgSSNFoXCmlbkX5YQV4zfkBU9R8uwO3h_zUzV3dQnwAwKnelgvSLtMmAu-wVqElbpvZBkcCY8emLnlFN___0WClwM-gopuij--L9ufoma_ZEl84CiEeaAt-I7B98SBpZ-AXMqn1fLROFbb-TkRDfhhagZpFmnJHOmE2IdK0atd1ziPmgUGcPDq1y387vZI34s2955gCXwPjvxE1GBVFtAp7TKNst8Bl0UGsE3OzdAkYPf6Jm4Ir4",
  });

  // Edit user form state
  const [editForm, setEditForm] = useState<SystemUser | null>(null);

  // System statistics computations
  const stats = useMemo(() => {
    const students = users.filter((u) => u.role === "Student").length;
    const tutors = users.filter((u) => u.role === "Tutor").length;
    const suspended = users.filter((u) => u.status === "Suspended").length;
    return { students, tutors, suspended, total: users.length };
  }, [users]);

  // Sorting / Filter logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchRole = roleFilter === "ALL" || u.role.toUpperCase() === roleFilter.toUpperCase();
      const matchStatus = statusFilter === "ALL" || u.status.toUpperCase() === statusFilter.toUpperCase();

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleOpenEdit = (user: SystemUser) => {
    setSelectedUser(user);
    setEditForm({ ...user });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      onUpdateUser(editForm);
      setIsEditModalOpen(false);
      setSelectedUser(null);
      setEditForm(null);
    }
  };

  const handleSaveAdd = () => {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      alert("Please fill out all user information fields!");
      return;
    }
    // Set matching placeholders for avatar
    let placeholderAvatar = addForm.avatarUrl;
    if (addForm.role === "Student") {
      placeholderAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuBYfodNBlGcqTaAKMNzNGEaAOg2AUygYGk8XYUF-_NxGI0SZ75MJgFNJvnmJOrkWem-SdVi53mp7A_Wnz4MmsG2XPHrfEQDt4ZmgHzGQFPvWonX1v39Fb71Q5zdulTudkDaMij4Xw9Q4Y57T8jqjnkI-7mohDZBerRX-WeA0xJNdv_gXWnBJu5hwIMtOWgoxSaYkJWwoQhgaRZss0L-r-SwS2c2dlRlQPWBtoeTCIDIR_sv_jgEgBVf97PjoOk6KVZHKS6VAf0II9GY";
    } else if (addForm.role === "Tutor") {
      placeholderAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuBhwW3n6U0eBWTDne_iulj_Auj40EVPpMpQb_Ty2AmFqUqnCNtOtcugJcmoz3Wqy5667xVuLljO9Q7wnie5Nlxc0xfVQ4EW-BkKrLtK7ulPXjCY2tNCUPRksiYJkTTOuRQi4l12qR7vruVIbGkokyxG2U5HamxYV8xTj2EAiBram-_YsKG4hlqzbt1VQGJIZcsEI-_LymkavkzmdrrbDSNe1lBDVhtMVZJxmhimVQREO5_faCg4la-rGcz9tzLq9zH_bWjSEgA-qwnm";
    }

    onAddUser({
      name: addForm.name,
      email: addForm.email,
      role: addForm.role,
      status: addForm.status,
      avatarUrl: placeholderAvatar,
    });

    setIsAddModalOpen(false);
    setAddForm({
      name: "",
      email: "",
      role: "Student",
      status: "Active",
      avatarUrl: placeholderAvatar,
    });
  };

  return (
    <div className="font-sans select-none max-w-7xl mx-auto pb-10 space-y-8">
      
      {/* Platform security administration banner */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-2xl lg:text-3xl text-brand-text tracking-tight flex items-center gap-2">
            Platform User Control
          </h2>
          <p className="text-brand-text-variant/80 text-sm">
            Control platform administrative policies, manage verified tutor certifications, and handle users.
          </p>
        </div>
        <div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-brand-primary text-white hover:bg-brand-primary/95 rounded-xl font-display font-black text-xs tracking-widest flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-primary/10 active:scale-98 cursor-pointer shadow-md shrink-0"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            ADD NEW USER
          </button>
        </div>
      </section>

      {/* Top Bento statistics card grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none leading-none">
        
        {/* Stat 1 */}
        <div className="bg-white border border-brand-border/30 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="font-display font-black text-2xl text-brand-text">{stats.total}</p>
            <p className="text-[10px] uppercase font-bold text-brand-text-variant/50 tracking-wider mt-1 font-display">
              Registered Users
            </p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white border border-brand-border/30 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="font-display font-black text-2xl text-brand-text">{stats.tutors}</p>
            <p className="text-[10px] uppercase font-bold text-brand-text-variant/50 tracking-wider mt-1 font-display">
              Verified Tutors
            </p>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white border border-brand-border/30 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="font-display font-black text-2xl text-brand-text">99.98%</p>
            <p className="text-[10px] uppercase font-bold text-brand-text-variant/50 tracking-wider mt-1 font-display">
              System Live Uptime
            </p>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white border border-brand-border/30 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-error/10 text-brand-error flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="font-display font-black text-2xl text-brand-text">
              {stats.suspended}
            </p>
            <p className="text-[10px] uppercase font-bold text-brand-text-variant/50 tracking-wider mt-1 font-display">
              Suspended Accounts
            </p>
          </div>
        </div>

      </section>

      {/* Database core container card */}
      <section className="bg-white border border-brand-border/30 rounded-3xl overflow-hidden shadow-sm">
        
        {/* Table Filters header */}
        <header className="p-6 border-b border-brand-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text-variant/40 w-4.5 h-4.5 shrink-0" />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full bg-brand-low border border-brand-border/20 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold focus:ring-1 focus:ring-brand-primary focus:bg-white outline-none transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            <div className="flex items-center gap-1.5 text-xs text-brand-text-variant font-semibold">
              <Filter className="w-4 h-4 shrink-0 text-brand-text-variant/60" />
              <span>Role:</span>
              <select
                className="bg-brand-low border border-brand-border/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">ALL ROLES</option>
                <option value="Student">STUDENT</option>
                <option value="Tutor">TUTOR</option>
                <option value="Admin">ADMIN</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-brand-text-variant font-semibold">
              <span>Status:</span>
              <select
                className="bg-brand-low border border-brand-border/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">ALL STATUS</option>
                <option value="Active">ACTIVE</option>
                <option value="Suspended">SUSPENDED</option>
                <option value="Pending">PENDING</option>
              </select>
            </div>

            <button
              onClick={() => {
                setRoleFilter("ALL");
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
              title="Reset Filters"
              className="p-2 border border-brand-border/30 hover:bg-brand-low rounded-xl text-brand-text transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4.5 h-4.5 shrink-0" />
            </button>
          </div>
        </header>

        {/* Database table core list */}
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-16 text-center text-brand-text-variant/60 flex flex-col items-center justify-center gap-2">
              <Sparkles className="w-10 h-10 text-yellow-400" />
              <p className="text-base font-bold">No users match criteria</p>
              <p className="text-xs">Adjust filters or try creating some new users to interact with our dataset.</p>
            </div>
          ) : (
            <table className="w-full text-left font-sans">
              <thead className="bg-brand-low text-brand-text-variant/60 font-display text-[10px] font-bold uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-4.5">Platform User</th>
                  <th className="px-6 py-4.5">Account Role</th>
                  <th className="px-6 py-4.5">Joined Date</th>
                  <th className="px-6 py-4.5">Status</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/10 font-sans text-xs">
                {filteredUsers.map((user) => {
                  let roleBadge = "bg-brand-primary/10 text-brand-primary";
                  if (user.role === "Tutor") roleBadge = "bg-brand-secondary/10 text-brand-secondary";
                  if (user.role === "Admin") roleBadge = "bg-brand-text/10 text-brand-text";

                  let statusBadge = "bg-emerald-50 text-emerald-700 border border-emerald-100";
                  if (user.status === "Suspended") statusBadge = "bg-brand-error/5 text-brand-error border border-brand-error/10";
                  if (user.status === "Pending") statusBadge = "bg-amber-50 text-amber-700 border border-amber-100";

                  return (
                    <tr key={user.id} className="hover:bg-brand-low/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            className="w-9 h-9 rounded-full object-cover shadow-sm select-none"
                            src={user.avatarUrl}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                          />
                          <div className="select-none min-w-0">
                            <p className="font-bold text-brand-text text-sm truncate">{user.name}</p>
                            <p className="text-xs text-brand-text-variant/70 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-display font-black uppercase tracking-wider border border-transparent ${roleBadge}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-brand-text-variant/80 font-bold font-sans">
                        {user.joinedDate}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-colors shrink-0"
                            title="Edit User"
                          >
                            <SquarePen className="w-4 h-4 shrink-0" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${user.name}? This cannot be undone.`)) {
                                onDeleteUser(user.id);
                              }
                            }}
                            className="p-1.5 text-brand-error hover:bg-brand-error/5 rounded-xl transition-colors shrink-0"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* CRUD Modal dialog: ADD NEW USER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-brand-border/30 shadow-2xl flex flex-col p-6 space-y-6">
            
            <header className="flex justify-between items-center pb-2 border-b border-brand-border/15 select-none">
              <h3 className="font-display font-black text-base text-brand-text">
                Add Premium Platform User
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-brand-text-variant hover:text-brand-text p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form className="space-y-4 font-sans" onSubmit={(e) => e.preventDefault()}>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  User Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Liam Sterling"
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 focus:border-brand-primary text-xs font-semibold outline-none transition-colors"
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. liam.sterling@university.edu"
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 focus:border-brand-primary text-xs font-semibold outline-none transition-colors"
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Assigned Workspace Role
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 text-xs font-semibold outline-none cursor-pointer"
                  value={addForm.role}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      role: e.target.value as "Student" | "Tutor" | "Admin",
                    }))
                  }
                >
                  <option value="Student">Student (Learning Portal)</option>
                  <option value="Tutor">Tutor (Schedule Marketplace)</option>
                  <option value="Admin">Admin (Control Center)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Account Access Status
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 text-xs font-semibold outline-none cursor-pointer"
                  value={addForm.status}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      status: e.target.value as "Active" | "Suspended" | "Pending",
                    }))
                  }
                >
                  <option value="Active">Active status</option>
                  <option value="Pending">Pending status</option>
                  <option value="Suspended">Suspended / Read-only</option>
                </select>
              </div>

            </form>

            <footer className="flex justify-end gap-3 pt-4 border-t border-brand-border/15 font-display select-none">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2.5 border border-brand-border/30 rounded-xl text-xs font-bold text-brand-text-variant hover:bg-brand-low active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdd}
                className="px-5 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-black tracking-widest hover:bg-brand-primary/95 shadow-md shadow-brand-primary/10 active:scale-95 transition-all cursor-pointer"
              >
                SAVE USER
              </button>
            </footer>

          </div>
        </div>
      )}

      {/* CRUD Modal dialog: EDIT EXISTING USER CUSTOM */}
      {isEditModalOpen && editForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-brand-border/30 shadow-2xl flex flex-col p-6 space-y-6">
            
            <header className="flex justify-between items-center pb-2 border-b border-brand-border/15 select-none">
              <h3 className="font-display font-black text-base text-brand-text">
                Modify Platform User Detail
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-brand-text-variant hover:text-brand-text p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form className="space-y-4 font-sans" onSubmit={(e) => e.preventDefault()}>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Modify Full Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 focus:border-brand-primary text-xs font-semibold outline-none transition-colors"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => prev && { ...prev, name: e.target.value })}
                />
              </div>

              <div className="space-y-1 opacity-60">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Email Address (Unmodifiable)
                </label>
                <input
                  type="email"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/35 bg-brand-low text-xs font-semibold outline-none"
                  value={editForm.email}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Change Workspace Role
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 text-xs font-semibold outline-none cursor-pointer"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev && { ...prev, role: e.target.value as "Student" | "Tutor" | "Admin" }
                    )
                  }
                >
                  <option value="Student">Student (Learning Portal)</option>
                  <option value="Tutor">Tutor (Schedule Marketplace)</option>
                  <option value="Admin">Admin (Control Center)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-text-variant/60 font-display uppercase tracking-widest block">
                  Adjust Status Badge
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border/40 text-xs font-semibold outline-none cursor-pointer"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev && { ...prev, status: e.target.value as "Active" | "Suspended" | "Pending" }
                    )
                  }
                >
                  <option value="Active">Active status</option>
                  <option value="Pending">Pending status</option>
                  <option value="Suspended">Suspended / Read-only</option>
                </select>
              </div>

            </form>

            <footer className="flex justify-end gap-3 pt-4 border-t border-brand-border/15 font-display select-none">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 border border-brand-border/30 rounded-xl text-xs font-bold text-brand-text-variant hover:bg-brand-low active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-black tracking-widest hover:bg-brand-primary/95 shadow-md shadow-brand-primary/10 active:scale-95 transition-all cursor-pointer"
              >
                SAVE EDITS
              </button>
            </footer>

          </div>
        </div>
      )}

    </div>
  );
}
