import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Button, Form, Alert, Modal, ListGroup, Badge, Dropdown } from 'react-bootstrap';
import axios from 'axios';

function Channels() {
  // Channels state
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  
  // Add channel state
  const [newUsername, setNewUsername] = useState('');
  const [bulkUsernames, setBulkUsernames] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');
  
  // Delete confirmation state
  const [showDeleteChannelModal, setShowDeleteChannelModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [deleteChannelTarget, setDeleteChannelTarget] = useState(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  
  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [availableChannels, setAvailableChannels] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [categoryChannels, setCategoryChannels] = useState([]);
  const [availableSearch, setAvailableSearch] = useState('');
  const [selectedSearch, setSelectedSearch] = useState('');
  
  // Add channel modal state
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [addChannelType, setAddChannelType] = useState('single'); // 'single', 'multiple', 'file'
  
  // Edit channel modal state
  const [showEditChannelModal, setShowEditChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editChatId, setEditChatId] = useState('');
  const [editChannelName, setEditChannelName] = useState('');

  useEffect(() => {
    fetchChannels();
    fetchCategories();
  }, []);

  const fetchChannels = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await axios.get('/api/channels');
      if (response.data.success) {
        setChannels(response.data.data);
      }
    } catch (error) {
      setError('Failed to fetch channels: ' + error.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchCategories = async () => {
    try {
      setCategoryLoading(true);
      const response = await axios.get('/api/categories');
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (error) {
      setError('Failed to fetch categories: ' + error.message);
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    
    if (!newUsername.trim()) {
      setError('Please enter a username');
      return;
    }
    
    try {
      const response = await axios.post('/api/channels', {
        username: newUsername.startsWith('@') ? newUsername : '@' + newUsername
      });
      
      if (response.data.success) {
        setSuccess('Channel added successfully');
        setNewUsername('');
        fetchChannels(true); // Silent refresh, no loading screen
        handleCloseAddChannelModal();
      }
    } catch (error) {
      setError('Error adding channel: ' + error.message);
    }
  };

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    
    if (!bulkUsernames.trim()) {
      setError('Please enter usernames');
      return;
    }
    
    const usernames = bulkUsernames
      .split(/[,\n]/)
      .map(u => u.trim())
      .filter(u => u.length > 0);
    
    if (usernames.length === 0) {
      setError('Please enter valid usernames');
      return;
    }
    
    try {
      const response = await axios.post('/api/channels/bulk', { usernames });
      
      if (response.data.success) {
        setSuccess(`Added ${response.data.data.length} channels successfully`);
        setBulkUsernames('');
        fetchChannels();
        handleCloseAddChannelModal();
      }
    } catch (error) {
      setError('Error adding channels: ' + error.message);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const response = await axios.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        // Read the uploaded file content
        const fileResponse = await axios.get(`/api/files/${response.data.data.id}/preview`);
        if (fileResponse.data.success) {
          const usernames = fileResponse.data.data.content
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 0);
          
          const bulkResponse = await axios.post('/api/channels/bulk', { usernames });
          if (bulkResponse.data.success) {
            setSuccess(`Added ${bulkResponse.data.data.length} channels from file`);
            setSelectedFile(null);
            fetchChannels();
            handleCloseAddChannelModal();
          }
        }
      }
    } catch (error) {
      setError('Error uploading file: ' + error.message);
    }
  };

  const openDeleteChannelModal = (channel) => {
    setDeleteChannelTarget(channel);
    setError('');
    setSuccess('');
    setShowDeleteChannelModal(true);
  };

  const closeDeleteChannelModal = () => {
    setShowDeleteChannelModal(false);
    setDeleteChannelTarget(null);
  };

  const handleDeleteChannel = async () => {
    if (!deleteChannelTarget) return;
    try {
      const response = await axios.delete(`/api/channels/${deleteChannelTarget.id}`);
      if (response.data.success) {
        setSuccess('Channel deleted successfully');
        closeDeleteChannelModal();
        fetchChannels();
        fetchCategories();
      }
    } catch (error) {
      setError('Error deleting channel: ' + error.message);
    }
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setSelectedChannels([]);
    setCategoryChannels([]);
    setAvailableChannels([...channels]);
    setShowCategoryModal(true);
  };

  const handleEditCategory = async (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    
    try {
      const response = await axios.get(`/api/categories/${category.id}/channels`);
      if (response.data.success) {
        const categoryChannelIds = response.data.data.map(c => c.id);
        setCategoryChannels(response.data.data);
        setSelectedChannels(categoryChannelIds);
        setAvailableChannels(channels.filter(c => !categoryChannelIds.includes(c.id)));
      }
    } catch (error) {
      setError('Error loading category channels: ' + error.message);
    }
    
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      setError('Please enter category name');
      return;
    }
    
    try {
      if (editingCategory) {
        await axios.put(`/api/categories/${editingCategory.id}`, {
          name: categoryName,
          channel_ids: selectedChannels
        });
        setSuccess('Category updated successfully');
      } else {
        await axios.post('/api/categories', {
          name: categoryName,
          channel_ids: selectedChannels
        });
        setSuccess('Category created successfully');
      }
      
      setShowCategoryModal(false);
      fetchCategories();
    } catch (error) {
      setError('Error saving category: ' + error.message);
    }
  };

  const openDeleteCategoryModal = (category) => {
    setDeleteCategoryTarget(category);
    setError('');
    setSuccess('');
    setShowDeleteCategoryModal(true);
  };

  const closeDeleteCategoryModal = () => {
    setShowDeleteCategoryModal(false);
    setDeleteCategoryTarget(null);
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    try {
      const response = await axios.delete(`/api/categories/${deleteCategoryTarget.id}`);
      if (response.data.success) {
        setSuccess('Category deleted successfully');
        closeDeleteCategoryModal();
        fetchCategories();
      }
    } catch (error) {
      setError('Error deleting category: ' + error.message);
    }
  };

  const moveChannelToSelected = (channel) => {
    setSelectedChannels([...selectedChannels, channel.id]);
    setCategoryChannels([...categoryChannels, channel]);
    setAvailableChannels(availableChannels.filter(c => c.id !== channel.id));
  };

  const moveChannelToAvailable = (channel) => {
    setSelectedChannels(selectedChannels.filter(id => id !== channel.id));
    setCategoryChannels(categoryChannels.filter(c => c.id !== channel.id));
    setAvailableChannels([...availableChannels, channel]);
  };

  const handleShowAddChannelModal = (type) => {
    setAddChannelType(type);
    setNewUsername('');
    setBulkUsernames('');
    setSelectedFile(null);
    setError('');
    setSuccess('');
    setShowAddChannelModal(true);
  };

  const handleCloseAddChannelModal = () => {
    setShowAddChannelModal(false);
    setNewUsername('');
    setBulkUsernames('');
    setSelectedFile(null);
  };
  
  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setEditChatId(channel.chat_id || '');
    setEditChannelName(channel.name || '');
    setShowEditChannelModal(true);
  };
  
  const handleCloseEditChannelModal = () => {
    setShowEditChannelModal(false);
    setEditingChannel(null);
    setEditChatId('');
    setEditChannelName('');
  };
  
  const handleSaveChannelEdit = async (e) => {
    e.preventDefault();
    
    if (!editingChannel) return;
    
    try {
      const response = await axios.put(`/api/channels/${editingChannel.id}`, {
        chat_id: editChatId.trim() || null,
        name: editChannelName.trim() || null
      });
      
      if (response.data.success) {
        setSuccess(`Channel "${editingChannel.username}" updated successfully`);
        handleCloseEditChannelModal();
        fetchChannels();
      }
    } catch (error) {
      setError('Error updating channel: ' + (error.response?.data?.error || error.message));
    }
  }

  if (loading || categoryLoading) return <Container><p>Loading...</p></Container>;

  return (
    <Container fluid>
      <h2>Channels & Categories Management</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Row>
        {/* Left Panel - Channels */}
        <Col md={6}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Channels ({channels.length})</h4>
            <div className="d-flex gap-2 align-items-center">
              <Form.Control
                size="sm"
                type="text"
                placeholder="Search channels..."
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                style={{ width: '220px' }}
              />
              <Button variant="primary" onClick={() => handleShowAddChannelModal('single')}>
                Add Channel
              </Button>
            </div>
          </div>
          
          {/* Channels Table */}
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Chat ID</th>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels
                .filter((channel) => {
                  const q = channelSearch.toLowerCase();
                  if (!q) return true;
                  return (
                    (channel.username || '').toLowerCase().includes(q) ||
                    (channel.id || '').toLowerCase().includes(q)
                  );
                })
                .map((channel) => (
                <tr key={channel.id}>
                  <td>{channel.id.substring(0, 8)}...</td>
                  <td>{channel.username}</td>
                  <td>
                    {channel.chat_id ? (
                      <span className="text-success">{channel.chat_id}</span>
                    ) : (
                      <Badge bg="warning" text="dark">Not Set</Badge>
                    )}
                  </td>
                  <td>{channel.name || <span className="text-muted">-</span>}</td>
                  <td>
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
                        <Dropdown.Item onClick={() => handleEditChannel(channel)}>
                          <span className="me-2">✏️</span>
                          Edit Channel
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item 
                          onClick={() => openDeleteChannelModal(channel)}
                          className="text-danger"
                        >
                          <span className="me-2">🗑️</span>
                          Delete Channel
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
        
        {/* Right Panel - Categories */}
        <Col md={6}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Categories ({categories.length})</h4>
            <div className="d-flex gap-2 align-items-center">
              <Form.Control
                size="sm"
                type="text"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                style={{ width: '220px' }}
              />
              <Button variant="primary" onClick={handleCreateCategory}>
                Add Category
              </Button>
            </div>
          </div>
          
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Channels</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories
                .filter((category) => {
                  const q = categorySearch.toLowerCase();
                  if (!q) return true;
                  return (
                    (category.name || '').toLowerCase().includes(q) ||
                    (category.id || '').toLowerCase().includes(q)
                  );
                })
                .map((category) => (
                <tr key={category.id}>
                  <td>{category.id.substring(0, 8)}...</td>
                  <td>{category.name}</td>
                  <td>
                    <Badge bg="secondary">{category.channel_count}</Badge>
                  </td>
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-1"
                      onClick={() => handleEditCategory(category)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => openDeleteCategoryModal(category)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
      
      {/* Category Modal */}
      <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingCategory ? 'Edit Category' : 'Create Category'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            {/* Left - Available Channels */}
            <Col md={4}>
              <h6>Available Channels</h6>
              <Form.Control
                className="mb-2"
                size="sm"
                type="text"
                placeholder="Search available..."
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
              />
              <ListGroup style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {availableChannels
                  .filter((c) => {
                    const q = availableSearch.toLowerCase();
                    if (!q) return true;
                    return (c.username || '').toLowerCase().includes(q);
                  })
                  .map((channel) => (
                  <ListGroup.Item
                    key={channel.id}
                    action
                    onClick={() => moveChannelToSelected(channel)}
                    style={{ cursor: 'pointer' }}
                  >
                    {channel.username}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Col>
            
            {/* Center - Category Name */}
            <Col md={4}>
              <h6>Category Name</h6>
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="Enter category name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </Form.Group>
              <Button variant="primary" onClick={handleSaveCategory} className="w-100">
                {editingCategory ? 'Update Category' : 'Create Category'}
              </Button>
            </Col>
            
            {/* Right - Selected Channels */}
            <Col md={4}>
              <h6>Selected Channels</h6>
              <Form.Control
                className="mb-2"
                size="sm"
                type="text"
                placeholder="Search selected..."
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
              />
              <ListGroup style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {categoryChannels
                  .filter((c) => {
                    const q = selectedSearch.toLowerCase();
                    if (!q) return true;
                    return (c.username || '').toLowerCase().includes(q);
                  })
                  .map((channel) => (
                  <ListGroup.Item
                    key={channel.id}
                    action
                    onClick={() => moveChannelToAvailable(channel)}
                    style={{ cursor: 'pointer' }}
                    variant="success"
                  >
                    {channel.username}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Col>
          </Row>
        </Modal.Body>
      </Modal>
      
      {/* Add Channel Modal */}
      <Modal show={showAddChannelModal} onHide={handleCloseAddChannelModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {addChannelType === 'single' && 'Add Single Channel'}
            {addChannelType === 'multiple' && 'Add Multiple Channels'}
            {addChannelType === 'file' && 'Upload File'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addChannelType === 'single' && (
            <Form onSubmit={handleAddChannel}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter username (e.g., @username)"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button variant="primary" type="submit">
                  Add Channel
                </Button>
                <Button variant="secondary" onClick={handleCloseAddChannelModal}>
                  Cancel
                </Button>
              </div>
            </Form>
          )}
          
          {addChannelType === 'multiple' && (
            <Form onSubmit={handleBulkAdd}>
              <Form.Group className="mb-3">
                <Form.Label>Usernames</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  placeholder="Enter usernames separated by comma or new line&#10;Example:&#10;@channel1&#10;@channel2&#10;channel3&#10;channel4, channel5"
                  value={bulkUsernames}
                  onChange={(e) => setBulkUsernames(e.target.value)}
                  required
                />
                <Form.Text className="text-muted">
                  You can separate usernames with commas or new lines. @ symbol is optional.
                </Form.Text>
              </Form.Group>
              <div className="d-flex gap-2">
                <Button variant="success" type="submit">
                  Add Multiple Channels
                </Button>
                <Button variant="secondary" onClick={handleCloseAddChannelModal}>
                  Cancel
                </Button>
              </div>
            </Form>
          )}
          
          {addChannelType === 'file' && (
            <Form onSubmit={handleFileUpload}>
              <Form.Group className="mb-3">
                <Form.Label>Select File</Form.Label>
                <Form.Control
                  type="file"
                  accept=".txt"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  required
                />
                <Form.Text className="text-muted">
                  Upload a .txt file with one username per line. @ symbol is optional.
                </Form.Text>
              </Form.Group>
              <div className="d-flex gap-2">
                <Button variant="info" type="submit" disabled={!selectedFile}>
                  Upload File
                </Button>
                <Button variant="secondary" onClick={handleCloseAddChannelModal}>
                  Cancel
                </Button>
              </div>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex gap-2">
            <Button 
              variant={addChannelType === 'single' ? 'outline-primary' : 'outline-secondary'}
              onClick={() => setAddChannelType('single')}
            >
              Single
            </Button>
            <Button 
              variant={addChannelType === 'multiple' ? 'outline-success' : 'outline-secondary'}
              onClick={() => setAddChannelType('multiple')}
            >
              Multiple
            </Button>
            <Button 
              variant={addChannelType === 'file' ? 'outline-info' : 'outline-secondary'}
              onClick={() => setAddChannelType('file')}
            >
              File
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Delete Channel Confirmation Modal */}
      <Modal show={showDeleteChannelModal} onHide={closeDeleteChannelModal}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete Channel</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete channel <strong>{deleteChannelTarget ? deleteChannelTarget.username : ''}</strong>?
          </p>
          {deleteChannelTarget && (
            <div className="mt-3">
              <strong>Channel Details:</strong>
              <ul className="mt-2">
                <li><strong>ID:</strong> {deleteChannelTarget.id}</li>
                <li><strong>Username:</strong> {deleteChannelTarget.username}</li>
                <li><strong>Chat ID:</strong> {deleteChannelTarget.chat_id || 'Not set'}</li>
                <li><strong>Name:</strong> {deleteChannelTarget.name || 'Not set'}</li>
              </ul>
            </div>
          )}
          <p className="text-danger mt-3">
            <strong>⚠️ This action cannot be undone.</strong>
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDeleteChannelModal}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteChannel}>
            Delete Channel
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Delete Category Modal */}
      <Modal show={showDeleteCategoryModal} onHide={closeDeleteCategoryModal}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this category?</p>
          {deleteCategoryTarget && (
            <div>
              <strong>Category:</strong> {deleteCategoryTarget.name}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDeleteCategoryModal}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteCategory}>Delete</Button>
        </Modal.Footer>
      </Modal>
      
      {/* Edit Channel Modal */}
      <Modal show={showEditChannelModal} onHide={handleCloseEditChannelModal}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Channel</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveChannelEdit}>
          <Modal.Body>
            {editingChannel && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    value={editingChannel.username}
                    disabled
                    readOnly
                  />
                  <Form.Text className="text-muted">
                    Username cannot be changed
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Chat ID</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., -1001234567890"
                    value={editChatId}
                    onChange={(e) => setEditChatId(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Required for sending messages. Get this from Telegram or @username_to_id_bot
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Channel Name (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter channel display name"
                    value={editChannelName}
                    onChange={(e) => setEditChannelName(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Friendly name for this channel
                  </Form.Text>
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEditChannelModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default Channels;