import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Sessions from './components/Sessions';
import Channels from './components/Channels';
import Files from './components/Files';
import Terminal from './components/Terminal';
import SimpleTerminal from './components/SimpleTerminal';
import CleanTerminal from './components/CleanTerminal';
import Navigation from './components/Navigation';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

function App() {
  return (
    <Router>
      <div className="App">
        <ScrollToTop />
        <Routes>
          {/* Full-screen terminal route */}
          <Route path="/terminal" element={<CleanTerminal />} />
          
          {/* Regular app routes with navigation */}
          <Route path="/*" element={
            <div className="d-flex flex-column min-vh-100">
              <Navigation />
              <main className="flex-grow-1 py-4">
                <div className="container-fluid px-3 px-md-4">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/sessions" element={<Sessions />} />
                    <Route path="/channels" element={<Channels />} />
                    <Route path="/files" element={<Files />} />
                    <Route path="/terminal-old" element={<Terminal />} />
                    <Route path="/terminal-simple" element={<SimpleTerminal />} />
                  </Routes>
                </div>
              </main>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;