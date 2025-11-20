import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Edit3, 
  Lock, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Save, 
  X, 
  Eye, 
  EyeOff,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

const UserProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordErrors, setPasswordErrors] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await axios.get('http://localhost:8000/api/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        setProfile(response.data);
      } else {
        setError('No profile data received from server');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
        localStorage.clear();
        navigate('/');
      } else if (error.response?.status === 404) {
        setError('Profile not found. Please contact support.');
      } else {
        setError('Failed to load profile. Please try again.');
      }
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      
      const response = await axios.put('http://localhost:8000/api/profile', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfile(response.data);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const validatePassword = (field, value) => {
    const errors = { ...passwordErrors };
    
    if (field === 'newPassword') {
      if (value.length < 6) {
        errors.new = 'Password must be at least 6 characters';
      } else {
        errors.new = '';
      }
    }
    
    if (field === 'confirmPassword') {
      if (value !== passwordData.newPassword) {
        errors.confirm = 'Passwords do not match';
      } else {
        errors.confirm = '';
      }
    }
    
    setPasswordErrors(errors);
  };

  const handlePasswordInputChange = (field, value) => {
    setPasswordData({ ...passwordData, [field]: value });
    validatePassword(field, value);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordErrors({ ...passwordErrors, confirm: 'Passwords do not match' });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setPasswordErrors({ ...passwordErrors, new: 'Password must be at least 6 characters' });
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:8000/api/profile/change-password', {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
        new_password_confirmation: passwordData.confirmPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({ current: '', new: '', confirm: '' });
      toast.success('Password changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  };


  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
              <div className="text-center">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted">Loading your profile...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid py-4">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card shadow-lg border-0" style={{ borderRadius: '20px' }}>
              <div className="card-body text-center py-5">
                <AlertCircle size={64} className="text-danger mb-3" />
                <h4 className="text-danger mb-3">Profile Loading Error</h4>
                <p className="text-muted mb-4">{error}</p>
                <div className="d-flex gap-2 justify-content-center">
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => navigate('/dashboard')}
                  >
                    <ArrowLeft size={16} className="me-1" />
                    Back to Dashboard
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={fetchProfile}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          {/* Back Button */}
          <div className="mb-3">
            <button
              className="btn btn-outline-secondary"
              onClick={() => navigate('/dashboard')}
              style={{ 
                borderRadius: '10px',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>

          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card shadow-lg border-0 mb-4"
            style={{ borderRadius: '20px', overflow: 'hidden' }}
          >
            <div 
              className="card-header text-white text-center py-4"
              style={{ 
                background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                border: 'none'
              }}
            >
              <div className="d-flex justify-content-center mb-3">
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <User size={40} />
                </div>
              </div>
              <h3 className="mb-1">{profile?.user?.name || 'User'}</h3>
              <p className="mb-0 opacity-75">{profile?.user?.email || 'No email provided'}</p>
            </div>

            <div className="card-body p-4">
              {!editing ? (
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className="d-flex align-items-center">
                      <Mail className="text-primary me-2" size={20} />
                        <div>
                          <small className="text-muted">Email</small>
                          <div className="fw-bold">{profile?.user?.email || 'No email provided'}</div>
                        </div>
                    </div>
                  </div>
                  
                  {profile?.profile?.phone && (
                    <div className="col-md-6 mb-3">
                      <div className="d-flex align-items-center">
                        <Phone className="text-primary me-2" size={20} />
                        <div>
                          <small className="text-muted">Phone</small>
                          <div className="fw-bold">{profile?.profile?.phone}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {profile?.profile?.address && (
                    <div className="col-12 mb-3">
                      <div className="d-flex align-items-start">
                        <MapPin className="text-primary me-2 mt-1" size={20} />
                        <div>
                          <small className="text-muted">Address</small>
                          <div className="fw-bold">{profile?.profile?.address}</div>
                          {profile?.profile?.city && (
                            <div className="text-muted">
                              {profile?.profile?.city}, {profile?.profile?.state} {profile?.profile?.zip_code}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {profile?.profile?.date_of_birth && (
                    <div className="col-md-6 mb-3">
                      <div className="d-flex align-items-center">
                        <Calendar className="text-primary me-2" size={20} />
                        <div>
                          <small className="text-muted">Date of Birth</small>
                          <div className="fw-bold">
                            {new Date(profile?.profile?.date_of_birth).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {profile?.profile?.bio && (
                    <div className="col-12 mb-3">
                      <div>
                        <small className="text-muted">Bio</small>
                        <div className="fw-bold">{profile?.profile?.bio}</div>
                      </div>
                    </div>
                  )}

                  {/* Show message if profile is incomplete */}
                  {!profile?.profile && (
                    <div className="col-12 mb-3">
                      <div className="alert alert-info d-flex align-items-center">
                        <User size={20} className="me-2" />
                        <div>
                          <strong>Complete your profile!</strong> Add more information to personalize your experience.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="col-12 mt-3">
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => setEditing(true)}
                      >
                        <Edit3 size={16} className="me-1" />
                        {profile?.profile ? 'Edit Profile' : 'Complete Profile'}
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPasswordModal(true)}
                      >
                        <Lock size={16} className="me-1" />
                        Change Password
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleProfileUpdate}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        defaultValue={profile?.user?.name}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        defaultValue={profile?.user?.email}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        className="form-control"
                        defaultValue={profile?.profile?.phone}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        name="date_of_birth"
                        className="form-control"
                        defaultValue={profile?.profile?.date_of_birth}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Gender</label>
                      <select name="gender" className="form-select" defaultValue={profile?.profile?.gender}>
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Address</label>
                      <textarea
                        name="address"
                        className="form-control"
                        rows="2"
                        defaultValue={profile?.profile?.address}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        name="city"
                        className="form-control"
                        defaultValue={profile?.profile?.city}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">State</label>
                      <input
                        type="text"
                        name="state"
                        className="form-control"
                        defaultValue={profile?.profile?.state}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Zip Code</label>
                      <input
                        type="text"
                        name="zip_code"
                        className="form-control"
                        defaultValue={profile?.profile?.zip_code}
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Bio</label>
                      <textarea
                        name="bio"
                        className="form-control"
                        rows="3"
                        defaultValue={profile?.profile?.bio}
                      />
                    </div>
                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-success">
                          <Save size={16} className="me-1" />
                          Save Changes
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditing(false)}
                        >
                          <X size={16} className="me-1" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Minimalist Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal fade show d-block"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title">Change Password</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowPasswordModal(false)}
                  />
                </div>
                <form onSubmit={handlePasswordChange}>
                  <div className="modal-body pt-0">
                    {/* Current Password */}
                    <div className="mb-3">
                      <label className="form-label">Current Password</label>
                      <div className="input-group">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          className={`form-control ${passwordErrors.current ? 'is-invalid' : ''}`}
                          value={passwordData.currentPassword}
                          onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                          placeholder={`Current password (${passwordData.currentPassword.length} chars)`}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                        >
                          {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.current && (
                        <div className="text-danger small mt-1">{passwordErrors.current}</div>
                      )}
                    </div>

                    {/* New Password */}
                    <div className="mb-3">
                      <label className="form-label">New Password</label>
                      <div className="input-group">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          className={`form-control ${passwordErrors.new ? 'is-invalid' : ''}`}
                          value={passwordData.newPassword}
                          onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                          placeholder={`New password (${passwordData.newPassword.length} chars, min 6)`}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                        >
                          {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.new && (
                        <div className="text-danger small mt-1">{passwordErrors.new}</div>
                      )}
                    </div>

                    {/* Confirm New Password */}
                    <div className="mb-3">
                      <label className="form-label">Confirm New Password</label>
                      <div className="input-group">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          className={`form-control ${passwordErrors.confirm ? 'is-invalid' : passwordData.confirmPassword && passwordData.confirmPassword === passwordData.newPassword ? 'is-valid' : ''}`}
                          value={passwordData.confirmPassword}
                          onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                          placeholder={`Confirm password (${passwordData.confirmPassword.length} chars)`}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                        >
                          {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.confirm && (
                        <div className="text-danger small mt-1">{passwordErrors.confirm}</div>
                      )}
                      {passwordData.confirmPassword && passwordData.confirmPassword === passwordData.newPassword && (
                        <div className="text-success small mt-1">✓ Passwords match</div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPasswordModal(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={passwordData.newPassword !== passwordData.confirmPassword || passwordData.newPassword.length < 6}
                    >
                      Change Password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default UserProfile;
