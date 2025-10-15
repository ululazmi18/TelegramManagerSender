import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Briefcase, 
  Users,
  MessageSquare, 
  FileText, 
  Menu 
} from 'react-feather';
import './Navigation.css';

function Navigation() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navLinks = [
    { to: "/", icon: <Home size={20} />, label: "Dashboard" },
    { to: "/projects", icon: <Briefcase size={20} />, label: "Projects" },
    { to: "/sessions", icon: <Users size={20} />, label: "Sessions" },
    { to: "/channels", icon: <MessageSquare size={20} />, label: "Channels" },
    { to: "/files", icon: <FileText size={20} />, label: "Files" },
  ];

  return (
    <>
      {/* Top Navbar - Always visible */}
      <Navbar bg="white" className="shadow-sm">
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="fw-bold text-primary">
            <span className="d-flex align-items-center">
              <span className="me-2">📱</span>
              <span>Telegram Manager</span>
            </span>
          </Navbar.Brand>
          
          {/* Desktop Navigation */}
          {!isMobile && (
            <Nav className="ms-auto">
              {navLinks.map((link) => (
                <Nav.Link 
                  key={link.to}
                  as={Link} 
                  to={link.to}
                  className={`d-flex align-items-center mx-2 ${location.pathname === link.to ? 'active' : ''}`}
                >
                  <span className="me-2">{link.icon}</span>
                  {link.label}
                </Nav.Link>
              ))}
            </Nav>
          )}
        </Container>
      </Navbar>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="mobile-nav">
          <div className="mobile-nav-items">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`mobile-nav-item ${location.pathname === link.to ? 'active' : ''}`}
              >
                <div className="nav-icon">
                  {React.cloneElement(link.icon, {
                    size: 20,
                    color: location.pathname === link.to ? '#4e73df' : '#6c757d',
                  })}
                </div>
                <span className="nav-label">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      
      {/* Spacer for mobile bottom nav */}
      {isMobile && <div className="mobile-nav-spacer"></div>}
    </>
  );
}

export default Navigation;