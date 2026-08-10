import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { subjectApi } from '../api/subjects';
import { tutorApi } from '../api/tutors';
import { AuthLayout } from '../components/AuthLayout';
import { SubjectSelector } from '../components/tutor/SubjectSelector';
import { useAuth } from '../hooks/useAuth';

export function TutorNextStepPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const verifiedEmail = location.state?.email || '';
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    email: verifiedEmail,
    bio: '',
    education: '',
    experienceYears: 0,
    subjectIds: []
  });
  const [categoryId, setCategoryId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedSubjects = useMemo(
    () => subjects.filter((subject) => form.subjectIds.includes(subject.id)),
    [subjects, form.subjectIds]
  );

  useEffect(() => {
    let active = true;

    async function loadSubjects() {
      try {
        const subjectList = await subjectApi.list();
        if (active) setSubjects(subjectList);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Không thể tải danh sách môn học.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSubjects();
    return () => {
      active = false;
    };
  }, []);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'experienceYears' ? Number(value) : value
    }));
    if (error) setError('');
  }

  function toggleSubject(subjectId) {
    setForm((current) => ({
      ...current,
      subjectIds: current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId]
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    if (!form.email.trim()) {
      setError('Thiếu email đã xác minh. Vui lòng đăng ký lại hoặc quay về bước OTP.');
      return;
    }

    if (form.subjectIds.length === 0) {
      setError('Vui lòng chọn ít nhất một môn/chuyên môn.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const email = form.email.trim().toLowerCase();

      await tutorApi.createRegistrationProfile({
        email,
        bio: form.bio.trim(),
        education: form.education.trim(),
        experienceYears: Number(form.experienceYears),
        subjectIds: form.subjectIds
      });

      await logout();

      navigate('/', {
        replace: true,
        state: {
          message: 'Hồ sơ gia sư đã được gửi. EduConnect sẽ thông báo cho bạn khi hồ sơ được Staff duyệt.'
        }
      });
    } catch (saveError) {
      setError(saveError.message || 'Không thể gửi hồ sơ gia sư.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Hoàn tất hồ sơ gia sư"
      description="Điền thông tin cần thiết để Staff xét duyệt hồ sơ trước khi bạn hoạt động với vai trò gia sư."
      wide
    >
      <form onSubmit={submit}>
        <label className="field">
          <span>Email đã xác minh</span>
          <div>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              placeholder="tutor@gmail.com"
              required
              readOnly={Boolean(verifiedEmail)}
            />
          </div>
        </label>

        <label className="field">
          <span>Giới thiệu</span>
          <div>
            <textarea
              name="bio"
              value={form.bio}
              onChange={change}
              placeholder="Tôi có kinh nghiệm giảng dạy Java và cơ sở dữ liệu..."
              rows="4"
              required
            />
          </div>
        </label>

        <label className="field">
          <span>Học vấn</span>
          <div>
            <input
              name="education"
              value={form.education}
              onChange={change}
              placeholder="Đại học Công nghiệp TP.HCM"
              required
            />
          </div>
        </label>

        <label className="field">
          <span>Số năm kinh nghiệm</span>
          <div>
            <input
              type="number"
              min="0"
              max="60"
              name="experienceYears"
              value={form.experienceYears}
              onChange={change}
              required
            />
          </div>
        </label>

        <div>
          <span className="section-label">Môn/chuyên môn</span>
          {selectedSubjects.length > 0 && (
            <div className="selected-subjects">
              {selectedSubjects.map((subject) => (
                <button key={subject.id} type="button" onClick={() => toggleSubject(subject.id)}>
                  {subject.name} ×
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="student">
              <span aria-hidden="true">...</span>
              <span>Đang tải danh sách môn học</span>
            </div>
          ) : (
            <SubjectSelector
              subjects={subjects}
              selectedIds={form.subjectIds}
              categoryId={categoryId}
              keyword={keyword}
              onCategoryChange={setCategoryId}
              onKeywordChange={setKeyword}
              onToggleSubject={toggleSubject}
            />
          )}
        </div>

        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy || loading}>
          {busy ? 'Đang gửi hồ sơ...' : 'Gửi hồ sơ xét duyệt'}
        </button>
      </form>

      <p className="switch">
        Không phải gia sư? <Link to="/login" state={{ email: form.email }}>Quay về đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
