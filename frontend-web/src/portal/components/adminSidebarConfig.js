export const ADMIN_OVERVIEW_ITEM = {
  id: "dashboard",
  label: "Tổng quan giám sát",
  icon: "dashboard",
};

export const ADMIN_SIDEBAR_GROUPS = [
  {
    id: "users-academics",
    label: "Người dùng & học vụ",
    icon: "users",
    items: [
      { id: "user-management", label: "Quản lý người dùng", icon: "users" },
      { id: "tutor-approval", label: "Duyệt hồ sơ gia sư", icon: "approval" },
      { id: "class-management", label: "Quản lý lớp học", icon: "classes" },
      { id: "subject-catalog", label: "Quản lý môn học", icon: "subjects" },
    ],
  },
  {
    id: "finance-contracts",
    label: "Tài chính & hợp đồng",
    icon: "finance",
    items: [
      { id: "admin-finance", label: "Tài chính & dòng tiền", icon: "finance" },
      { id: "contracts", label: "Hợp đồng Escrow", icon: "contracts" },
    ],
  },
  {
    id: "moderation-disputes",
    label: "Kiểm duyệt & khiếu nại",
    icon: "moderation",
    items: [
      { id: "community-moderation", label: "Kiểm duyệt cộng đồng", icon: "community" },
      { id: "escalations", label: "Khiếu nại chuyển cấp", icon: "escalations" },
      { id: "complaints", label: "Phân xử khiếu nại", icon: "complaints" },
    ],
  },
  {
    id: "operations",
    label: "Vận hành",
    icon: "operations",
    items: [
      { id: "staff-duty-management", label: "Điều phối lịch trực", icon: "duty" },
      { id: "reports", label: "Báo cáo nghiệp vụ", icon: "reports" },
    ],
  },
  {
    id: "ai-system",
    label: "AI & hệ thống",
    icon: "ai",
    items: [
      { id: "chatbot-knowledge", label: "Tri thức AI Chatbot", icon: "knowledge" },
      { id: "settings", label: "Cài đặt hệ thống", icon: "settings" },
    ],
  },
];

export function getAdminSidebarGroupId(page) {
  return ADMIN_SIDEBAR_GROUPS.find((group) =>
    group.items.some((item) => item.id === page)
  )?.id ?? null;
}
