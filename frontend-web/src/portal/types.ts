/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "student" | "tutor" | "staff" | "admin";

export interface StudentRequest {
  id: string;
  studentName: string;
  avatarChar: string; // "JD", "SR", etc.
  avatarColor: string; // bg colors for avatar
  subject: string;
  requestedDate: string;
  status: "pending" | "approved" | "rejected";
}

export interface ScheduleItem {
  id: string;
  time: string;
  period: "AM" | "PM";
  title: string;
  detailType: "students" | "location" | "virtual";
  detailValue: string;
  status: "active" | "past";
}

export interface TutorProfile {
  id: string;
  name: string;
  subject: string;
  rating: number;
  reviewsCount: number;
  avatarUrl: string;
  isOnline: boolean;
}

export interface Course {
  id: string;
  title: string;
  tag: string; // "Best Seller", "New", etc.
  tagColor: string;
  tutorName: string;
  tutorAvatar: string;
  duration: string;
  studentCount: string;
  price: number;
  originalPrice: number;
  coverImage: string;
  isFavorite?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "partner"; // user is current active role
  text: string;
  timestamp: string;
  attachments?: {
    name: string;
    size: string;
    type: "pdf" | "image";
  }[];
}

export interface Conversation {
  id: string;
  partnerName: string;
  partnerAvatar: string;
  partnerRole: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  messages: ChatMessage[];
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "Student" | "Tutor" | "Admin";
  joinedDate: string;
  status: "Active" | "Suspended" | "Pending";
  avatarUrl: string;
}

export interface AppProfileSettings {
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: string;
  educationLevel: string;
  availableTime: string;
  physicalAddress: string;
  profileStrength: number;
  status: "none" | "pending" | "approved" | "rejected";
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  teachingLevel?: string;
  subjects?: string[];
}

export type TutorApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TutorApprovalSubject {
  id: number;
  name: string;
}

export interface TutorApprovalDocument {
  id: string;
  name: string;
  type?: string;
  url?: string;
}

export interface TutorApprovalItem {
  id: number;
  userId?: number;
  fullName: string;
  email: string;
  bio: string;
  education: string;
  experienceYears: number;
  status: TutorApprovalStatus;
  rejectionReason?: string | null;
  subjects: TutorApprovalSubject[];
  documents?: TutorApprovalDocument[];
  createdAt?: string;
  updatedAt?: string;
}
