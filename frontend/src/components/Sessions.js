import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Modal, Form, Alert, Dropdown } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

function Sessions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentSession, setCurrentSession] = useState({ name: '', session_string: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [activeCredential, setActiveCredential] = useState(null);
  const [showCredModal, setShowCredModal] = useState(false);
  const [newCred, setNewCred] = useState({ name: '', api_id: '', api_hash: '' });
  const [registrationMode, setRegistrationMode] = useState('session_string'); // Only 'session_string'
  const [sessionString, setSessionString] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchCredentials();
    fetchActiveCredential();
    
    // Handle auto-fill from terminal
    if (location.state?.autoFill && location.state?.newSessionString) {
      // Set session string for the modal
      setSessionString(location.state.newSessionString);
      setShowModal(true);
      // Set success message for both modal and page
      setModalSuccess('Session string generated successfully! Please enter a name for this session.');
      setSuccess('Session string generated successfully! Please enter a name for this session.');
      
      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);


  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/sessions');
      if (response.data.success) {
        setSessions(response.data.data);
      }
    } catch (error) {
      setError('Failed to fetch sessions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredentials = async () => {
    try {
      const res = await axios.get('/api/credentials');
      if (res.data.success) setCredentials(res.data.data || []);
    } catch (e) {
      // ignore list error, will be surfaced via actions if needed
    }
  };

  const fetchActiveCredential = async () => {
    try {
      const res = await axios.get('/api/credentials/active');
      if (res.data.success) setActiveCredential(res.data.data || null);
    } catch (e) {
      // ignore
    }
  };

  const handleShowCredModal = () => {
    setNewCred({ name: '', api_id: '', api_hash: '' });
    setShowCredModal(true);
  };

  const handleCloseCredModal = () => {
    setShowCredModal(false);
  };

  const handleSaveCredential = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newCred.name,
        api_id: Number(newCred.api_id),
        api_hash: newCred.api_hash,
      };
      await axios.post('/api/credentials', payload);
      setSuccess('API credential saved');
      setShowCredModal(false);
      await fetchCredentials();
    } catch (err) {
      setError('Failed to save API credential: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleActivateCredential = async (id) => {
    try {
      await axios.put(`/api/credentials/${id}/activate`);
      setSuccess('Active API credential updated');
      await fetchActiveCredential();
      await fetchCredentials();
    } catch (err) {
      setError('Failed to activate API credential: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteCredential = async (id) => {
    try {
      await axios.delete(`/api/credentials/${id}`);
      setSuccess('API credential deleted successfully');
      await fetchCredentials();
      await fetchActiveCredential();
    } catch (err) {
      setError('Failed to delete API credential: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleShowModal = (session = null) => {
    setCurrentSession({ name: '', session_string: '' });
    setRegistrationMode('session_string');
    setSessionString('');
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSessionString('');
    setModalError('');
    setModalSuccess('');
    setIsRegistering(false);
    // Note: Don't clear page-level error/success here
  };




  const openDeleteModal = (session) => {
    setDeleteTarget(session);
    setError('');
    setSuccess('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`/api/sessions/${deleteTarget.id}`);
      setSuccess(`Session "${deleteTarget.name || deleteTarget.first_name || 'Unknown'}" deleted successfully.`);
      closeDeleteModal();
      fetchSessions();
    } catch (err) {
      setError('Failed to delete session: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRegisterWithSessionString = async () => {
    if (!activeCredential) {
      const errorMsg = 'Please configure and activate an API credential first.';
      setModalError(errorMsg);
      setError(errorMsg);  // Also set page error
      return;
    }
    if (!sessionString.trim()) {
      const errorMsg = 'Please enter a session string.';
      setModalError(errorMsg);
      setError(errorMsg);  // Also set page error
      return;
    }
    
    setIsRegistering(true);
    setModalError('');
    setModalSuccess('');
    // Clear page errors when starting new registration
    setError('');
    setSuccess('');
    
    try {
      console.log('Sending registration request:', {
        api_id: activeCredential.api_id,
        api_hash: activeCredential.api_hash,
        session_string_length: sessionString.trim().length,
        has_internal_secret: !!process.env.REACT_APP_INTERNAL_SECRET
      });
      
      const res = await axios.post('/api/sessions/register_string', {
        api_id: activeCredential.api_id,
        api_hash: activeCredential.api_hash,
        session_string: sessionString.trim(),
      }, { headers: { 'x-internal-secret': process.env.REACT_APP_INTERNAL_SECRET || 'default-internal-secret' } });
      
      if (res.data.success) {
        // Set success message in modal
        setModalSuccess('✅ Session registered successfully! Refreshing data...');
        
        // Refresh all data to prevent auth conflicts
        await fetchSessions();
        await fetchCredentials();
        await fetchActiveCredential();
        
        // Show success message for a moment before closing
        setTimeout(() => {
          handleCloseModal();
          // Set success message on page (persists after modal close)
          setSuccess('Session added successfully!');
        }, 1500);
        
      } else {
        const errorMsg = res.data.error || 'Failed to register session';
        setModalError(errorMsg);
        setError(errorMsg);  // Also set page error
      }
    } catch (err) {
      console.error('Registration error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      const errorData = err.response?.data;
      const errorMessage = errorData?.error || err.message;
      
      if (err.response?.status === 400) {
        const errorMsg = `❌ Bad Request: ${errorMessage}`;
        setModalError(errorMsg);
        setError(errorMsg);  // Also set page error
      } else if (err.response?.status === 500) {
        const errorMsg = `❌ Server Error: ${errorMessage}`;
        setModalError(errorMsg);
        setError(errorMsg);  // Also set page error
      } else {
        const errorMsg = `❌ Registration failed: ${errorMessage}`;
        setModalError(errorMsg);
        setError(errorMsg);  // Also set page error
      }
      
      // No special handling for duplicates since duplicate check is removed
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUpdateSession = async (sessionId) => {
    if (!activeCredential) {
      setError('Please configure and activate an API credential first.');
      return;
    }
    try {
      const res = await axios.put(`/api/sessions/${sessionId}/update_data`, {
        api_id: activeCredential.api_id,
        api_hash: activeCredential.api_hash,
      }, { headers: { 'x-internal-secret': process.env.REACT_APP_INTERNAL_SECRET || 'default-internal-secret' } });
      if (res.data.success) {
        setSuccess('Session updated successfully');
        fetchSessions();
      } else {
        setError(res.data.error || 'Failed to update session');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDownloadSession = async (sessionId) => {
    try {
      const response = await axios.get(`/api/sessions/${sessionId}/download`);
      if (response.data.success) {
        const { filename, content } = response.data.data;
        
        // Create blob and download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setSuccess(`Session data downloaded as ${filename}`);
      } else {
        setError(response.data.error || 'Failed to download session data');
      }
    } catch (err) {
      setError('Error downloading session data: ' + (err.response?.data?.error || err.message));
    }
  };


  const handleTestSession = async (session_id) => {
    try {
      const response = await axios.get(`/internal/pyrogram/get_me?session_string=${encodeURIComponent(session_id)}`);
      if (response.data.success) {
        alert(`Session is valid. User: ${response.data.data.first_name} ${response.data.data.last_name || ''}`);
      }
    } catch (error) {
      setError('Error testing session: ' + error.message);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('en-GB'); // dd/mm/yyyy format
    const formattedTime = date.toLocaleTimeString(); // hh:mm:ss format
    return `${formattedDate} ${formattedTime}`;
  };

  if (loading) return <Container><p>Loading sessions...</p></Container>;

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Sessions</h2>
        <div className="d-flex gap-2 align-items-center">
          <Form.Control
            size="sm"
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input-mobile"
            style={{ width: '240px', maxWidth: '100%' }}
          />
          <Button variant="outline-secondary" onClick={handleShowCredModal}>
            Configure API
          </Button>
          <Button variant="primary" onClick={() => handleShowModal()}>
            Add Session
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <div className="mb-3">
        <strong>Active API:</strong>{' '}
        {activeCredential ? (
          <span>{activeCredential.name} (ID: {activeCredential.api_id})</span>
        ) : (
          <span>None</span>
        )}
      </div>

      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th className="d-none-xs">ID</th>
              <th>First Name</th>
              <th className="d-none d-md-table-cell">Last Name</th>
              <th>Username</th>
              <th className="d-none d-lg-table-cell">Data Time</th>
              <th>Actions</th>
            </tr>
          </thead>
        <tbody>
          {sessions
            .filter((session) => {
              const q = search.toLowerCase();
              if (!q) return true;
              return (
                (session.first_name || '').toLowerCase().includes(q) ||
                (session.last_name || '').toLowerCase().includes(q) ||
                (session.username || '').toLowerCase().includes(q) ||
                (session.id || '').toLowerCase().includes(q) ||
                (session.tg_id || '').toString().toLowerCase().includes(q)
              );
            })
            .map((session) => (
            <tr key={session.id}>
              <td className="d-none-xs">{session.id.substring(0, 8)}...</td>
              <td>{session.first_name || 'Unknown'}</td>
              <td className="d-none d-md-table-cell">{session.last_name || ''}</td>
              <td>{session.username || ''}</td>
              <td className="d-none d-lg-table-cell">{formatDateTime(session.login_at)}</td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  {/* Primary Action Button */}
                  <Button 
                    variant="outline-success" 
                    size="sm" 
                    onClick={() => handleUpdateSession(session.id)}
                    disabled={!activeCredential}
                    title="Refresh session data from Telegram"
                    className="flex-shrink-0"
                  >
                    🔄 Update
                  </Button>
                  
                  {/* Actions Dropdown */}
                  <Dropdown drop="auto">
                    <Dropdown.Toggle 
                      variant="outline-secondary" 
                      size="sm" 
                      className="border-0 p-1"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <span style={{ fontSize: '16px', lineHeight: '1' }}>⋮</span>
                    </Dropdown.Toggle>

                    <Dropdown.Menu align="end" flip={true}>
                      <Dropdown.Item onClick={() => handleDownloadSession(session.id)}>
                        <span className="me-2">📥</span>
                        Download Session
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item 
                        onClick={() => openDeleteModal(session)}
                        className="text-danger"
                      >
                        <span className="me-2">🗑️</span>
                        Delete Session
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </Table>
      </div>

      <Modal show={showModal} onHide={handleCloseModal} size="md" centered>
        <Modal.Header closeButton>
          <Modal.Title>Add New Session</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Show feedback in modal */}
          {modalError && <Alert variant="danger" className="mb-3">{modalError}</Alert>}
          {modalSuccess && <Alert variant="success" className="mb-3">{modalSuccess}</Alert>}
          
          {/* Session String Input */}
          <Form.Group className="mb-3">
            <Form.Label>Session String</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Paste your session string here..."
              value={sessionString}
              onChange={(e) => setSessionString(e.target.value)}
            />
            <Form.Text className="text-muted">
              Don't have a session string? <a 
                href="/terminal" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#007bff', textDecoration: 'underline', cursor: 'pointer' }}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/terminal');
                }}
              >
                🔐 Create Session String
              </a> using our terminal tool.<br/>
              <small><strong>Note:</strong> Multiple sessions from the same Telegram account are allowed. Sessions will be sorted by name in the table.</small>
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal} disabled={isRegistering}>
            Close
          </Button>
          <Button 
            size="sm" 
            variant="success" 
            onClick={handleRegisterWithSessionString} 
            disabled={!sessionString.trim() || isRegistering}
          >
            {isRegistering ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Registering...
              </>
            ) : (
              'Register'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Credentials Modal */}
      <Modal show={showCredModal} onHide={handleCloseCredModal}>
        <Modal.Header closeButton>
          <Modal.Title>Configure Telegram API</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3">
            How to obtain your Telegram API ID & API Hash:
            <ol className="mb-0 mt-2">
              <li>Visit <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a> and sign in.</li>
              <li>Open "API Development Tools".</li>
              <li>Create a new application (enter a name and short description).</li>
              <li>Copy the displayed API ID and API Hash.</li>
            </ol>
          </Alert>
          <Form onSubmit={handleSaveCredential}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., Production Key"
                value={newCred.name}
                onChange={(e) => setNewCred({ ...newCred, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>API ID</Form.Label>
              <Form.Control
                type="number"
                placeholder="123456"
                value={newCred.api_id}
                onChange={(e) => setNewCred({ ...newCred, api_id: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>API Hash</Form.Label>
              <Form.Control
                type="text"
                placeholder="abcdef123456..."
                value={newCred.api_hash}
                onChange={(e) => setNewCred({ ...newCred, api_hash: e.target.value })}
                required
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button variant="primary" type="submit">Save</Button>
              <Button variant="secondary" onClick={handleCloseCredModal}>Close</Button>
            </div>
          </Form>
          <hr />
          <h6>Saved API Credentials</h6>
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>API ID</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((cred) => (
                <tr key={cred.id} className={cred.is_active ? 'table-success' : ''}>
                  <td>{cred.name}</td>
                  <td>{cred.api_id}</td>
                  <td>
                    {cred.is_active ? (
                      <span className="badge bg-success">Active</span>
                    ) : (
                      <span className="badge bg-secondary">Inactive</span>
                    )}
                  </td>
                  <td>
                    {!cred.is_active ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline-success" 
                          onClick={() => handleActivateCredential(cred.id)}
                          className="me-2"
                        >
                          Activate
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-danger" 
                          onClick={() => handleDeleteCredential(cred.id)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline-danger" 
                        onClick={() => handleDeleteCredential(cred.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {credentials.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center">No credentials saved</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={closeDeleteModal}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete Session</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete session <strong>{deleteTarget ? deleteTarget.name || deleteTarget.first_name || 'Unknown' : ''}</strong>?
          </p>
          {deleteTarget && (
            <div className="mt-3">
              <strong>Session Details:</strong>
              <ul className="mt-2">
                <li><strong>Name:</strong> {deleteTarget.name || 'N/A'}</li>
                <li><strong>Username:</strong> {deleteTarget.username || 'N/A'}</li>
                <li><strong>Phone:</strong> {deleteTarget.phone_number || 'N/A'}</li>
                <li><strong>First Name:</strong> {deleteTarget.first_name || 'N/A'}</li>
                <li><strong>Last Name:</strong> {deleteTarget.last_name || 'N/A'}</li>
              </ul>
            </div>
          )}
          <p className="text-danger mt-3">
            <strong>⚠️ This action cannot be undone.</strong>
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDeleteModal}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteSession}>
            Delete Session
          </Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
}

export default Sessions;