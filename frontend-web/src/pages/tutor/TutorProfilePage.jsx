import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subjectApi } from '../../api/subjects';
import { tutorApi } from '../../api/tutors';
import { SubjectSelector } from '../../components/tutor/SubjectSelector';
import { TutorStatusBadge } from '../../components/tutor/TutorStatusBadge';
import { useAuth } from '../../hooks/useAuth';

export function TutorProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
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
  const [message, setMessage] = useState('');

  const selectedSubjects = useMemo(
    () => subjects.filter((subject) => form.subjectIds.includes(subject.id)),
    [subjects, form.subjectIds]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [subjectList, currentProfile] = await Promise.all([
          subjectApi.list(),
          tutorApi.getProfile().catch((profileError) => {
            if (profileError.message?.includes('not found')) return null;
            throw profileError;
          })
        ]);

        if (!active) return;

        setSubjects(subjectList);
        setProfile(currentProfile);

        if (currentProfile) {
          setForm({
            bio: currentProfile.bio || '',
            education: currentProfile.education || '',
            experienceYears: currentProfile.experienceYears || 0,
            subjectIds: (currentProfile.subjects || []).map((subject) => subject.id)
          });
        }
      } catch (loadError) {
        setError(loadError.message || 'Khong the tai du lieu ho so gia su.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
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
    if (message) setMessage('');
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

    if (form.subjectIds.length === 0) {
      setError('Vui long chon it nhat mot mon/chuyen mon.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        bio: form.bio.trim(),
        education: form.education.trim(),
        experienceYears: Number(form.experienceYears),
        subjectIds: form.subjectIds
      };

      const saved = profile
        ? await tutorApi.updateProfile(payload)
        : await tutorApi.createProfile(payload);

      setProfile(saved);
      setMessage('Ho so da duoc gui va dang cho Staff xet duyet.');
    } catch (saveError) {
      setError(saveError.message || 'Khong the luu ho so gia su.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="tutor-profile-page"><div className="profile-card">Dang tai ho so...</div></main>;
  }

  return (
    <main className="tutor-profile-page">
      <section className="profile-card tutor-profile-shell">
        <div className="profile-heading">
          <div>
            <p>TutorConnect</p>
            <h1>Ho so gia su</h1>
            <span>{user?.fullName}</span>
            <small>{user?.email}</small>
          </div>
          <button type="button" onClick={() => navigate('/dashboard')}>Vao dashboard</button>
        </div>

        {profile?.status && <TutorStatusBadge status={profile.status} />}
        {profile?.status === 'REJECTED' && profile.rejectionReason && (
          <div className="reject-note">
            <b>Ly do tu choi:</b>
            <span>{profile.rejectionReason}</span>
          </div>
        )}

        <form onSubmit={submit} className="tutor-profile-form">
          <label>
            <span>Gioi thieu</span>
            <textarea name="bio" value={form.bio} onChange={change} rows="5" required />
          </label>

          <label>
            <span>Hoc van</span>
            <input name="education" value={form.education} onChange={change} required />
          </label>

          <label>
            <span>So nam kinh nghiem</span>
            <input
              type="number"
              min="0"
              max="60"
              name="experienceYears"
              value={form.experienceYears}
              onChange={change}
              required
            />
          </label>

          <div>
            <span className="section-label">Mon/chuyen mon</span>
            {selectedSubjects.length > 0 && (
              <div className="selected-subjects">
                {selectedSubjects.map((subject) => (
                  <button key={subject.id} type="button" onClick={() => toggleSubject(subject.id)}>
                    {subject.name} ×
                  </button>
                ))}
              </div>
            )}
            <SubjectSelector
              subjects={subjects}
              selectedIds={form.subjectIds}
              categoryId={categoryId}
              keyword={keyword}
              onCategoryChange={setCategoryId}
              onKeywordChange={setKeyword}
              onToggleSubject={toggleSubject}
            />
          </div>

          {error && <div className="error" role="alert">{error}</div>}
          {message && <div className="success" role="status">{message}</div>}

          <button className="primary" disabled={busy}>
            {busy ? 'Dang gui...' : profile ? 'Cap nhat ho so' : 'Gui ho so'}
          </button>
        </form>

        <p className="switch"><Link to="/">Quay ve trang chu</Link></p>
      </section>
    </main>
  );
}
