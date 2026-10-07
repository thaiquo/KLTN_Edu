import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileText,
  Download,
  UploadCloud,
  Trash2,
  ExternalLink,
  Plus,
  Loader2,
  AlertCircle,
  File,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { classApi } from '../../api/classes';

export function ClassroomMaterialsSection({ classRoomId, currentUserRole = 'STUDENT', classRoomDetails = null }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Upload modal state (Tutor only)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadExternalUrl, setUploadExternalUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Downloading state
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingSyllabus, setDownloadingSyllabus] = useState(false);

  const isTutor = currentUserRole === 'TUTOR';

  const loadMaterials = async () => {
    if (!classRoomId) return;
    setLoading(true);
    setError('');
    try {
      const data = await classApi.getClassroomMaterials(classRoomId);
      setMaterials(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load classroom materials:', err);
      setError(err?.message || 'Không thể tải danh sách tài liệu môn học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [classRoomId]);

  const handleDownload = async (mat) => {
    setDownloadingId(mat.id);
    try {
      const res = await classApi.getClassroomMaterialDownloadUrl(classRoomId, mat.id);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err?.message || 'Không thể lấy đường dẫn tải tài liệu.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSyllabus = async () => {
    setDownloadingSyllabus(true);
    try {
      const res = await classApi.getSyllabusDownloadUrl(classRoomId);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err?.message || 'Lớp học chưa có file lộ trình đính kèm.');
    } finally {
      setDownloadingSyllabus(false);
    }
  };

  const handleDelete = async (matId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi lớp học?')) return;
    try {
      await classApi.deleteClassroomMaterial(classRoomId, matId);
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
    } catch (err) {
      alert(err?.message || 'Không thể xóa tài liệu.');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Vui lòng chọn 1 file tài liệu để tải lên.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      if (uploadDescription.trim()) formData.append('description', uploadDescription.trim());
      if (uploadExternalUrl.trim()) formData.append('externalUrl', uploadExternalUrl.trim());

      const created = await classApi.uploadClassroomMaterial(classRoomId, formData);
      setMaterials((prev) => [created, ...prev]);
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadExternalUrl('');
      setSelectedFile(null);
    } catch (err) {
      alert(err?.message || 'Không thể tải tài liệu lên.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
            <FolderOpen size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 font-display">
                Tài Liệu Môn Học & Giáo Trình
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                Tải ngay không cần điểm danh
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tài nguyên chung của khóa học. Học viên có thể tải về nghiên cứu bất cứ lúc nào.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Syllabus button if available */}
          {classRoomDetails?.syllabusFileName && (
            <button
              type="button"
              onClick={handleDownloadSyllabus}
              disabled={downloadingSyllabus}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
            >
              {downloadingSyllabus ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} className="text-indigo-600" />}
              <span>Lộ trình: {classRoomDetails.syllabusFileName}</span>
            </button>
          )}

          {/* Tutor upload button */}
          {isTutor && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-indigo-600 text-white transition shadow-sm"
            >
              <Plus size={15} />
              <span>Tải tài liệu lên</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
          <Loader2 size={16} className="animate-spin text-indigo-600" />
          <span>Đang tải danh sách tài liệu môn học...</span>
        </div>
      ) : materials.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {materials.map((mat) => (
            <div
              key={mat.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900 truncate" title={mat.title}>
                        {mat.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {mat.fileName} • {formatFileSize(mat.fileSize)}
                      </p>
                    </div>
                  </div>

                  {isTutor && (
                    <button
                      type="button"
                      onClick={() => handleDelete(mat.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Xóa tài liệu này"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {mat.description && (
                  <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 bg-white p-2 rounded-lg border border-slate-100 font-medium">
                    {mat.description}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                {mat.externalUrl ? (
                  <a
                    href={mat.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    <span>Link Drive / Phụ</span>
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">Tài liệu lớp học</span>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(mat)}
                  disabled={downloadingId === mat.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {downloadingId === mat.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  <span>Tải Về Ngay</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <FolderOpen size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-600">Chưa có tài liệu môn học nào được đăng tải</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {isTutor
              ? 'Gia sư có thể tải lên các file giáo trình, đề cương môn học cho cả lớp cùng xem.'
              : 'Gia sư sẽ đẩy các tài liệu môn học lên đây. Bạn sẽ có thể tải về ngay khi có tài liệu mới.'}
          </p>
        </div>
      )}

      {/* UPLOAD MODAL (TUTOR ONLY) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Tài liệu môn học
                </span>
                <h3 className="text-base font-black mt-0.5">Tải Tài Liệu Lên</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn file tài liệu (Bắt buộc) *
                </label>
                <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-4 text-center bg-slate-50 transition cursor-pointer">
                  <input
                    type="file"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!uploadTitle) {
                          setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-700">
                      <File size={16} />
                      <span className="truncate">{selectedFile.name}</span>
                      <span className="text-slate-400">({formatFileSize(selectedFile.size)})</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud size={28} className="mx-auto text-slate-400" />
                      <p className="text-xs font-bold text-slate-700">Nhấn hoặc kéo thả file vào đây</p>
                      <p className="text-[11px] text-slate-400">Hỗ trợ PDF, Word, Excel, Slide, Zip (Tối đa 25MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên hiển thị tài liệu
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ví dụ: Giáo trình môn học, Đề cương ôn tập..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú / Hướng dẫn học viên
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Ghi chú nội dung trọng tâm hoặc lưu ý khi đọc tài liệu..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đường link phụ ngoài (Nếu gia sư muốn bổ sung Google Drive / Notion / Video)
                </label>
                <input
                  type="text"
                  value={uploadExternalUrl}
                  onChange={(e) => setUploadExternalUrl(e.target.value)}
                  placeholder="https://drive.google.com/... (Tùy chọn, không bắt buộc)"
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-black transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  <span>Tải Lên</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
