export const TUTOR_SIDEBAR_ENTRIES = [
  { type: "item", id: "dashboard", label: "Tổng quan", icon: "dashboard" },
  { type: "item", id: "community", label: "Bảng tin", icon: "community" },
  {
    type: "group",
    id: "teaching",
    label: "Giảng dạy",
    icon: "teaching",
    items: [
      { id: "my-classes", label: "Lớp học", icon: "classes" },
      { id: "sessions", label: "Quản lý buổi học", icon: "sessions" },
      { id: "homework", label: "Quản lý bài tập", icon: "homework" },
      { id: "subjects", label: "Môn học", icon: "subjects" },
    ],
  },
  { type: "item", id: "schedule", label: "Lịch dạy", icon: "schedule" },
  { type: "item", id: "requests", label: "Yêu cầu học", icon: "requests" },
  { type: "item", id: "messages", label: "Tin nhắn", icon: "messages" },
  {
    type: "group",
    id: "contracts-payments",
    label: "Hợp đồng & thanh toán",
    icon: "payments",
    items: [
      { id: "contracts", label: "Hợp đồng & ký quỹ", icon: "contracts" },
      { id: "wallet", label: "Ví của tôi", icon: "wallet" },
    ],
  },
  { type: "item", id: "complaints", label: "Khiếu nại lớp học", icon: "complaints" },
];

export function getTutorSidebarGroupId(page) {
  return TUTOR_SIDEBAR_ENTRIES.find((entry) =>
    entry.type === "group" && entry.items.some((item) => item.id === page)
  )?.id ?? null;
}

export function getTutorSidebarPageIds() {
  return TUTOR_SIDEBAR_ENTRIES.flatMap((entry) =>
    entry.type === "group" ? entry.items.map((item) => item.id) : [entry.id]
  );
}
